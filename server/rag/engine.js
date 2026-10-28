const { retrieveContext } = require('./retriever');

/**
 * Checks whether a user query is related to the dependency dataset / security domain.
 *
 * @param {string} query
 * @param {Object} retrieved
 * @returns {boolean}
 */
function isQueryRelevant(query, retrieved) {
  const q = query.toLowerCase().trim();

  // 1. Any package from the dataset matched in query
  if (retrieved.matchedPackages && retrieved.matchedPackages.length > 0) {
    return true;
  }

  // 2. Greetings and capability inquiries
  const conversationalTerms = [
    'hi', 'hello', 'hey', 'help', 'who are you', 'what can you do',
    'how does this work', 'what is this'
  ];
  if (conversationalTerms.some(term => q === term || q.startsWith(term + ' ') || q.endsWith(' ' + term))) {
    return true;
  }

  // 3. Domain-specific security & dependency keywords
  const domainKeywords = [
    'package', 'packages', 'depend', 'dependency', 'dependencies',
    'lockfile', 'npm', 'node', 'cve', 'vuln', 'vulns', 'vulnerability',
    'vulnerabilities', 'blast', 'radius', 'risk', 'score', 'scores',
    'grade', 'upgrade', 'upgrades', 'fix', 'fixes', 'install', 'installed',
    'script', 'scripts', 'license', 'licenses', 'transitive', 'direct',
    'abandon', 'abandoned', 'deprecat', 'deprecated', 'deprecation',
    'graph', 'version', 'versions', 'modules', 'supply chain', 'security',
    'summary', 'overview', 'critical', 'high', 'medium', 'low', 'stale',
    'audit', 'chain', 'path', 'exposure', 'root', 'tree'
  ];

  return domainKeywords.some(keyword => q.includes(keyword));
}

/**
 * Builds the fallback response for questions outside the uploaded dataset.
 *
 * @param {Object} retrieved
 * @returns {Object}
 */
function buildOutOfDomainResponse(retrieved) {
  const summary = retrieved.projectSummary;
  const fix = retrieved.fixRecommendation;
  const topRisks = retrieved.highestRisk || [];
  const topBlast = retrieved.highestBlastRadius || [];

  const samplePkg = topRisks[0]?.name || topBlast[0]?.name || 'express';
  const sampleBlastPkg = topBlast[0]?.name || 'statuses';

  let reply = `Sorry, I can't provide an answer to that question. I am exclusively specialized in analyzing your uploaded project's dependency dataset, vulnerability posture, and graph security risks.\n\n`;
  reply += `### 💡 Here are some recommended questions about your dataset:\n\n`;

  if (summary) {
    reply += `1. *"Why is my project score at **${summary.projectScore}** (Grade **${summary.grade}**)?"*\n`;
  } else {
    reply += `1. *"Can you give me an overview of my project's security grade and score?"*\n`;
  }

  if (fix && fix.command) {
    reply += `2. *"Explain the recommended fix: \`${fix.command}\` and why it removes ${fix.risk} risk points?"*\n`;
  } else {
    reply += `2. *"What is the single best upgrade to reduce risk in my tree?"*\n`;
  }

  reply += `3. *"What is the blast radius of \`${sampleBlastPkg}\` and who pulls it in?"*\n`;
  reply += `4. *"Why is \`${samplePkg}\` considered a risk, and what is its score breakdown?"*\n`;
  reply += `5. *"Which packages in my dependency tree execute automated install scripts?"*\n`;

  return {
    reply,
    relatedPackages: [samplePkg, sampleBlastPkg].filter(Boolean),
    suggestedAction: fix ? fix.command : null
  };
}

/**
 * Builds deterministic reasoning response when no external LLM key is configured
 * or as a fast, high-reliability fallback.
 */
