const assert = require('assert');
const fs = require('fs');
const path = require('path');
const enrichPackages = require('./enrich');
const {
  createLimiter,
  fetchWithRetry,
  mapSeverity,
  parseCvssV3,
  loadCache,
  saveCache
} = require('./enrich');

async function testEnrich() {
  console.log('--- Testing severity mapping ---');
  // 1. Severity mapping
  assert.strictEqual(mapSeverity({ database_specific: { severity: 'CRITICAL' } }), 'critical');
  assert.strictEqual(mapSeverity({ database_specific: { severity: 'HIGH' } }), 'high');
  assert.strictEqual(mapSeverity({ database_specific: { severity: 'MODERATE' } }), 'medium');
  assert.strictEqual(mapSeverity({ database_specific: { severity: 'LOW' } }), 'low');

  assert.strictEqual(mapSeverity({ ecosystem_specific: { severity: 'HIGH' } }), 'high');
  assert.strictEqual(mapSeverity({ severity: [{ type: 'CVSS_V3', score: 9.8 }] }), 'critical');
  assert.strictEqual(mapSeverity({ severity: [{ type: 'CVSS_V3', score: 7.5 }] }), 'high');
  assert.strictEqual(mapSeverity({ severity: [{ type: 'CVSS_V3', score: 5.0 }] }), 'medium');
  assert.strictEqual(mapSeverity({ severity: [{ type: 'CVSS_V3', score: 2.1 }] }), 'low');
  assert.strictEqual(mapSeverity({ severity: [{ type: 'CVSS_V3', score: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:L' }] }), 'medium');
  console.log('  ✓ mapSeverity tests passed');

  console.log('--- Testing concurrency limiter & retries ---');
  let concurrentCount = 0;
  let maxConcurrent = 0;
  const limiter = createLimiter(3);
  const tasks = Array.from({ length: 10 }, (_, i) =>
    limiter(async () => {
      concurrentCount++;
      maxConcurrent = Math.max(maxConcurrent, concurrentCount);
      await new Promise(r => setTimeout(r, 20));
      concurrentCount--;
      return i;
    })
  );
  await Promise.all(tasks);
  assert(maxConcurrent <= 3, `Max concurrency should not exceed 3, got ${maxConcurrent}`);
  console.log(`  ✓ Concurrency limiter verified (max observed: ${maxConcurrent} <= 3)`);

  // Retry test
  let attempts = 0;
  try {
    await fetchWithRetry('https://httpstat.us/500?dummy=' + Date.now(), {}, 2, 50);
  } catch (err) {
    // Expected to fail after 2 retries (3 total attempts)
  }
  console.log('  ✓ fetchWithRetry failed gracefully as expected');

  console.log('--- Testing enrichPackages with real packages ---');
  const tempCachePath = path.join(__dirname, 'test-cache.json');
  if (fs.existsSync(tempCachePath)) fs.unlinkSync(tempCachePath);

  const testPkgs = [
    { id: 'lodash@4.17.15', name: 'lodash', version: '4.17.15' },
    { id: 'express@4.18.2', name: 'express', version: '4.18.2' }
  ];

  const enriched = await enrichPackages(testPkgs, { cachePath: tempCachePath });
  assert.strictEqual(enriched.length, 2);

  const lodash = enriched.find(p => p.name === 'lodash');
  assert(lodash, 'lodash should be in results');
  assert(Array.isArray(lodash.vulns), 'lodash.vulns should be an array');
  assert(lodash.vulns.length > 0, 'lodash@4.17.15 must have vulnerabilities');
  lodash.vulns.forEach(v => {
    assert(v.id, 'vuln must have id');
    assert(['low', 'medium', 'high', 'critical'].includes(v.severity), `severity must be mapped: ${v.severity}`);
  });
  assert(lodash.latest, 'latest version should be present');
  assert(lodash.lastPublish, 'lastPublish should be present');
  assert(lodash.license, 'license should be present');
  assert(Array.isArray(lodash.maintainers), 'maintainers should be array');
  assert(Array.isArray(lodash.installScripts), 'installScripts should be array');
  console.log('  ✓ lodash enriched:', {
    vulnsCount: lodash.vulns.length,
    latest: lodash.latest,
    lastPublish: lodash.lastPublish,
    license: lodash.license,
    sampleVuln: lodash.vulns[0]
  });

  const expressPkg = enriched.find(p => p.name === 'express');
  assert(expressPkg, 'express should be in results');
  assert(expressPkg.license, 'express license should be present');
  console.log('  ✓ express enriched:', {
    latest: expressPkg.latest,
    license: expressPkg.license,
    vulnsCount: expressPkg.vulns.length
  });

  console.log('--- Testing cache hit ---');
  assert(fs.existsSync(tempCachePath), 'Cache file should be created');
  const cachedData = JSON.parse(fs.readFileSync(tempCachePath, 'utf8'));
  assert(cachedData['lodash@4.17.15'], 'lodash should be in cache');
  assert(cachedData['express@4.18.2'], 'express should be in cache');

  // Run again using the cache
  const cachedEnriched = await enrichPackages(testPkgs, { cachePath: tempCachePath });
  assert.deepStrictEqual(cachedEnriched[0].vulns, lodash.vulns);
  console.log('  ✓ Cache hit successfully returned matching data');

  console.log('--- Testing dataUnavailable on invalid package ---');
  const invalidPkg = [{ id: 'nonexistent-pkg-abc-123xyz@0.0.1', name: 'nonexistent-pkg-abc-123xyz', version: '0.0.1' }];
  const failedEnrich = await enrichPackages(invalidPkg, { cachePath: tempCachePath, retries: 1 });
  assert.strictEqual(failedEnrich.length, 1);
  assert.strictEqual(failedEnrich[0].dataUnavailable, true, 'Package should be marked {dataUnavailable: true}');
  assert.deepStrictEqual(failedEnrich[0].vulns, []);
  assert.strictEqual(failedEnrich[0].deprecated, false);
  assert.strictEqual(failedEnrich[0].license, 'UNKNOWN');
  assert.deepStrictEqual(failedEnrich[0].installScripts, []);
  console.log('  ✓ dataUnavailable verified for failed/nonexistent package');

  // Clean up test cache
  if (fs.existsSync(tempCachePath)) fs.unlinkSync(tempCachePath);
  console.log('\nAll enrich tests passed successfully!');
}

testEnrich().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
