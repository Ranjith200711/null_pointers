/**
 * Risk scoring weights configuration.
 */
const WEIGHTS = {
  vulns: {
    max: 40,
    critical: 40,
    high: 30,
    medium: 15,
    low: 5,
    extraPerVuln: 2
  },
  deprecated: {
    max: 20
  },
  stale: {
    max: 15,
    singleMaintainer: 5,
    maxAgeYears: 5,
    maxAgeScore: 10
  },
  scripts: {
    max: 10
  },
  license: {
    max: 15
  }
};

const RISKY_LICENSE_REGEX = /(?:^|[^a-zA-Z])(A?GPL|LGPL|SSPL)(?:[^a-zA-Z]|$)/i;

/**
 * Computes the risk score and breakdown for a single package.
 *
 * @param {Object} pkg - Package object
 * @returns {{
 *   score: number,
 *   scoreBreakdown: {
 *     vulns: number,
 *     deprecated: number,
 *     stale: number,
 *     scripts: number,
 *     license: number
 *   }
 * }}
 */
function scorePackage(pkg) {
  if (!pkg || typeof pkg !== 'object') {
    return {
      score: 0,
      scoreBreakdown: {
        vulns: 0,
        deprecated: 0,
        stale: 0,
        scripts: 0,
        license: 0
      }
    };
  }

  // 1. Vulnerabilities: max 40 (critical 40, high 30, medium 15, low 5, take highest plus 2 per extra vuln, cap 40)
  let vulnsScore = 0;
  const vulns = Array.isArray(pkg.vulns) ? pkg.vulns : [];
  if (vulns.length > 0) {
    let highest = 0;
    for (const v of vulns) {
      const sev = (v?.severity || '').toString().toLowerCase();
      let pts = WEIGHTS.vulns.low;
      if (sev === 'critical') pts = WEIGHTS.vulns.critical;
      else if (sev === 'high') pts = WEIGHTS.vulns.high;
      else if (sev === 'medium' || sev === 'moderate') pts = WEIGHTS.vulns.medium;
      else if (sev === 'low') pts = WEIGHTS.vulns.low;

      if (pts > highest) highest = pts;
    }
    const extraCount = vulns.length - 1;
    vulnsScore = Math.min(WEIGHTS.vulns.max, highest + extraCount * WEIGHTS.vulns.extraPerVuln);
  }

  // 2. Deprecated: 20
  const deprecatedScore = Boolean(pkg.deprecated) ? WEIGHTS.deprecated.max : 0;

  // 3. Stale: max 15 (scaled by age, plus single maintainer)
  let ageScore = 0;
  if (pkg.lastPublish) {
    const pubTime = new Date(pkg.lastPublish).getTime();
    if (!isNaN(pubTime)) {
      const ageYears = Math.max(0, (Date.now() - pubTime) / (365.25 * 24 * 60 * 60 * 1000));
      ageScore = Math.min(
        WEIGHTS.stale.maxAgeScore,
        Math.round((ageYears / WEIGHTS.stale.maxAgeYears) * WEIGHTS.stale.maxAgeScore)
      );
    }
  }

  let maintainerScore = 0;
  if (Array.isArray(pkg.maintainers) && pkg.maintainers.length === 1) {
    maintainerScore = WEIGHTS.stale.singleMaintainer;
  }
  const staleScore = Math.min(WEIGHTS.stale.max, ageScore + maintainerScore);

  // 4. Scripts: 10
  const hasScripts =
    (Array.isArray(pkg.installScripts) && pkg.installScripts.length > 0) ||
    Boolean(pkg.hasInstallScript);
  const scriptsScore = hasScripts ? WEIGHTS.scripts.max : 0;

  // 5. License: 15
  let isRiskyLicense = false;
  if (typeof pkg.riskyLicense === 'boolean') {
    isRiskyLicense = pkg.riskyLicense;
  } else {
    const rawLicense = typeof pkg.license === 'string'
      ? pkg.license.trim()
      : (pkg.license && typeof pkg.license === 'object' ? (pkg.license.type || pkg.license.name || '') : '');
    isRiskyLicense =
      !rawLicense ||
      rawLicense.toUpperCase() === 'UNKNOWN' ||
      rawLicense.toUpperCase() === 'UNLICENSED' ||
      RISKY_LICENSE_REGEX.test(rawLicense);
  }
  const licenseScore = isRiskyLicense ? WEIGHTS.license.max : 0;

  const score = Math.min(100, vulnsScore + deprecatedScore + staleScore + scriptsScore + licenseScore);

  return {
    score,
    scoreBreakdown: {
      vulns: vulnsScore,
      deprecated: deprecatedScore,
      stale: staleScore,
      scripts: scriptsScore,
      license: licenseScore
    }
  };
}

/**
 * Computes project score as average of the top 10 package scores (0-100).
 *
 * @param {Array<Object|number>} packages
 * @returns {number} 0-100
 */
function projectScore(packages) {
  if (!Array.isArray(packages) || packages.length === 0) {
    return 0;
  }

  const scores = packages.map(pkg => {
    if (typeof pkg === 'number') return pkg;
    if (pkg && typeof pkg.score === 'number') return pkg.score;
    return scorePackage(pkg).score;
  });

  scores.sort((a, b) => b - a);
  const top10 = scores.slice(0, 10);
  const sum = top10.reduce((acc, s) => acc + s, 0);
  const avg = top10.length > 0 ? sum / top10.length : 0;

  return Math.min(100, Math.max(0, Math.round(avg)));
}

/**
 * Maps numeric score to letter grade.
 * A <20, B <40, C <60, D <80, else F
 *
 * @param {number} score
 * @returns {'A'|'B'|'C'|'D'|'F'}
 */
function gradeFor(score) {
  const s = Number(score) || 0;
  if (s < 20) return 'A';
  if (s < 40) return 'B';
  if (s < 60) return 'C';
  if (s < 80) return 'D';
  return 'F';
}

/**
 * Computes project score after removing specified packages.
 *
 * @param {Array<Object>} packages
 * @param {Array<string>|Set<string>|string} removedIds
 * @returns {number}
 */
function scoreAfterFix(packages, removedIds = []) {
  if (!Array.isArray(packages) || packages.length === 0) {
    return 0;
  }

  const removedSet = removedIds instanceof Set
    ? removedIds
    : new Set(Array.isArray(removedIds) ? removedIds : [removedIds]);

  const remaining = packages.filter(pkg => {
    if (!pkg) return false;
    if (pkg.id && removedSet.has(pkg.id)) return false;
    if (pkg.name && removedSet.has(pkg.name)) return false;
    return true;
  });

  return projectScore(remaining);
}

/**
 * Backwards compatibility helper returning { projectScore, grade }.
 *
 * @param {Array<Object>} packages
 * @returns {{ projectScore: number, grade: string }}
 */
function calculateProjectScore(packages) {
  const score = projectScore(packages);
  const grade = gradeFor(score);
  return { projectScore: score, grade };
}

module.exports = {
  WEIGHTS,
  scorePackage,
  projectScore,
  gradeFor,
  scoreAfterFix,
  calculateProjectScore
};
