import React, { useState } from 'react';

export default function ProjectSummary({ result }) {
  if (!result) return null;

  const { projectScore = 0, grade = '—', fix, packages = [] } = result;
  const [copied, setCopied] = useState(false);

  const handleCopyCommand = () => {
    if (fix && fix.command) {
      navigator.clipboard.writeText(fix.command);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const gradeColorClass =
    grade === 'A' ? 'grade-a' :
    grade === 'B' ? 'grade-b' :
    grade === 'C' ? 'grade-c' :
    grade === 'D' ? 'grade-d' : 'grade-f';

  return (
    <div className="project-summary-grid">
      {/* Overall Score Card */}
      <div className="summary-card score-card">
        <div className="summary-card-inner">
          <div>
            <span className="summary-eyebrow">Project Security Health</span>
            <div className="score-display">
              <span className="big-score">{projectScore}</span>
              <span className="max-score">/ 100</span>
              <span className={`grade-badge ${gradeColorClass}`}>Grade {grade}</span>
            </div>
            <p className="score-desc">
              Based on the average risk score of the top 10 riskiest packages across {packages.length} dependencies.
            </p>
          </div>
        </div>
      </div>

      {/* Best Single Upgrade Fix Card */}
      {fix && (
        <div className="summary-card fix-card">
          <div className="fix-card-header">
            <span className="fix-icon">⚡</span>
            <div>
              <span className="summary-eyebrow">Recommended Action</span>
              <h4 className="fix-title">Best Single Upgrade</h4>
            </div>
          </div>
          <p className="fix-desc">
            Upgrading <strong>{fix.package}</strong> eliminates <strong>{fix.risk} risk points</strong> from exclusive transitive dependencies.
          </p>
          <div className="command-box">
            <code>{fix.command}</code>
            <button className="copy-btn" onClick={handleCopyCommand}>
              {copied ? '✓ Copied' : 'Copy'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
