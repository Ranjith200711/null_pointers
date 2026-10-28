const fs = require('fs');
const path = require('path');
const { getFlags } = require('./flags');

const CACHE_FILE = path.join(__dirname, 'cache.json');
const TARGET_SCRIPTS = ['preinstall', 'install', 'postinstall'];

/**
 * Creates a concurrency limiter function.
 * Ensures at most `concurrency` asynchronous tasks run simultaneously.
 *
 * @param {number} concurrency - Maximum concurrent tasks
 * @returns {Function} Limiter wrapper
 */
function createLimiter(concurrency = 10) {
  let active = 0;
  const queue = [];

  const next = () => {
    if (active < concurrency && queue.length > 0) {
      active++;
      const { fn, resolve, reject } = queue.shift();
      fn()
        .then(resolve)
        .catch(reject)
        .finally(() => {
          active--;
          next();
        });
    }
  };

  return function limit(fn) {
    return new Promise((resolve, reject) => {
      queue.push({ fn, resolve, reject });
      next();
    });
  };
}

/**
 * Performs an HTTP request with exponential backoff retries.
 * Defaults to 2 retries (3 total attempts).
 *
 * @param {string} url - Request URL
 * @param {Object} options - Fetch options
 * @param {number} retries - Number of retries
 * @param {number} delayMs - Base delay between retries
 * @returns {Promise<any>} Parsed JSON response
 */
