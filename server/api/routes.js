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
      installScripts: Boolean(pkg.hasInstallScript || (Array.isArray(pkg.installScripts) ? pkg.installScripts.length > 0 : pkg.installScripts)),
      dataUnavailable: Boolean(pkg.dataUnavailable),
      riskyLicense: Boolean(pkg.riskyLicense),
      licenseNote: pkg.licenseNote || '',
      abandoned: Boolean(pkg.abandoned),
      abandonedReason: pkg.abandonedReason || '',
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
 * Fetches package-lock.json or package.json from a GitHub repository or raw URL.
 *
 * @param {string} inputUrl - GitHub repository or file URL
 * @returns {Promise<string>} File content
 */
async function fetchFromGithub(inputUrl) {
  const url = inputUrl.trim();

  // 1. Direct raw.githubusercontent.com URL
  if (url.includes('raw.githubusercontent.com')) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to fetch from GitHub: HTTP ${res.status}`);
    return await res.text();
  }

  // 2. Direct GitHub blob URL (e.g. github.com/owner/repo/blob/branch/path)
  const blobMatch = url.match(/github\.com\/([^/]+)\/([^/]+)\/blob\/([^/]+)\/(.+)/i);
  if (blobMatch) {
    const [, owner, repo, branch, filePath] = blobMatch;
    const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${filePath}`;
    const res = await fetch(rawUrl);
    if (!res.ok) throw new Error(`Failed to fetch from GitHub: HTTP ${res.status}`);
    return await res.text();
  }

  // 3. GitHub Repository Root URL (e.g. https://github.com/owner/repo)
  const repoMatch = url.match(/github\.com\/([^/]+)\/([^/]+)/i);
  if (!repoMatch) {
    throw new Error(`Invalid GitHub repository URL: ${inputUrl}`);
  }

  const owner = repoMatch[1];
  const repo = repoMatch[2].replace(/\.git$/i, '').split('/')[0];

  const branches = ['main', 'master'];
  const fileCandidates = [
    'package-lock.json',
    'package.json',
    'server/package-lock.json',
    'client/package-lock.json',
    'samples/package-lock.json'
  ];

  for (const branch of branches) {
    for (const file of fileCandidates) {
      try {
        const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${file}`;
        const res = await fetch(rawUrl);
        if (res.ok) {
          const text = await res.text();
          if (text && text.trim().startsWith('{')) {
            return text;
          }
        }
      } catch (err) {
        // try next candidate
      }
    }
  }

  throw new Error(`Could not find a package-lock.json or package.json in GitHub repository: ${inputUrl}`);
}

/**
 * Reads a package-lock.json or package.json from a local system folder or file path.
 *
 * @param {string} inputPath - File or folder path on local disk
 * @returns {string} File content
 */
function readFromSystemPath(inputPath) {
  const resolved = path.resolve(inputPath.trim());
  if (!fs.existsSync(resolved)) {
    throw new Error(`Path does not exist on system: ${inputPath}`);
  }

  const stat = fs.statSync(resolved);
  if (stat.isFile()) {
    const content = fs.readFileSync(resolved, 'utf8');
    if (!content || !content.trim()) {
      throw new Error(`File is empty: ${inputPath}`);
    }
    return content;
  }

  if (stat.isDirectory()) {
    const candidates = [
      path.join(resolved, 'package-lock.json'),
      path.join(resolved, 'package.json'),
      path.join(resolved, 'server', 'package-lock.json'),
      path.join(resolved, 'client', 'package-lock.json'),
      path.join(resolved, 'samples', 'package-lock.json')
    ];

    for (const cand of candidates) {
      if (fs.existsSync(cand) && fs.statSync(cand).isFile()) {
        const content = fs.readFileSync(cand, 'utf8');
        if (content && content.trim()) {
          return content;
        }
      }
    }

    throw new Error(`No package-lock.json or package.json found in directory: ${inputPath}`);
  }

  throw new Error(`Path is not a regular file or directory: ${inputPath}`);
}

/**
 * POST /analyze
 * Accepts multipart file upload OR JSON body { filePath, folderPath, githubUrl, content }
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
    } else if (req.body && req.body.githubUrl) {
      content = await fetchFromGithub(req.body.githubUrl);
    } else if (req.body && req.body.folderPath) {
      content = readFromSystemPath(req.body.folderPath);
    } else if (req.body && req.body.filePath) {
      const target = req.body.filePath.trim();
      if (/^https?:\/\/|github\.com/i.test(target)) {
        content = await fetchFromGithub(target);
      } else {
        content = readFromSystemPath(target);
      }
    } else if (req.body && req.body.content) {
      content = req.body.content;
      if (!content || (typeof content === 'string' && content.trim() === '')) {
        return res.status(400).json({ error: 'File content is empty' });
      }
    } else {
      return res.status(400).json({
        error: 'No file uploaded, system path, or GitHub URL provided in request'
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
      /parse/i.test(err.message) ||
      /not found/i.test(err.message) ||
      /exist/i.test(err.message);

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
