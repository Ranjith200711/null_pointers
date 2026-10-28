/**
 * Builds forward and reverse graphs, nodes, edges, and computes blast radius
 * for a list of parsed packages.
 *
 * @param {Array<Object>} packages - Array of package objects from parseLockfile
 * @returns {Object} { forward, reverse, nodes, edges, blastRadiusMap }
 */
function buildGraph(packages) {
  if (!Array.isArray(packages)) {
    return {
      forward: {},
      reverse: {},
      nodes: [],
      edges: [],
      blastRadiusMap: new Map()
    };
  }

  // Lookups for quick resolution
  const nameToId = new Map();
  const idToPkg = new Map();

  for (const pkg of packages) {
    if (!pkg || !pkg.id) continue;
    idToPkg.set(pkg.id, pkg);
    // Prioritize direct packages if multiple share a name
    if (!nameToId.has(pkg.name) || pkg.direct) {
      nameToId.set(pkg.name, pkg.id);
    }
  }

  const forward = {};
  const reverse = {};

  for (const pkg of packages) {
    if (!pkg || !pkg.id) continue;
    if (!forward[pkg.id]) forward[pkg.id] = [];
    if (!reverse[pkg.id]) reverse[pkg.id] = [];
  }

  const edges = [];
  const edgeSet = new Set();

  for (const pkg of packages) {
    if (!pkg || !pkg.id) continue;
    const depsObj = pkg.deps || {};
    const depNames = Object.keys(depsObj);

    for (const depName of depNames) {
      const targetId = nameToId.get(depName);
      if (targetId) {
        const edgeKey = `${pkg.id}->${targetId}`;
        if (!edgeSet.has(edgeKey)) {
          edgeSet.add(edgeKey);
          edges.push({
            from: pkg.id,
            to: targetId,
            source: pkg.id,
            target: targetId
          });

          if (!forward[pkg.id]) forward[pkg.id] = [];
          forward[pkg.id].push(targetId);

          if (!reverse[targetId]) reverse[targetId] = [];
          reverse[targetId].push(pkg.id);
        }
      }
    }
  }

  const nodes = packages.map(pkg => ({
    id: pkg.id,
    name: pkg.name,
    version: pkg.version,
    direct: Boolean(pkg.direct),
    license: pkg.license || 'UNKNOWN'
  }));

  // Calculate blast radius for each package:
  // Count of all distinct packages that directly or indirectly depend on this package
  // (reachable in reverse graph)
  const blastRadiusMap = new Map();

  for (const pkg of packages) {
    if (!pkg || !pkg.id) continue;
    const visited = new Set();
    const queue = [...(reverse[pkg.id] || [])];

    for (const parent of queue) {
      visited.add(parent);
    }

    let head = 0;
    while (head < queue.length) {
      const current = queue[head++];
      const parents = reverse[current] || [];
      for (const parent of parents) {
        if (!visited.has(parent) && parent !== pkg.id) {
          visited.add(parent);
          queue.push(parent);
        }
      }
    }

    blastRadiusMap.set(pkg.id, visited.size);
  }

  return {
    forward,
    reverse,
    nodes,
    edges,
    blastRadiusMap
  };
}

/**
 * Computes blast radius for a single package given reverse graph.
 *
 * @param {string} packageId
 * @param {Object} reverseGraph
 * @returns {number}
 */
function computeBlastRadius(packageId, reverseGraph = {}) {
  const visited = new Set();
  const queue = [...(reverseGraph[packageId] || [])];

  for (const parent of queue) {
    visited.add(parent);
  }

  let head = 0;
  while (head < queue.length) {
    const current = queue[head++];
    const parents = reverseGraph[current] || [];
    for (const parent of parents) {
      if (!visited.has(parent) && parent !== packageId) {
        visited.add(parent);
        queue.push(parent);
      }
    }
  }

  return visited.size;
}

module.exports = {
  buildGraph,
  computeBlastRadius
};