async function fetchWithRetry(url, options = {}, retries = 2, delayMs = 300) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, options);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status} ${res.statusText} for ${url}`);
      }
      return await res.json();
    } catch (err) {
      lastError = err;
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, delayMs * Math.pow(2, attempt)));
      }
    }
  }
  throw lastError;
}

/**
 * Parses CVSS v3.x vector string to calculate base score.
 *
 * @param {string} vector - CVSS vector string (e.g. CVSS:3.1/AV:N/AC:L...)
 * @returns {number|null} Base score (0.0 - 10.0) or null
 */
function parseCvssV3(vector) {
  if (!vector || typeof vector !== 'string') return null;
  try {
    const metrics = {};
    vector.split('/').forEach(part => {
      const [k, v] = part.split(':');
      if (k && v) metrics[k] = v;
    });

    const avMap = { N: 0.85, A: 0.62, L: 0.55, P: 0.2 };
    const acMap = { L: 0.77, H: 0.44 };
    const uiMap = { N: 0.85, R: 0.62 };
    const cMap = { H: 0.56, L: 0.22, N: 0 };
    const iMap = { H: 0.56, L: 0.22, N: 0 };
    const aMap = { H: 0.56, L: 0.22, N: 0 };

    const AV = avMap[metrics.AV] || 0.85;
    const AC = acMap[metrics.AC] || 0.77;
    const UI = uiMap[metrics.UI] || 0.85;
    const S = metrics.S === 'C';
    let PR = 0.85;
    if (metrics.PR === 'L') PR = S ? 0.68 : 0.62;
    else if (metrics.PR === 'H') PR = S ? 0.50 : 0.27;

    const C = cMap[metrics.C] || 0;
    const I = iMap[metrics.I] || 0;
    const A = aMap[metrics.A] || 0;

    const ISS = 1 - ((1 - C) * (1 - I) * (1 - A));
    const impact = S
      ? 7.52 * (ISS - 0.029) - 3.25 * Math.pow(ISS - 0.02, 15)
      : 6.42 * ISS;

    const exploitability = 8.22 * AV * AC * PR * UI;
    if (impact <= 0) return 0;

    const base = S
      ? Math.min(Math.ceil(1.08 * (impact + exploitability) * 10) / 10, 10)
      : Math.min(Math.ceil((impact + exploitability) * 10) / 10, 10);

    return base;
  } catch {
    return null;
  }
}

/**
 * Maps OSV vulnerability details to low/medium/high/critical.
 *
 * @param {Object} vulnData - Detailed OSV vulnerability object
 * @returns {'low'|'medium'|'high'|'critical'}
 */
function mapSeverity(vulnData) {
  if (!vulnData) return 'medium';

  // 1. database_specific.severity (GitHub Advisory: LOW, MODERATE, HIGH, CRITICAL)
  const dbSev = vulnData.database_specific?.severity;
  if (typeof dbSev === 'string') {
    const s = dbSev.trim().toLowerCase();
    if (s.includes('crit')) return 'critical';
    if (s.includes('high')) return 'high';
    if (s.includes('mod') || s.includes('med')) return 'medium';
    if (s.includes('low')) return 'low';
  }

  // 2. ecosystem_specific.severity
  const ecoSev = vulnData.ecosystem_specific?.severity;
  if (typeof ecoSev === 'string') {
    const s = ecoSev.trim().toLowerCase();
    if (s.includes('crit')) return 'critical';
    if (s.includes('high')) return 'high';
    if (s.includes('mod') || s.includes('med')) return 'medium';
    if (s.includes('low')) return 'low';
  }

  // 3. severity array containing CVSS score or vector
  if (Array.isArray(vulnData.severity)) {
    for (const item of vulnData.severity) {
      if (!item) continue;
      if (typeof item.score === 'number') {
        if (item.score >= 9.0) return 'critical';
        if (item.score >= 7.0) return 'high';
        if (item.score >= 4.0) return 'medium';
        return 'low';
      }
      if (typeof item.score === 'string') {
        const num = parseFloat(item.score);
        if (!isNaN(num) && String(num) === item.score.trim()) {
          if (num >= 9.0) return 'critical';
          if (num >= 7.0) return 'high';
          if (num >= 4.0) return 'medium';
          return 'low';
        }
        if (item.score.startsWith('CVSS:3')) {
          const score = parseCvssV3(item.score);
          if (score !== null) {
            if (score >= 9.0) return 'critical';
            if (score >= 7.0) return 'high';
            if (score >= 4.0) return 'medium';
            return 'low';
          }
        }
      }
    }
  }

  return 'medium';
}

/**
 * Loads cache from JSON file.
 *
 * @param {string} filePath
 * @returns {Object}
 */
function loadCache(filePath = CACHE_FILE) {
  try {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(content);
    }
  } catch {
    // Return empty cache on read or parse failure
  }
  return {};
}

/**
 * Saves cache to JSON file.
 *
 * @param {Object} cache
 * @param {string} filePath
 */
function saveCache(cache, filePath = CACHE_FILE) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(cache, null, 2), 'utf8');
  } catch {
    // Ignore cache persistence errors
  }
}

/**
 * Enriches a list of packages with vulnerability & npm registry metadata.
 *
 * @param {Array<{id: string, name: string, version: string}>} list - Package list
 * @param {Object} [options] - Optional configuration (cachePath, concurrency, retries)
 * @returns {Promise<Array<Object>>} Enriched packages list
 */
async function enrichPackages(list, options = {}) {
  if (!Array.isArray(list) || list.length === 0) {
    return [];
  }

  const cachePath = options.cachePath || CACHE_FILE;
  const cache = loadCache(cachePath);
  const limiter = createLimiter(options.concurrency || 10);
  const retries = options.retries !== undefined ? options.retries : 2;

  const results = new Array(list.length);
  const toEnrich = [];

  // Check cache first for each package
  for (let i = 0; i < list.length; i++) {
    const pkg = list[i];
    if (!pkg) continue;

    const key = `${pkg.name}@${pkg.version}`;
    if (cache[key]) {
      results[i] = {
        ...pkg,
        ...cache[key]
      };
    } else {
      toEnrich.push({ index: i, pkg, key });
    }
  }

  // If everything was cached, return immediately with flags
  if (toEnrich.length === 0) {
    return results.map(pkg => ({
      ...pkg,
      ...getFlags(pkg)
    }));
  }

  // 1. Query OSV via querybatch
  const osvResultsMap = new Map();
  let osvBatchFailed = false;

  try {
    const BATCH_SIZE = 500;
    for (let i = 0; i < toEnrich.length; i += BATCH_SIZE) {
      const chunk = toEnrich.slice(i, i + BATCH_SIZE);
      const body = {
        queries: chunk.map(({ pkg }) => ({
          package: { name: pkg.name, ecosystem: 'npm' },
          version: pkg.version
        }))
      };

      const osvData = await limiter(() =>
        fetchWithRetry(
          'https://api.osv.dev/v1/querybatch',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
          },
          retries
        )
      );

      const batchResults = osvData?.results || [];
      chunk.forEach(({ key }, idx) => {
        const itemResult = batchResults[idx];
        osvResultsMap.set(key, itemResult?.vulns || []);
      });
    }
  } catch {
    osvBatchFailed = true;
  }

  // Collect unique vuln IDs across all packages
  const uniqueVulnIds = new Set();
  for (const vulns of osvResultsMap.values()) {
    if (Array.isArray(vulns)) {
      for (const v of vulns) {
        if (v?.id) uniqueVulnIds.add(v.id);
      }
    }
  }

  // Fetch severity for each vulnerability from https://api.osv.dev/v1/vulns/<id>
  const vulnSeverityMap = new Map();
  const vulnFetches = Array.from(uniqueVulnIds).map(vulnId =>
    limiter(async () => {
      try {
        const vulnData = await fetchWithRetry(
          `https://api.osv.dev/v1/vulns/${encodeURIComponent(vulnId)}`,
          {},
          retries
        );
        vulnSeverityMap.set(vulnId, mapSeverity(vulnData));
      } catch {
        vulnSeverityMap.set(vulnId, 'medium');
      }
    })
  );
  await Promise.all(vulnFetches);

  // 2. Fetch metadata from https://registry.npmjs.org/<name>
  const uniqueNames = [...new Set(toEnrich.map(({ pkg }) => pkg.name))];
  const npmDataMap = new Map();

  const npmFetches = uniqueNames.map(pkgName =>
    limiter(async () => {
      try {
        const encodedName = pkgName.startsWith('@')
          ? '@' + encodeURIComponent(pkgName.slice(1))
          : encodeURIComponent(pkgName);
        const url = `https://registry.npmjs.org/${encodedName}`;
        const npmData = await fetchWithRetry(url, {}, retries);
        npmDataMap.set(pkgName, npmData);
      } catch (err) {
        npmDataMap.set(pkgName, err);
      }
    })
  );
  await Promise.all(npmFetches);

  // 3. Assemble results and populate cache
  let cacheModified = false;

  for (const { index, pkg, key } of toEnrich) {
    const rawNpm = npmDataMap.get(pkg.name);
    const npmIsError = !rawNpm || rawNpm instanceof Error;
    const isFailed = osvBatchFailed || npmIsError;

    if (isFailed) {
      // Mark dataUnavailable: true and continue
      results[index] = {
        ...pkg,
        vulns: [],
        deprecated: false,
        latest: null,
        lastPublish: null,
        maintainers: [],
        license: 'UNKNOWN',
        installScripts: [],
        dataUnavailable: true
      };
      continue;
    }

    // Process OSV vulns
    const rawVulns = osvResultsMap.get(key) || [];
    const vulns = rawVulns.map(v => ({
      id: v.id,
      severity: vulnSeverityMap.get(v.id) || 'medium'
    }));

    // Process npm registry data
    const npmData = rawNpm;
    const latest = npmData?.['dist-tags']?.latest || null;

    const versionClean = (pkg.version || '').replace(/^v/, '');
    const versionData =
      npmData?.versions?.[pkg.version] ||
      npmData?.versions?.[versionClean] ||
      {};

    const deprecated = versionData?.deprecated ? versionData.deprecated : false;
    const lastPublish =
      npmData?.time?.[pkg.version] ||
      npmData?.time?.[versionClean] ||
      null;

    const maintainers = versionData?.maintainers || npmData?.maintainers || [];

    let license = 'UNKNOWN';
    const lic = versionData?.license || npmData?.license;
    if (typeof lic === 'string' && lic.trim() !== '') {
      license = lic.trim();
    } else if (lic && typeof lic === 'object') {
      license = lic.type || lic.name || 'UNKNOWN';
    }

    const scriptsObj = versionData?.scripts || {};
    const installScripts = TARGET_SCRIPTS.filter(s => Boolean(scriptsObj[s]));

    const enrichedFields = {
      vulns,
      deprecated,
      latest,
      lastPublish,
      maintainers,
      license,
      installScripts
    };

    cache[key] = enrichedFields;
    cacheModified = true;

    results[index] = {
      ...pkg,
      ...enrichedFields
    };
  }

  if (cacheModified) {
    saveCache(cache, cachePath);
  }

  return results.map(pkg => ({
    ...pkg,
    ...getFlags(pkg)
  }));
}

module.exports = enrichPackages;
module.exports.enrichPackages = enrichPackages;
module.exports.getFlags = getFlags;
module.exports.createLimiter = createLimiter;
module.exports.fetchWithRetry = fetchWithRetry;
module.exports.mapSeverity = mapSeverity;
module.exports.parseCvssV3 = parseCvssV3;
module.exports.loadCache = loadCache;
module.exports.saveCache = saveCache;