function generateLocalResponse(query, retrieved, history = []) {
  const q = query.toLowerCase().trim();
  const summary = retrieved.projectSummary;
  const fix = retrieved.fixRecommendation;
  const matched = retrieved.matchedPackages;

  // Check domain relevance first
  if (!isQueryRelevant(query, retrieved)) {
    return buildOutOfDomainResponse(retrieved);
  }

  // 1. Specific Package Question
  if (matched.length > 0) {
    const pkg = matched[0];
    const score = pkg.score ?? 0;
    const isDirect = pkg.direct ? 'Direct dependency' : 'Transitive dependency';
    const blast = pkg.blastRadius ?? 0;
    const vulns = pkg.vulns?.length ? `${pkg.vulns.length} vulnerabilities detected` : 'No known vulnerabilities';
    const scripts = pkg.installScripts ? '⚠️ Defines automated install scripts (execution risk)' : 'None';
    const license = pkg.license || 'UNKNOWN';

    let riskLevel = 'Low';
    if (score >= 60) riskLevel = '🔴 Critical';
    else if (score >= 40) riskLevel = '🟠 High';
    else if (score >= 20) riskLevel = '🟡 Medium';
    else riskLevel = '🟢 Low';

    let answer = `### Package Analysis: \`${pkg.id || pkg.name}\`\n\n`;
    answer += `- **Type**: ${isDirect}\n`;
    answer += `- **Risk Score**: **${score}** (${riskLevel})\n`;
    answer += `- **Blast Radius**: **${blast}** (relied on by ${blast} modules in your tree)\n`;
    answer += `- **Vulnerabilities**: ${vulns}\n`;
    answer += `- **Install Scripts**: ${scripts}\n`;
    answer += `- **License**: \`${license}\`\n\n`;

    if (pkg.scoreBreakdown) {
      answer += `**Score Breakdown:**\n`;
      Object.entries(pkg.scoreBreakdown).forEach(([k, v]) => {
        if (v > 0) answer += `- ${k}: +${v} pts\n`;
      });
      answer += `\n`;
    }

    if (!pkg.direct) {
      answer += `💡 *Tip: Because this is a transitive dependency, you can check which direct dependency pulls it in from the dependency graph or apply our recommended upgrade fix.*`;
    }

    return {
      reply: answer,
      relatedPackages: [pkg.id || pkg.name],
      suggestedAction: pkg.direct ? `npm install ${pkg.name}@latest` : (fix ? fix.command : null)
    };
  }

  // 2. Best Upgrade / Fix Query
  if (q.includes('fix') || q.includes('upgrade') || q.includes('recommend') || q.includes('solve')) {
    if (fix && fix.package) {
      return {
        reply: `### 🚀 Recommended Best Upgrade\n\n` +
          `Our exclusivity reachability algorithm identified **\`${fix.package}\`** as the single highest-impact upgrade:\n\n` +
          `- **Direct Package**: \`${fix.package}\`\n` +
          `- **Cumulative Risk Removed**: **${fix.risk} points** across its isolated subtree\n` +
          `- **Command**: \`${fix.command}\`\n\n` +
          `**Why this package?**\n` +
          `Upgrading \`${fix.package}\` removes vulnerabilities that are **exclusive** to its branch. It won't break shared dependencies needed by other direct packages.`,
        relatedPackages: [fix.package],
        suggestedAction: fix.command
      };
    } else {
      return {
        reply: `No single upgrade candidates are currently needed. Your dependencies appear healthy or risks are shared across multiple branches!`,
        relatedPackages: [],
        suggestedAction: null
      };
    }
  }

  // 3. Project Score / Grade Query
  if (q.includes('grade') || q.includes('score') || q.includes('why') || q.includes('summary') || q.includes('status') || q.includes('overview')) {
    if (summary) {
      return {
        reply: `### 📊 Project Security Overview\n\n` +
          `- **Overall Project Score**: **${summary.projectScore}** (Grade **${summary.grade}**)\n` +
          `- **Total Packages Analyzed**: ${summary.totalPackages} (${summary.directCount} direct, ${summary.transitiveCount} transitive)\n` +
          `- **Critical Risk (≥60)**: ${summary.criticalCount} packages\n` +
          `- **High Risk (40-59)**: ${summary.highCount} packages\n` +
          `- **Medium Risk (20-39)**: ${summary.mediumCount} packages\n\n` +
          (fix ? `💡 **Top Recommended Action**: Run \`${fix.command}\` to reduce **${fix.risk} risk points**.` : `All dependencies are within acceptable risk thresholds.`),
        relatedPackages: fix ? [fix.package] : [],
        suggestedAction: fix ? fix.command : null
      };
    }
  }

  // 4. Blast Radius Query
  if (q.includes('blast') || q.includes('radius') || q.includes('impact') || q.includes('widest')) {
    const top = retrieved.highestBlastRadius.slice(0, 3);
    let reply = `### 💥 Highest Blast Radius Packages\n\n` +
      `Blast radius measures how many upstream modules depend on a package (calculated via reverse dependency graph BFS):\n\n`;

    top.forEach((p, i) => {
      reply += `${i + 1}. **\`${p.id || p.name}\`**: Blast Radius of **${p.blastRadius || 0}** (${p.direct ? 'Direct' : 'Transitive'})\n`;
    });

    reply += `\n*A vulnerability in high-blast packages has a cascading ripple effect across your entire project.*`;

    return {
      reply,
      relatedPackages: top.map(p => p.id || p.name),
      suggestedAction: null
    };
  }

  // 5. Install Scripts Query
  if (q.includes('script') || q.includes('install') || q.includes('malware') || q.includes('lifecycle')) {
    const scripts = retrieved.installScriptPackages;
    if (scripts.length > 0) {
      let reply = `### ⚠️ Packages with Install Scripts (${scripts.length})\n\n` +
        `These packages execute automated lifecycle scripts (\`preinstall\`, \`install\`, \`postinstall\`) upon \`npm install\`, which represents potential supply-chain execution risk:\n\n`;

      scripts.slice(0, 5).forEach((p, i) => {
        reply += `${i + 1}. **\`${p.id || p.name}\`** (Risk: ${p.score || 0})\n`;
      });

      return {
        reply,
        relatedPackages: scripts.slice(0, 5).map(p => p.id || p.name),
        suggestedAction: null
      };
    } else {
      return {
        reply: `✅ **No lifecycle install scripts detected!** None of your dependencies execute arbitrary automated scripts upon installation.`,
        relatedPackages: [],
        suggestedAction: null
      };
    }
  }

  // 6. Generic / Default Welcome Response
  const topRisks = retrieved.highestRisk.slice(0, 3);
  let reply = `### 🤖 Null Pointers AI Security Copilot\n\n`;
  if (summary) {
    reply += `I'm analyzing your current lockfile dataset (**Grade ${summary.grade}**, Score **${summary.projectScore}**):\n\n`;
  } else {
    reply += `I can help analyze your dependency tree and risk posture:\n\n`;
  }

  if (topRisks.length > 0) {
    reply += `**Top Risk Dependencies in your dataset:**\n`;
    topRisks.forEach(p => {
      reply += `- \`${p.name}\` (${p.id}): Risk Score **${p.score || 0}**, Blast Radius **${p.blastRadius || 0}**\n`;
    });
    reply += `\n`;
  }

  if (fix) {
    reply += `**Single Best Action:** Run \`${fix.command}\` to immediately eliminate **${fix.risk} points** of isolated risk.\n\n`;
  }

  reply += `You can ask me questions like:\n` +
    `- *"Why is my project Grade ${summary?.grade || 'C'}?"*\n` +
    `- *"Explain the best upgrade"* \n` +
    `- *"What is the blast radius of ${topRisks[0]?.name || 'express'}?"*\n` +
    `- *"Which packages run install scripts?"*`;

  return {
    reply,
    relatedPackages: topRisks.map(p => p.id || p.name),
    suggestedAction: fix ? fix.command : null
  };
}

