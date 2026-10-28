const TARGET_SCRIPTS = ['preinstall', 'install', 'postinstall'];
const RISKY_LICENSE_REGEX = /(?:^|[^a-zA-Z])(A?GPL|LGPL|SSPL)(?:[^a-zA-Z]|$)/i;
const TWO_YEARS_MS = 2 * 365.25 * 24 * 60 * 60 * 1000;

/**
 * Extracts security and maintenance flags from a package.
 *
 * @param {Object} pkg - Package object
 * @returns {{
 *   installScripts: string[],
 *   riskyLicense: boolean,
 *   licenseNote: string,
 *   abandoned: boolean,
 *   abandonedReason: string
 * }}
 */
function getFlags(pkg) {
  if (!pkg || typeof pkg !== 'object') {
    return {
      installScripts: [],
      riskyLicense: true,
      licenseNote: 'Missing license information',
      abandoned: false,
      abandonedReason: ''
    };
  }

  // 1. installScripts = names found among preinstall/install/postinstall
  const installScripts = [];
  if (Array.isArray(pkg.installScripts)) {
    for (const name of TARGET_SCRIPTS) {
      if (pkg.installScripts.includes(name)) {
        installScripts.push(name);
      }
    }
  } else if (pkg.scripts && typeof pkg.scripts === 'object') {
    for (const name of TARGET_SCRIPTS) {
      if (Boolean(pkg.scripts[name])) {
        installScripts.push(name);
      }
    }
  }

  // 2. riskyLicense = true for GPL, AGPL, LGPL, SSPL, or missing/UNLICENSED; also return a licenseNote string
  let riskyLicense = false;
  let licenseNote = '';

  const rawLicense = typeof pkg.license === 'string'
    ? pkg.license.trim()
    : (pkg.license && typeof pkg.license === 'object' ? (pkg.license.type || pkg.license.name || '') : '');

  if (!rawLicense || rawLicense.toUpperCase() === 'UNKNOWN') {
    riskyLicense = true;
    licenseNote = 'Missing or unknown license';
  } else if (rawLicense.toUpperCase() === 'UNLICENSED') {
    riskyLicense = true;
    licenseNote = 'Explicitly unlicensed (proprietary)';
  } else if (RISKY_LICENSE_REGEX.test(rawLicense)) {
    riskyLicense = true;
    licenseNote = `Copyleft / restrictive license (${rawLicense})`;
  } else {
    riskyLicense = false;
    licenseNote = `Permissive license (${rawLicense})`;
  }

  // 3. abandoned = true if lastPublish is older than 2 years OR maintainers.length is 1; also return an abandonedReason string
  let isOlderThan2Years = false;
  if (pkg.lastPublish) {
    const pubTime = new Date(pkg.lastPublish).getTime();
    if (!isNaN(pubTime)) {
      isOlderThan2Years = (Date.now() - pubTime) > TWO_YEARS_MS;
    }
  }

  let hasSingleMaintainer = false;
  if (Array.isArray(pkg.maintainers)) {
    hasSingleMaintainer = pkg.maintainers.length === 1;
  }

  const abandoned = isOlderThan2Years || hasSingleMaintainer;
  let abandonedReason = '';
  if (isOlderThan2Years && hasSingleMaintainer) {
    abandonedReason = 'Last published over 2 years ago and single maintainer';
  } else if (isOlderThan2Years) {
    abandonedReason = 'Last published over 2 years ago';
  } else if (hasSingleMaintainer) {
    abandonedReason = 'Single maintainer (bus factor risk)';
  }

  return {
    installScripts,
    riskyLicense,
    licenseNote,
    abandoned,
    abandonedReason
  };
}

module.exports = {
  getFlags,
  TARGET_SCRIPTS,
  RISKY_LICENSE_REGEX
};
