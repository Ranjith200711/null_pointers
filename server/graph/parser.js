/**
 * Derives a package name from a package path in package-lock.json.
 * Uses the last "node_modules/" segment of the path.
 * Handles standard and scoped packages (@scope/pkg).
 *
 * @param {string} pkgPath - Path from package-lock.json packages map
 * @param {Object} [pkg] - Package object fallback
 * @returns {string} Package name
 */
function derivePackageName(pkgPath, pkg) {
  if (!pkgPath) {
    return (pkg && pkg.name) || '';
  }
  const normalized = pkgPath.replace(/\\/g, '/');
  const lastIndex = normalized.lastIndexOf('node_modules/');
  if (lastIndex !== -1) {
    const subPath = normalized.slice(lastIndex + 'node_modules/'.length);
    const parts = subPath.split('/').filter(Boolean);
    if (parts.length > 0) {
      if (parts[0].startsWith('@') && parts.length > 1) {
        return `${parts[0]}/${parts[1]}`;
      }
      return parts[0];
    }
  }
  return (pkg && pkg.name) || normalized.replace(/^node_modules\/?/, '');
}

/**
 * Extracts license string from package metadata.
 *
 * @param {Object} pkg
 * @returns {string}
 */
function extractLicense(pkg) {
  if (!pkg) return 'UNKNOWN';
  if (typeof pkg.license === 'string' && pkg.license.trim() !== '') {
    return pkg.license.trim();
  }
  if (pkg.license && typeof pkg.license.type === 'string' && pkg.license.type.trim() !== '') {
    return pkg.license.type.trim();
  }
  if (Array.isArray(pkg.licenses) && pkg.licenses.length > 0) {
    const names = pkg.licenses
      .map(l => (typeof l === 'string' ? l : (l && l.type ? l.type : '')))
      .filter(Boolean);
    if (names.length > 0) return names.join(', ');
  }
  return 'UNKNOWN';
}

/**
 * Extracts dependencies map.
 * Returns an object map of dependencies while supporting iteration.
 *
 * @param {Object} pkg
 * @returns {Object}
 */
function extractDeps(pkg) {
  const raw = pkg && pkg.dependencies && typeof pkg.dependencies === 'object' && !Array.isArray(pkg.dependencies)
    ? pkg.dependencies
    : {};
  const deps = { ...raw };

  // Support for..of iterations over dependency names without breaking enumerable keys
  Object.defineProperty(deps, Symbol.iterator, {
    enumerable: false,
    writable: true,
    configurable: true,
    value: function* () {
      yield* Object.keys(this);
    }
  });

  return deps;
}

/**
 * Parses package-lock.json (v2/v3) or package.json into a dependency list.
 *
 * @param {Object|string} lockJson - Parsed JSON object or JSON string
 * @returns {Array<{id: string, name: string, version: string, direct: boolean, hasInstallScript: boolean, license: string, deps: Object}>}
 */
function parseLockfile(lockJson) {
  if (lockJson === null || lockJson === undefined) {
    throw new Error('Invalid input: lockJson argument is required');
  }

  let data = lockJson;
  if (typeof data === 'string') {
    if (data.trim() === '') {
      throw new Error('Invalid input: JSON string cannot be empty');
    }
    try {
      data = JSON.parse(data);
    } catch (err) {
      throw new Error(`Invalid input: failed to parse JSON string: ${err.message}`);
    }
  }

  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    throw new Error('Invalid input: expected a JSON object');
  }

  // If "packages" is present, it must be an object
  if (data.packages !== undefined) {
    if (typeof data.packages !== 'object' || data.packages === null || Array.isArray(data.packages)) {
      throw new Error('Invalid input: "packages" map must be an object');
    }

    const packagesMap = data.packages;
    const rootEntry = packagesMap[''] || {};
    const directNames = new Set();

    if (rootEntry.dependencies && typeof rootEntry.dependencies === 'object') {
      for (const name of Object.keys(rootEntry.dependencies)) {
        directNames.add(name);
      }
    }
    if (rootEntry.devDependencies && typeof rootEntry.devDependencies === 'object') {
      for (const name of Object.keys(rootEntry.devDependencies)) {
        directNames.add(name);
      }
    }

    // Fallback if root entry dependencies are at top level
    if (directNames.size === 0) {
      if (data.dependencies && typeof data.dependencies === 'object') {
        for (const name of Object.keys(data.dependencies)) {
          directNames.add(name);
        }
      }
      if (data.devDependencies && typeof data.devDependencies === 'object') {
        for (const name of Object.keys(data.devDependencies)) {
          directNames.add(name);
        }
      }
    }

    const result = [];

    for (const [pathKey, pkg] of Object.entries(packagesMap)) {
      // Skip root entry
      if (pathKey === '') continue;
      if (!pkg || typeof pkg !== 'object') continue;

      const name = derivePackageName(pathKey, pkg);
      const version = typeof pkg.version === 'string' ? pkg.version : '';
      const id = `${name}@${version}`;

      const normalizedPath = pathKey.replace(/\\/g, '/');
      const isNested = normalizedPath.includes('/node_modules/');
      const direct = Boolean(directNames.has(name) && !isNested);

      const hasInstallScript = Boolean(
        pkg.hasInstallScript ||
        (pkg.scripts && (pkg.scripts.install || pkg.scripts.postinstall || pkg.scripts.preinstall))
      );

      const license = extractLicense(pkg);
      const deps = extractDeps(pkg);

      result.push({
        id,
        name,
        version,
        direct,
        hasInstallScript,
        license,
        deps
      });
    }

    return result;
  }

  // Check if it's an unsupported lockfile format (v1 without packages)
  if (data.lockfileVersion && !data.packages) {
    throw new Error('Invalid input: package-lock.json v2 or v3 with "packages" map is required');
  }

  // Handle package.json only
  const validPackageJsonKeys = [
    'dependencies',
    'devDependencies',
    'peerDependencies',
    'optionalDependencies',
    'name',
    'version',
    'scripts'
  ];
  const hasPackageJsonKey = validPackageJsonKeys.some(key => key in data);
  const isEmptyObject = Object.keys(data).length === 0;

  if (!hasPackageJsonKey && !isEmptyObject) {
    throw new Error('Invalid input: expected package-lock.json (v2/v3) or package.json');
  }

  const result = [];
  const seen = new Set();

  const addDirectDep = (depName, verSpec) => {
    if (!depName || seen.has(depName)) return;
    seen.add(depName);

    const version = typeof verSpec === 'string'
      ? verSpec
      : (verSpec && typeof verSpec.version === 'string' ? verSpec.version : '');
    const id = `${depName}@${version}`;

    result.push({
      id,
      name: depName,
      version,
      direct: true,
      hasInstallScript: false,
      license: 'UNKNOWN',
      deps: extractDeps({})
    });
  };

  if (data.dependencies && typeof data.dependencies === 'object') {
    for (const [depName, verSpec] of Object.entries(data.dependencies)) {
      addDirectDep(depName, verSpec);
    }
  }

  if (data.devDependencies && typeof data.devDependencies === 'object') {
    for (const [depName, verSpec] of Object.entries(data.devDependencies)) {
      addDirectDep(depName, verSpec);
    }
  }

  return result;
}

module.exports = parseLockfile;
module.exports.parseLockfile = parseLockfile;
module.exports.default = parseLockfile;
