/**
 * Computes risk score and breakdown for a single package.
 * Higher score indicates higher risk.
 *
 * @param {Object} pkg
 * @returns {Object} { score: number, scoreBreakdown: Object }
 */
function scorePackage(pkg) {
  let score = 0;
  const breakdown = {
    vulnerabilities: 0,
    installScripts: 0,
    deprecated: 0,
    license: 0
  };

  const vulns = Array.isArray(pkg.vulns) ? pkg.vulns : [];
  if (vulns.length > 0) {
    breakdown.vulnerabilities = vulns.length * 25;
    score += breakdown.vulnerabilities;
  }

  if (pkg.hasInstallScript || pkg.installScripts) {
    breakdown.installScripts = 15;
    score += breakdown.installScripts;
  }

  if (pkg.deprecated) {
    breakdown.deprecated = 20;
    score += breakdown.deprecated;
  }

  if (!pkg.license || pkg.license === 'UNKNOWN') {
    breakdown.license = 10;
    score += breakdown.license;
  }

  return {
    score,
    scoreBreakdown: breakdown
  };
}

/**
 * Computes overall project score and letter grade.
 *
 * @param {Array<Object>} scoredPackages
 * @returns {Object} { projectScore: number, grade: string }
 */
function calculateProjectScore(scoredPackages = []) {
  if (!Array.isArray(scoredPackages) || scoredPackages.length === 0) {
    return { projectScore: 0, grade: 'A' };
  }

  const totalScore = scoredPackages.reduce((acc, p) => acc + (p.score || 0), 0);
  const avgScore = totalScore / scoredPackages.length;
  const projectScore = Math.round(avgScore);

  let grade = 'A';
  if (projectScore >= 40) grade = 'F';
  else if (projectScore >= 30) grade = 'D';
  else if (projectScore >= 20) grade = 'C';
  else if (projectScore >= 10) grade = 'B';

  return {
    projectScore,
    grade
  };
}

module.exports = {
  scorePackage,
  calculateProjectScore
};