/**
 * Main chat handler.
 * Uses Gemini API if GEMINI_API_KEY is configured, or local graph reasoning engine.
 */
async function answerSecurityQuestion(query, context = {}, history = []) {
  const retrieved = retrieveContext(query, context);

  // If query is not relevant to the dataset, immediately return out-of-domain rejection
  if (!isQueryRelevant(query, retrieved)) {
    return buildOutOfDomainResponse(retrieved);
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return generateLocalResponse(query, retrieved, history);
  }

  try {
    const prompt = `You are the AI Security Copilot for "null_pointers", a dependency risk analysis platform.
You analyze package-lock.json dependency graphs, CVE vulnerabilities, blast radiuses, licenses, and lifecycle install scripts.

STRICT DOMAIN RESTRICTION:
You are exclusively restricted to answering questions about the provided dependency dataset, security vulnerabilities, blast radiuses, licenses, and upgrade fixes.
If the user asks ANY question outside of this dataset or software supply chain security (e.g. general trivia, unrelated programming tasks, weather, cooking, entertainment), you MUST refuse by stating:
"Sorry, I can't provide an answer to that question. I am exclusively designed to analyze your uploaded dependency dataset and security risk posture."
and immediately provide 3-4 recommended questions the user can ask about the packages in the CONTEXT.

CONTEXT:
${JSON.stringify(retrieved, null, 2)}

USER QUESTION:
${query}

Provide a concise, direct, markdown-formatted answer highlighting risk points, blast radius, and actionable npm commands if applicable.`;

    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 500, temperature: 0.3 }
      })
    });

    if (!res.ok) {
      return generateLocalResponse(query, retrieved, history);
    }

    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      return generateLocalResponse(query, retrieved, history);
    }

    return {
      reply: text,
      relatedPackages: retrieved.matchedPackages.map(p => p.id || p.name),
      suggestedAction: retrieved.fixRecommendation?.command || null
    };
  } catch {
    return generateLocalResponse(query, retrieved, history);
  }
}

module.exports = {
  answerSecurityQuestion,
  isQueryRelevant,
  buildOutOfDomainResponse
};
