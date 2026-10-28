/**
 * Finds the direct dependency whose upgrade removes the highest risk.
 * Risk removed = sum of risk scores of D and all its descendants that
 * are exclusive to D (i.e., not reachable from any other direct dependency).
 *
 * @param {Array<Object>} packages - Array of package objects ({ id, name, version, direct, ... })
 * @param {Object|Map} forward - Forward adjacency list (nodeId -> array/set of child nodeIds or names)
 * @param {Object|Map} [scores={}] - Map of package id/name -> risk score (number)
 * @returns {Object|null} { package: string, risk: number, command: string } or null
 */
function bestUpgrade(packages, forward, scores = {}) {
  if (!Array.isArray(packages) || packages.length === 0) {
    return null;
  }

  // Helper to read from Map or Object
  const getScore = (nodeId, pkgName) => {
    if (!scores) return 0;
    if (scores instanceof Map) {
      if (scores.has(nodeId)) return Number(scores.get(nodeId)) || 0;
      if (pkgName && scores.has(pkgName)) return Number(scores.get(pkgName)) || 0;
      return 0;
    }
    if (typeof scores === 'object') {
      if (nodeId in scores) return Number(scores[nodeId]) || 0;
      if (pkgName && pkgName in scores) return Number(scores[pkgName]) || 0;
      return 0;
    }
    return 0;
  };

  // Helper to read neighbors from forward graph
  const getNeighbors = (nodeKey) => {
    if (!forward) return [];
    let neighbors;
    if (forward instanceof Map) {
      neighbors = forward.get(nodeKey);
    } else if (typeof forward === 'object') {
      neighbors = forward[nodeKey];
    }
    if (!neighbors) return [];
    if (Array.isArray(neighbors)) return neighbors;
    if (neighbors instanceof Set) return Array.from(neighbors);
    if (typeof neighbors === 'object') return Object.keys(neighbors);
    return [];
  };

  // Build lookups
  const idToPkg = new Map();
  const nameToId = new Map();

  for (const pkg of packages) {
    if (!pkg) continue;
    if (pkg.id) idToPkg.set(pkg.id, pkg);
    if (pkg.name) {
      if (!nameToId.has(pkg.name) || pkg.direct) {
        nameToId.set(pkg.name, pkg.id || pkg.name);
      }
    }
  }

  // Find all direct dependencies
  const directPackages = packages.filter(p => p && Boolean(p.direct));
  if (directPackages.length === 0) {
    return null;
  }

  // For each direct dependency, find all reachable nodes using BFS
  const directReachable = new Map(); // directId -> Set of reachable nodeIds
  const reachCount = new Map();      // nodeId -> number of direct deps that can reach it

  for (const directPkg of directPackages) {
    const startNode = directPkg.id || directPkg.name;
    const visited = new Set();
    const queue = [startNode];
    visited.add(startNode);

    while (queue.length > 0) {
      const current = queue.shift();

      // Resolve current node neighbors
      // The graph may store edges by id or by name
      let neighbors = getNeighbors(current);
      if (neighbors.length === 0 && idToPkg.has(current)) {
        const pkgObj = idToPkg.get(current);
        if (pkgObj && pkgObj.name && pkgObj.name !== current) {
          neighbors = getNeighbors(pkgObj.name);
        }
      }

      for (const neighbor of neighbors) {
        // Resolve neighbor to canonical id if possible
        const resolvedNeighbor = idToPkg.has(neighbor)
          ? neighbor
          : (nameToId.get(neighbor) || neighbor);

        if (!visited.has(resolvedNeighbor)) {
          visited.add(resolvedNeighbor);
          queue.push(resolvedNeighbor);
        }
      }
    }

    directReachable.set(startNode, visited);

    for (const reachableNode of visited) {
      reachCount.set(reachableNode, (reachCount.get(reachableNode) || 0) + 1);
    }
  }

  // For each direct dependency, calculate risk removed:
  // sum of scores of nodes reachable ONLY from this direct dependency
  let bestCandidate = null;
  let maxRiskRemoved = 0;

  for (const directPkg of directPackages) {
    const startNode = directPkg.id || directPkg.name;
    const reachable = directReachable.get(startNode);
    if (!reachable) continue;

    let riskRemoved = 0;

    for (const nodeId of reachable) {
      // Only include nodes not reachable from any other direct dependency
      if (reachCount.get(nodeId) === 1) {
        const pkgObj = idToPkg.get(nodeId);
        const pkgName = pkgObj ? pkgObj.name : nodeId;
        riskRemoved += getScore(nodeId, pkgName);
      }
    }

    if (riskRemoved > maxRiskRemoved) {
      maxRiskRemoved = riskRemoved;
      bestCandidate = {
        package: directPkg.name,
        risk: riskRemoved,
        command: `npm install ${directPkg.name}@latest`
      };
    }
  }

  return bestCandidate;
}

/**
 * Generates a dummy scores map for testing purposes.
 *
 * @param {Array<Object>} [packages=[]]
 * @returns {Object} Map of package id -> score number
 */
function createDummyScores(packages = []) {
  const scores = {};
  if (!Array.isArray(packages)) return scores;

  packages.forEach((pkg, idx) => {
    if (!pkg) return;
    const key = pkg.id || pkg.name;
    if (key) {
      // Deterministic dummy risk score
      scores[key] = (idx % 10) * 10 + 5;
    }
  });

  return scores;
}

module.exports = {
  bestUpgrade,
  createDummyScores
};
