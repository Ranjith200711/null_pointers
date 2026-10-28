/**
 * Stub implementation of package enrichment.
 * Adds vulnerability, deprecation, and publication metadata.
 *
 * @param {Array<Object>} packages - Array of parsed packages
 * @returns {Promise<Array<Object>>|Array<Object>} Enriched packages
 */
function enrichPackages(packages) {
  if (!Array.isArray(packages)) return [];

  return packages.map((pkg, idx) => {
    // Stub deterministic dummy enrichment data
    const hasDummyVuln = idx % 7 === 0 && idx > 0;
    const isDeprecated = idx % 11 === 0 && idx > 0;

    const vulns = hasDummyVuln
      ? [
          {
            id: `GHSA-dummy-${idx}`,
            severity: 'MODERATE',
            summary: `Sample vulnerability affecting ${pkg.name}`
          }
        ]
      : [];

    return {
      ...pkg,
      vulns,
      deprecated: isDeprecated ? 'Package is deprecated by author' : false,
      lastPublish: new Date(Date.now() - (idx + 1) * 86400000 * 30).toISOString()
    };
  });
}

module.exports = {
  enrichPackages
};
