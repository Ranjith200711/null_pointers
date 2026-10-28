/**
 * Graph-Aware RAG Retriever
 * Extracts relevant package profiles, blast radius chains, and project metrics
 * based on user queries.
 */

function retrieveContext(query = '', context = {}) {
  const q = query.toLowerCase();
  const packages = context.packages || [];
  const graph = context.graph || { nodes: [], edges: [] };
  const projectScore = context.projectScore ?? null;
  const grade = context.grade ?? null;
  const fix = context.fix ?? null;

  const relevant = {
    projectSummary: null,
    matchedPackages: [],
    highestBlastRadius: [],
    highestRisk: [],
    installScriptPackages: [],
    fixRecommendation: fix,
    matchedEdges: []
  };

  // 1. Project Summary
  if (projectScore !== null && grade !== null) {
    relevant.projectSummary = {
      projectScore,
      grade,
      totalPackages: packages.length,
      directCount: packages.filter(p => p.direct).length,
      transitiveCount: packages.filter(p => !p.direct).length,
      criticalCount: packages.filter(p => (p.score || 0) >= 60).length,
      highCount: packages.filter(p => (p.score || 0) >= 40 && (p.score || 0) < 60).length,
      mediumCount: packages.filter(p => (p.score || 0) >= 20 && (p.score || 0) < 40).length
    };
  }

  // 2. Identify mentioned packages in query
  for (const pkg of packages) {
    const rawName = (pkg.name || pkg.id?.split('@')[0] || '').toLowerCase();
    if (rawName && q.includes(rawName)) {
      relevant.matchedPackages.push(pkg);
    }
  }

  // 3. Top packages by Blast Radius
  const sortedByBlast = [...packages].sort((a, b) => (b.blastRadius || 0) - (a.blastRadius || 0));
  relevant.highestBlastRadius = sortedByBlast.slice(0, 5);

  // 4. Top packages by Risk Score
  const sortedByRisk = [...packages].sort((a, b) => (b.score || 0) - (a.score || 0));
  relevant.highestRisk = sortedByRisk.slice(0, 5);

  // 5. Packages with install scripts
  relevant.installScriptPackages = packages.filter(p => p.installScripts || p.hasInstallScript);

  // 6. Matched edges for mentioned packages
  if (relevant.matchedPackages.length > 0 && graph.edges) {
    const matchedIds = new Set(relevant.matchedPackages.map(p => p.id));
    relevant.matchedEdges = graph.edges.filter(
      e => matchedIds.has(e.from || e.source) || matchedIds.has(e.to || e.target)
    );
  }

  return relevant;
}

module.exports = {
  retrieveContext
};
