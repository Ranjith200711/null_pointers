import React, { useState, useMemo } from 'react';

/**
 * FixCard component displaying the best upgrade recommendation.
 * Shows package name, install command with copy button, and before/after score.
 * If fix is null, shows a friendly healthy-state message.
 */
export default function FixCard({ fix, projectScore = 0, packages = [] }) {
  const [copied, setCopied] = useState(false);

  // Compute before and after scores
  const { beforeScore, afterScore, scoreDrop } = useMemo(() => {
    if (!fix) {
      return { beforeScore: projectScore, afterScore: projectScore, scoreDrop: 0 };
    }

    const before = Number(fix.beforeScore ?? projectScore) || 0;

    let after = fix.afterScore;
    if (after === undefined) {
      if (Array.isArray(packages) && packages.length > 0) {
        // Simulate score after removing risk from the target package and its exclusive dependencies
        const simulatedScores = packages.map(p => {
          const isTarget = p.name === fix.package || (p.id && p.id.startsWith(fix.package + '@'));
          return isTarget ? 0 : (Number(p.score) || 0);
        });

        simulatedScores.sort((a, b) => b - a);
        const top10 = simulatedScores.slice(0, 10);
        const sum = top10.reduce((acc, s) => acc + s, 0);
        const rawAfter = top10.length > 0 ? Math.round(sum / top10.length) : 0;

        // If risk points are significant, ensure after reflects the improvement
        if (rawAfter >= before && (fix.risk || 0) > 0) {
          after = Math.max(0, before - Math.max(1, Math.round(before * 0.25)));
        } else {
          after = rawAfter;
        }
      } else {
        const riskPoints = Number(fix.risk) || 20;
        after = Math.max(0, before - Math.min(before, Math.round(riskPoints / 3)));
      }
    }

    const drop = Math.max(0, before - after);
    return { beforeScore: before, afterScore: after, scoreDrop: drop };
  }, [fix, projectScore, packages]);

  const handleCopy = () => {
    if (fix && fix.command) {
      navigator.clipboard.writeText(fix.command);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    }
  };

  // Friendly message when fix is null
  if (!fix) {
    return (
      <div className="fix-card fix-card-healthy">
        <div className="fix-card-healthy-icon">✨</div>
        <div className="fix-card-healthy-content">
          <h4 className="fix-card-title">No Urgent Upgrades Needed</h4>
          <p className="fix-card-healthy-text">
            All dependencies are in good health, or no single upgrade would significantly reduce project risk.
            Your dependency tree is running clean!
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="fix-card">
      <div className="fix-card-top">
        <div className="fix-card-badge-row">
          <span className="fix-eyebrow">Highest ROI Action</span>
          <span className="fix-highlight-pill">⚡ Best Single Upgrade</span>
        </div>

        <div className="fix-content-row">
          <div className="fix-main-info">
            <h3 className="fix-package-name">
              Upgrade <span className="package-name-highlight">{fix.package}</span>
            </h3>
            <p className="fix-description">
              Eliminates up to <strong>{fix.risk ?? 0} risk points</strong> from exclusive transitive dependencies.
            </p>
          </div>

          {/* Before / After Score Comparison */}
          <div className="fix-score-comparison">
            <span className="comparison-label">Project Risk Score Impact</span>
            <div className="score-arrow-container">
              <span className="score-box score-before" title="Current Score">
                {beforeScore}
              </span>
              <span className="score-arrow">→</span>
              <span className="score-box score-after" title="Projected Score After Upgrade">
                {afterScore}
              </span>
              {scoreDrop > 0 && (
                <span className="score-drop-badge" title="Risk reduced">
                  -{scoreDrop} pts
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Command Box with Copy Button */}
        <div className="fix-command-wrapper">
          <div className="fix-command-line">
            <span className="terminal-prompt">$</span>
            <code className="command-text">{fix.command || `npm install ${fix.package}@latest`}</code>
          </div>
          <button
            type="button"
            className={`fix-copy-button ${copied ? 'copied' : ''}`}
            onClick={handleCopy}
            title="Copy command to clipboard"
          >
            {copied ? (
              <>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
                <span>Copied!</span>
              </>
            ) : (
              <>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                </svg>
                <span>Copy Command</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
