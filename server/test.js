const fs = require('fs');
const path = require('path');
const http = require('http');
const assert = require('assert');

const app = require('./index');
const parseLockfile = require('./graph/parser');
const { buildGraph } = require('./graph/builder');
const { bestUpgrade, createDummyScores } = require('./graph/fix');
const { processLockfile } = require('./api/routes');

console.log('==============================================');
console.log('       NULL_POINTERS SERVER TEST SUITE        ');
console.log('==============================================\n');

async function runTests() {
  // 1. Locate sample lockfile
  const samplePaths = [
    path.resolve(__dirname, '../samples/package-lock.json'),
    path.resolve(__dirname, 'samples/package-lock.json'),
    path.resolve(__dirname, 'package-lock.json')
  ];

  const samplePath = samplePaths.find(p => fs.existsSync(p));
  assert(samplePath, 'Sample package-lock.json must exist');
  console.log(`[1] Loaded sample lockfile: ${samplePath}`);

  const sampleContent = fs.readFileSync(samplePath, 'utf8');

  // Run parser
  const packages = parseLockfile(sampleContent);
  console.log(`    - Parsed packages count: ${packages.length}`);
  assert(packages.length > 0, 'Packages count must be > 0');

  // Run graph builder & blast radius
  const { forward, reverse, nodes, edges, blastRadiusMap } = buildGraph(packages);
  console.log(`    - Graph nodes count:    ${nodes.length}`);
  console.log(`    - Graph edges count:    ${edges.length}`);

  let maxBlast = 0;
  let maxBlastPkg = null;
  for (const [pkgId, radius] of blastRadiusMap.entries()) {
    if (radius > maxBlast) {
      maxBlast = radius;
      maxBlastPkg = pkgId;
    }
  }
  console.log(`    - Max blast radius:     ${maxBlast} (${maxBlastPkg})`);

  // Run bestUpgrade
  const dummyScores = createDummyScores(packages);
  const upgrade = bestUpgrade(packages, forward, dummyScores);
  console.log(`    - Best upgrade candidate: ${upgrade ? `${upgrade.package} (risk: ${upgrade.risk})` : 'None'}`);

  // Run full pipeline
  const report = await processLockfile(sampleContent);
  console.log(`    - Project Score:         ${report.projectScore}`);
  console.log(`    - Project Grade:         ${report.grade}`);
  console.log(`    - Report packages count: ${report.packages.length}`);
  console.log(`    - Report graph nodes:    ${report.graph.nodes.length}`);
  console.log(`    - Report graph edges:    ${report.graph.edges.length}\n`);

  console.log('[2] Testing Edge Cases:');

  // Edge case 1: Empty file
  console.log('    [Edge Case 1] Empty file / empty string');
  assert.throws(() => parseLockfile(''), /Invalid input/);
  assert.throws(() => parseLockfile('   '), /Invalid input/);
  console.log('      ✓ Correctly throws on empty input');

  // Edge case 2: Invalid JSON
  console.log('    [Edge Case 2] Invalid JSON');
  assert.throws(() => parseLockfile('{ "broken: true '), /Invalid input/);
  console.log('      ✓ Correctly throws on invalid JSON');

  // Edge case 3: Lockfile with no dependencies
  console.log('    [Edge Case 3] Lockfile with no dependencies');
  const emptyLock = {
    name: 'empty-project',
    version: '1.0.0',
    lockfileVersion: 3,
    packages: {
      '': {
        name: 'empty-project',
        version: '1.0.0'
      }
    }
  };
  const emptyPkgs = parseLockfile(emptyLock);
  assert.strictEqual(emptyPkgs.length, 0, 'Empty lockfile should return 0 packages');
  const emptyGraph = buildGraph(emptyPkgs);
  assert.strictEqual(emptyGraph.nodes.length, 0);
  assert.strictEqual(emptyGraph.edges.length, 0);
  const emptyUpgrade = bestUpgrade(emptyPkgs, emptyGraph.forward, {});
  assert.strictEqual(emptyUpgrade, null);
  console.log('      ✓ Handled 0-dependency lockfile cleanly (0 packages, 0 nodes, 0 edges, null upgrade)');

  // Edge case 4: Circular dependencies
  console.log('    [Edge Case 4] Circular dependencies');
  const circularLock = {
    name: 'circular-project',
    version: '1.0.0',
    lockfileVersion: 3,
    packages: {
      '': {
        dependencies: { 'pkg-a': '^1.0.0' }
      },
      'node_modules/pkg-a': {
        version: '1.0.0',
        license: 'MIT',
        dependencies: { 'pkg-b': '^1.0.0' }
      },
      'node_modules/pkg-b': {
        version: '1.0.0',
        license: 'MIT',
        dependencies: { 'pkg-a': '^1.0.0' }
      }
    }
  };

  const circPkgs = parseLockfile(circularLock);
  assert.strictEqual(circPkgs.length, 2, 'Should parse both circular packages');
  const circGraph = buildGraph(circPkgs);
  assert.strictEqual(circGraph.nodes.length, 2);
  assert.strictEqual(circGraph.edges.length, 2);

  const circScores = { 'pkg-a@1.0.0': 30, 'pkg-b@1.0.0': 20 };
  const circUpgrade = bestUpgrade(circPkgs, circGraph.forward, circScores);
  assert(circUpgrade !== null, 'Circular dependency should resolve upgrade candidate');
  assert.strictEqual(circUpgrade.package, 'pkg-a');
  console.log(`      ✓ Handled circular dependencies cleanly (Upgrade: ${circUpgrade.package}, risk: ${circUpgrade.risk})\n`);

  console.log('[3] Testing HTTP Endpoints:');

  // Start temporary server on random port
  const server = await new Promise(resolve => {
    const s = app.listen(0, () => resolve(s));
  });
  const port = server.address().port;

  const request = (endpoint, options = {}) => new Promise((resolve, reject) => {
    const req = http.request(`http://localhost:${port}${endpoint}`, options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
    req.on('error', reject);
    if (options.data) req.write(options.data);
    req.end();
  });

  try {
    // 1. GET /health
    const healthRes = await request('/health');
    assert.strictEqual(healthRes.status, 200);
    assert.strictEqual(healthRes.body.ok, true);
    console.log('    ✓ GET /health -> 200 OK');

    // 2. GET /sample
    const sampleRes = await request('/sample');
    assert.strictEqual(sampleRes.status, 200);
    assert(Array.isArray(sampleRes.body.packages));
    assert(sampleRes.body.packages.length > 0);
    console.log(`    ✓ GET /sample -> 200 OK (${sampleRes.body.packages.length} packages parsed)`);

    // 3. POST /analyze with filePath
    const analyzePathRes = await request('/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      data: JSON.stringify({ filePath: samplePath })
    });
    assert.strictEqual(analyzePathRes.status, 200);
    assert(analyzePathRes.body.grade);
    assert(analyzePathRes.body.graph.nodes.length > 0);
    console.log('    ✓ POST /analyze (filePath) -> 200 OK');

    // 4. POST /analyze with multipart file upload
    const boundary = '----NullPointersFormBoundary' + Math.random().toString(36).substring(2);
    const fileHeader = `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="package-lock.json"\r\nContent-Type: application/json\r\n\r\n`;
    const fileFooter = `\r\n--${boundary}--\r\n`;
    const multipartBody = Buffer.concat([
      Buffer.from(fileHeader, 'utf8'),
      Buffer.from(sampleContent, 'utf8'),
      Buffer.from(fileFooter, 'utf8')
    ]);

    const multipartRes = await request('/analyze', {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': multipartBody.length
      },
      data: multipartBody
    });
    assert.strictEqual(multipartRes.status, 200);
    assert(multipartRes.body.packages.length > 0);
    console.log('    ✓ POST /analyze (multipart upload) -> 200 OK');

    // 5. POST /analyze with empty body -> 400
    const emptyRes = await request('/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      data: JSON.stringify({})
    });
    assert.strictEqual(emptyRes.status, 400);
    assert(emptyRes.body.error);
    console.log('    ✓ POST /analyze (empty input) -> 400 Bad Request');

    // 6. POST /analyze with invalid JSON -> 400
    const invalidRes = await request('/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      data: JSON.stringify({ content: '{ malformed json' })
    });
    assert.strictEqual(invalidRes.status, 400);
    assert(invalidRes.body.error);
    console.log('    ✓ POST /analyze (invalid JSON) -> 400 Bad Request');
  } finally {
    server.close();
  }

  console.log('\n==============================================');
  console.log('         ALL TESTS PASSED SUCCESSFULLY!       ');
  console.log('==============================================');
}

runTests().catch(err => {
  console.error('\nTest suite failed:', err);
  process.exit(1);
});
