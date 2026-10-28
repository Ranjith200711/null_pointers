const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const parseLockfile = require('../graph/parser');
const { buildGraph } = require('../graph/builder');
const { bestUpgrade } = require('../graph/fix');
const { enrichPackages } = require('../enrich');
const { scorePackage, calculateProjectScore } = require('../scoring');

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB
});

/**
 * Executes the complete analysis pipeline for a lockfile / package.json content.
 *
 * @param {string|Object} content - Raw JSON string or object
 * @returns {Promise<Object>} Analysis report
 */
async function processLockfile(content) {
  if (content === null || content === undefined) {
    const err = new Error('Empty file content');
    err.status = 400;
    throw err;
  }

  if (typeof content === 'string' && content.trim() === '') {
    const err = new Error('Empty file content');
    err.status = 400;
    throw err;
  }

  // 1. Parse lockfile or package.json
  let rawPackages;
  try {
    rawPackages = parseLockfile(content);
  } catch (err) {
    err.status = 400;
    throw err;
  }

  // 2. Build dependency graphs
  const { forward, nodes, edges, blastRadiusMap } = buildGraph(rawPackages);

  // 3. Enrich packages with vulnerability & release metadata
  const enriched = await enrichPackages(rawPackages);

  // 4. Score packages
  const scoresMap = {};
  const scoredPackages = enriched.map(pkg => {
    const scoringResult = scorePackage(pkg);
    scoresMap[pkg.id] = scoringResult.score;

    return {
      id: pkg.id,
      direct: Boolean(pkg.direct),
      vulns: pkg.vulns || [],
      deprecated: pkg.deprecated || false,
      lastPublish: pkg.lastPublish || null,
      license: pkg.license || 'UNKNOWN',
      installScripts: Boolean(pkg.hasInstallScript || pkg.installScripts),
      score: scoringResult.score,
      scoreBreakdown: scoringResult.scoreBreakdown,
      blastRadius: blastRadiusMap.get(pkg.id) || 0
    };
  });

  // 5. Calculate overall project score and letter grade
  const { projectScore, grade } = calculateProjectScore(scoredPackages);

  // 6. Calculate best upgrade recommendation
  const fix = bestUpgrade(rawPackages, forward, scoresMap);

  return {
    projectScore,
    grade,
    fix,
    packages: scoredPackages,
    graph: {
      nodes,
      edges
    }
  };
}

/**
 * POST /analyze
 * Accepts multipart file upload OR JSON body { filePath }
 */
router.post('/analyze', upload.any(), async (req, res) => {
  try {
    let content = null;

    // Check for uploaded file
    const file = (req.files && req.files.length > 0) ? req.files[0] : req.file;
    if (file) {
      if (!file.buffer || file.buffer.length === 0) {
        return res.status(400).json({ error: 'Uploaded file is empty' });
      }
      content = file.buffer.toString('utf8');
      if (!content || content.trim() === '') {
        return res.status(400).json({ error: 'Uploaded file is empty' });
      }
    } else if (req.body && req.body.filePath) {
      // Check for filePath in JSON body
      const resolvedPath = path.resolve(req.body.filePath);
      if (!fs.existsSync(resolvedPath)) {
        return res.status(400).json({ error: `File not found at path: ${req.body.filePath}` });
      }
      content = fs.readFileSync(resolvedPath, 'utf8');
      if (!content || content.trim() === '') {
        return res.status(400).json({ error: 'File is empty' });
      }
    } else if (req.body && req.body.content) {
      content = req.body.content;
      if (!content || (typeof content === 'string' && content.trim() === '')) {
        return res.status(400).json({ error: 'File content is empty' });
      }
    } else {
      return res.status(400).json({
        error: 'No file uploaded or filePath provided in request'
      });
    }

    const report = await processLockfile(content);
    return res.json(report);
  } catch (err) {
    const isBadRequest =
      err.status === 400 ||
      /invalid/i.test(err.message) ||
      /empty/i.test(err.message) ||
      /JSON/i.test(err.message) ||
      /parse/i.test(err.message);

    return res.status(isBadRequest ? 400 : 500).json({
      error: err.message || 'An unexpected error occurred during analysis'
    });
  }
});

/**
 * GET /sample
 * Runs the analysis flow on /samples/package-lock.json
 */
router.get('/sample', async (req, res) => {
  try {
    const candidatePaths = [
      path.resolve(__dirname, '../../samples/package-lock.json'),
      path.resolve(__dirname, '../samples/package-lock.json'),
      path.resolve(process.cwd(), 'samples/package-lock.json'),
      path.resolve(process.cwd(), '../samples/package-lock.json'),
      path.resolve(process.cwd(), 'server/package-lock.json'),
      path.resolve(__dirname, '../package-lock.json')
    ];

    let samplePath = candidatePaths.find(p => fs.existsSync(p));
    if (!samplePath) {
      return res.status(404).json({ error: 'Sample package-lock.json not found' });
    }

    const content = fs.readFileSync(samplePath, 'utf8');
    if (!content || content.trim() === '') {
      return res.status(400).json({ error: 'Sample lockfile is empty' });
    }

    const report = await processLockfile(content);
    return res.json(report);
  } catch (err) {
    return res.status(500).json({
      error: err.message || 'Failed to process sample package-lock.json'
    });
  }
});

module.exports = router;
module.exports.processLockfile = processLockfile;
