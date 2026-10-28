const assert = require('assert');
const { getFlags } = require('./enrich/flags');
const enrichPackages = require('./enrich');
const {
  WEIGHTS,
  scorePackage,
  projectScore,
  gradeFor,
  scoreAfterFix
} = require('./scoring/score');

async function testAll() {
  console.log('=== TEST 1: flags.js getFlags ===');

  // Test 1.1: Missing fields & no crash
  assert.doesNotThrow(() => getFlags(null));
  assert.doesNotThrow(() => getFlags(undefined));
  assert.doesNotThrow(() => getFlags({}));
  assert.doesNotThrow(() => getFlags({ maintainers: 'not-array', lastPublish: 'not-date' }));

  const emptyFlags = getFlags(null);
  assert.deepStrictEqual(emptyFlags.installScripts, []);
  assert.strictEqual(emptyFlags.riskyLicense, true);
  assert(typeof emptyFlags.licenseNote === 'string' && emptyFlags.licenseNote.length > 0);
  assert.strictEqual(emptyFlags.abandoned, false);
  assert.strictEqual(emptyFlags.abandonedReason, '');
  console.log('  ✓ getFlags handles null/undefined/malformed input gracefully');

  // Test 1.2: installScripts
  const pkgWithScripts = {
    scripts: {
      preinstall: 'node pre.js',
      postinstall: 'node post.js',
      test: 'jest'
    }
  };
  const flagScripts = getFlags(pkgWithScripts);
  assert.deepStrictEqual(flagScripts.installScripts, ['preinstall', 'postinstall']);

  const pkgWithArr = { installScripts: ['install', 'custom-script'] };
  assert.deepStrictEqual(getFlags(pkgWithArr).installScripts, ['install']);
  console.log('  ✓ getFlags extracts preinstall/install/postinstall correctly');

  // Test 1.3: riskyLicense
  const gplPkg = getFlags({ license: 'GPL-3.0' });
  assert.strictEqual(gplPkg.riskyLicense, true);
  assert(gplPkg.licenseNote.includes('GPL-3.0'));

  const agplPkg = getFlags({ license: 'AGPL-1.0' });
  assert.strictEqual(agplPkg.riskyLicense, true);

  const lgplPkg = getFlags({ license: 'LGPL-2.1' });
  assert.strictEqual(lgplPkg.riskyLicense, true);

  const ssplPkg = getFlags({ license: 'SSPL-1.0' });
  assert.strictEqual(ssplPkg.riskyLicense, true);

  const unlicPkg = getFlags({ license: 'UNLICENSED' });
  assert.strictEqual(unlicPkg.riskyLicense, true);

  const missingPkg = getFlags({ license: '' });
  assert.strictEqual(missingPkg.riskyLicense, true);

  const unknownPkg = getFlags({ license: 'UNKNOWN' });
  assert.strictEqual(unknownPkg.riskyLicense, true);

  const mitPkg = getFlags({ license: 'MIT' });
  assert.strictEqual(mitPkg.riskyLicense, false);

  const apachePkg = getFlags({ license: 'Apache-2.0' });
  assert.strictEqual(apachePkg.riskyLicense, false);
  console.log('  ✓ getFlags accurately identifies risky vs permissive licenses');

  // Test 1.4: abandoned and abandonedReason
  // Older than 2 years
  const oldDate = new Date(Date.now() - 3 * 365.25 * 86400000).toISOString();
  const freshDate = new Date(Date.now() - 30 * 86400000).toISOString();

  const oldPkg = getFlags({ lastPublish: oldDate, maintainers: ['a', 'b'] });
  assert.strictEqual(oldPkg.abandoned, true);
  assert(oldPkg.abandonedReason.includes('2 years'));

  // Single maintainer
  const singleMaintPkg = getFlags({ lastPublish: freshDate, maintainers: [{ name: 'bob' }] });
  assert.strictEqual(singleMaintPkg.abandoned, true);
  assert(singleMaintPkg.abandonedReason.includes('maintainer'));

  // Both
  const bothPkg = getFlags({ lastPublish: oldDate, maintainers: ['alice'] });
  assert.strictEqual(bothPkg.abandoned, true);
  assert(bothPkg.abandonedReason.includes('2 years') && bothPkg.abandonedReason.includes('maintainer'));

  // Neither
  const activePkg = getFlags({ lastPublish: freshDate, maintainers: ['alice', 'bob'] });
  assert.strictEqual(activePkg.abandoned, false);
  assert.strictEqual(activePkg.abandonedReason, '');
  console.log('  ✓ getFlags correctly detects abandoned status & reason');

  console.log('\n=== TEST 2: WEIGHTS & scorePackage ===');
  assert(WEIGHTS, 'WEIGHTS must exist');
  assert.strictEqual(WEIGHTS.vulns.max, 40);
  assert.strictEqual(WEIGHTS.deprecated.max, 20);
  assert.strictEqual(WEIGHTS.stale.max, 15);
  assert.strictEqual(WEIGHTS.scripts.max, 10);
  assert.strictEqual(WEIGHTS.license.max, 15);
  console.log('  ✓ WEIGHTS object defined correctly');

  // Vulnerability scoring tests
  // Critical = 40
  const critResult = scorePackage({ vulns: [{ id: 'V1', severity: 'critical' }] });
  assert.strictEqual(critResult.scoreBreakdown.vulns, 40);

  // High = 30
  const highResult = scorePackage({ vulns: [{ id: 'V1', severity: 'high' }] });
  assert.strictEqual(critResult.scoreBreakdown.vulns, 40);
  assert.strictEqual(highResult.scoreBreakdown.vulns, 30);

  // Medium = 15
  const medResult = scorePackage({ vulns: [{ id: 'V1', severity: 'medium' }] });
  assert.strictEqual(medResult.scoreBreakdown.vulns, 15);

  // Low = 5
  const lowResult = scorePackage({ vulns: [{ id: 'V1', severity: 'low' }] });
  assert.strictEqual(lowResult.scoreBreakdown.vulns, 5);

  // Multiple vulns: highest + 2 per extra, capped at 40
  // high (30) + 2 extras (4) = 34
  const multiResult = scorePackage({
    vulns: [
      { id: 'V1', severity: 'low' },
      { id: 'V2', severity: 'high' },
      { id: 'V3', severity: 'medium' }
    ]
  });
  assert.strictEqual(multiResult.scoreBreakdown.vulns, 34);

  // High (30) + 6 extras (12) = 42 -> capped at 40
  const cappedResult = scorePackage({
    vulns: Array.from({ length: 7 }, (_, i) => ({ id: `V${i}`, severity: i === 0 ? 'high' : 'low' }))
  });
  assert.strictEqual(cappedResult.scoreBreakdown.vulns, 40);
  console.log('  ✓ Vuln scoring (critical 40, high 30, med 15, low 5, +2/extra, cap 40) verified');

  // Deprecated scoring: 20
  const depResult = scorePackage({ deprecated: 'deprecated package' });
  assert.strictEqual(depResult.scoreBreakdown.deprecated, 20);
  const notDepResult = scorePackage({ deprecated: false });
  assert.strictEqual(notDepResult.scoreBreakdown.deprecated, 0);

  // Scripts scoring: 10
  const scriptResult = scorePackage({ installScripts: ['postinstall'] });
  assert.strictEqual(scriptResult.scoreBreakdown.scripts, 10);
  const noScriptResult = scorePackage({ installScripts: [] });
  assert.strictEqual(noScriptResult.scoreBreakdown.scripts, 0);

  // License scoring: 15
  const riskyLicResult = scorePackage({ riskyLicense: true });
  assert.strictEqual(riskyLicResult.scoreBreakdown.license, 15);
  const safeLicResult = scorePackage({ riskyLicense: false });
  assert.strictEqual(safeLicResult.scoreBreakdown.license, 0);

  // Stale scoring: max 15 (scaled by age + single maintainer)
  const freshMultiMaint = scorePackage({ lastPublish: freshDate, maintainers: ['a', 'b'] });
  assert.strictEqual(freshMultiMaint.scoreBreakdown.stale, 0);

  const freshSingleMaint = scorePackage({ lastPublish: freshDate, maintainers: ['a'] });
  assert.strictEqual(freshSingleMaint.scoreBreakdown.stale, 5);

  const oldMultiMaint = scorePackage({ lastPublish: oldDate, maintainers: ['a', 'b'] });
  assert(oldMultiMaint.scoreBreakdown.stale > 0);

  // Total score cap & breakdown sum
  const maxPkg = {
    vulns: [{ id: 'V1', severity: 'critical' }],
    deprecated: true,
    lastPublish: new Date(Date.now() - 10 * 365 * 86400000).toISOString(),
    maintainers: ['a'],
    installScripts: ['preinstall'],
    riskyLicense: true
  };
  const maxScoreResult = scorePackage(maxPkg);
  assert.strictEqual(maxScoreResult.scoreBreakdown.vulns, 40);
  assert.strictEqual(maxScoreResult.scoreBreakdown.deprecated, 20);
  assert.strictEqual(maxScoreResult.scoreBreakdown.stale, 15);
  assert.strictEqual(maxScoreResult.scoreBreakdown.scripts, 10);
  assert.strictEqual(maxScoreResult.scoreBreakdown.license, 15);
  assert.strictEqual(maxScoreResult.score, 100);
  console.log('  ✓ Max score breakdown (40 + 20 + 15 + 10 + 15 = 100) verified');

  console.log('\n=== TEST 3: projectScore, gradeFor, scoreAfterFix ===');
  // gradeFor: A <20, B <40, C <60, D <80, else F
  assert.strictEqual(gradeFor(0), 'A');
  assert.strictEqual(gradeFor(19), 'A');
  assert.strictEqual(gradeFor(20), 'B');
  assert.strictEqual(gradeFor(39), 'B');
  assert.strictEqual(gradeFor(40), 'C');
  assert.strictEqual(gradeFor(59), 'C');
  assert.strictEqual(gradeFor(60), 'D');
  assert.strictEqual(gradeFor(79), 'D');
  assert.strictEqual(gradeFor(80), 'F');
  assert.strictEqual(gradeFor(100), 'F');
  console.log('  ✓ gradeFor boundary tests passed (A <20, B <40, C <60, D <80, else F)');

  // projectScore: average of top 10 package scores, 0-100
  const sampleScores = [90, 80, 70, 60, 50, 40, 30, 20, 10, 0, 0, 0];
  const pkgs = sampleScores.map((score, i) => ({ id: `p${i}`, name: `p${i}`, score }));
  // Top 10 are 90, 80, 70, 60, 50, 40, 30, 20, 10, 0 -> sum = 450, avg = 45
  assert.strictEqual(projectScore(pkgs), 45);
  console.log('  ✓ projectScore computes average of top 10 package scores');

  // scoreAfterFix(packages, removedIds)
  // Remove p0 (90) and p1 (80). Top 10 will now include the lower packages.
  const afterFixScore = scoreAfterFix(pkgs, ['p0', 'p1']);
  assert(afterFixScore < 45, `Expected score after fix to be lower, got ${afterFixScore}`);
  console.log(`  ✓ scoreAfterFix: reduced project score from 45 to ${afterFixScore}`);

  console.log('\n=== TEST 4: enrichPackages integrates getFlags ===');
  const enrichedList = await enrichPackages([
    { id: 'lodash@4.17.15', name: 'lodash', version: '4.17.15' }
  ]);
  assert.strictEqual(enrichedList.length, 1);
  const enrichedItem = enrichedList[0];
  assert('riskyLicense' in enrichedItem, 'riskyLicense must be merged');
  assert('licenseNote' in enrichedItem, 'licenseNote must be merged');
  assert('abandoned' in enrichedItem, 'abandoned must be merged');
  assert('abandonedReason' in enrichedItem, 'abandonedReason must be merged');
  assert(Array.isArray(enrichedItem.installScripts), 'installScripts must be merged');
  console.log('  ✓ enrichPackages merged flags correctly into package:', {
    riskyLicense: enrichedItem.riskyLicense,
    licenseNote: enrichedItem.licenseNote,
    abandoned: enrichedItem.abandoned,
    abandonedReason: enrichedItem.abandonedReason,
    installScripts: enrichedItem.installScripts
  });

  console.log('\nALL FLAGS & SCORING TESTS PASSED!');
}

testAll().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
