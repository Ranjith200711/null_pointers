import React from 'react';
import { getScoreBadgeClass, getHighestSeverity } from './ResultsTable';

/**
 * Details component (Member 4).
 * Renders rich diagnostic and breakdown information for a selected package id.
 */
export default function Details({ selectedId, packages = [], pkg: directPkg = null, onClose }) {
  // Resolve package either from direct pkg prop or by finding in packages array
  const pkg = directPkg || (selectedId ? packages.find(p => p.id === selectedId) : null);

  // If no package is selected, show an inviting empty state
  if (!pkg) {
    return (
      <div className="package-details-card details-empty-card">
        <div className="details-empty-icon">🔍</div>
        <h4 className="details-empty-title">Package Inspector</h4>
        <p className="details-empty-text">
          Click on any row in the Results Table to inspect detailed risk breakdown, blast radius, CVEs, and license status.
        </p>
        <div className="details-empty-hints">
          <div className="empty-hint-item">
            <span className="hint-bullet">•</span>
            <span>Transparent 0–100 risk scoring formula</span>
          </div>
          <div className="empty-hint-item">
            <span className="hint-bullet">•</span>
            <span>Blast radius: who pulls this package in</span>
          </div>
          <div className="empty-hint-item">
            <span className="hint-bullet">•</span>
            <span>OSV.dev & npm registry vulnerability data</span>
          </div>
        </div>
      </div>
    );
  }

  const highestSev = getHighestSeverity(pkg.vulns);
  const breakdown = pkg.scoreBreakdown || {};

  // Safely extract blast radius count and dependency path (supports number or { count, path } object)
  const blastCount = typeof pkg.blastRadius === 'object' && pkg.blastRadius !== null
    ? (pkg.blastRadius.count ?? 0)
    : (pkg.blastRadius ?? 0);

  const blastPath = typeof pkg.blastRadius === 'object' && pkg.blastRadius !== null && Array.isArray(pkg.blastRadius.path)
    ? pkg.blastRadius.path.join(' → ')
    : null;

  return (
    <div className="package-details-card">
      {/* Header with Title and Close Button */}
      <div className="details-header">
        <div className="details-header-main">
          <span className="details-eyebrow">
            {pkg.direct ? 'Direct Dependency' : 'Transitive Dependency'}
          </span>
          <h3 className="details-title">{pkg.id}</h3>
        </div>
        <div className="details-header-right">
          <span className={getScoreBadgeClass(pkg.score)}>
            Score {pkg.score}
          </span>
          {onClose && (
            <button className="details-close-btn" onClick={onClose} title="Deselect package">
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Quick Metrics Grid */}
      <div className="details-stats-grid">
        <div className="stat-card">
          <span className="stat-label">Blast Radius</span>
          <span className="stat-val">{blastCount}</span>
          <span className="stat-hint">dependents impacted</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Vulnerabilities</span>
          <span className="stat-val">{pkg.vulns ? pkg.vulns.length : 0}</span>
          <span className="stat-hint">highest: {highestSev}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">License</span>
          <span className="stat-val text-truncate">{pkg.license || 'UNKNOWN'}</span>
          <span className="stat-hint">{pkg.riskyLicense ? 'Risky license' : 'Permissive'}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Maintenance</span>
          <span className="stat-val">{pkg.deprecated ? 'Deprecated' : 'Active'}</span>
          <span className="stat-hint">{pkg.abandoned ? 'Abandoned' : 'Maintained'}</span>
        </div>

        {blastPath && (
          <div className="stat-card" style={{ gridColumn: 'span 2' }}>
            <span className="stat-label">Dependency Chain</span>
            <span className="stat-hint" style={{ fontFamily: 'var(--font-mono)', color: '#93c5fd', marginTop: '4px', wordBreak: 'break-all' }}>
              {blastPath}
            </span>
          </div>
        )}
      </div>

      {/* Transparent Score Breakdown */}
      <div className="details-section">
        <h4 className="section-title">Risk Breakdown (Transparent Weighting)</h4>
        <div className="score-breakdown-list">
          {/* Vulnerabilities (max 40) */}
          <div className="breakdown-item">
            <div className="breakdown-labels">
              <span>Vulnerabilities (max 40)</span>
              <strong>{breakdown.vulns || 0} pts</strong>
            </div>
            <div className="breakdown-bar-bg">
              <div
                className="breakdown-bar-fill fill-vulns"
                style={{ width: `${Math.min(100, ((breakdown.vulns || 0) / 40) * 100)}%` }}
              />
            </div>
          </div>

          {/* Deprecation (max 20) */}
          <div className="breakdown-item">
            <div className="breakdown-labels">
              <span>Deprecation (max 20)</span>
              <strong>{breakdown.deprecated || 0} pts</strong>
            </div>
            <div className="breakdown-bar-bg">
              <div
                className="breakdown-bar-fill fill-deprecated"
                style={{ width: `${Math.min(100, ((breakdown.deprecated || 0) / 20) * 100)}%` }}
              />
            </div>
          </div>

          {/* Staleness / Age (max 15) */}
          <div className="breakdown-item">
            <div className="breakdown-labels">
              <span>Staleness / Age (max 15)</span>
              <strong>{breakdown.stale || 0} pts</strong>
            </div>
            <div className="breakdown-bar-bg">
              <div
                className="breakdown-bar-fill fill-stale"
                style={{ width: `${Math.min(100, ((breakdown.stale || 0) / 15) * 100)}%` }}
              />
            </div>
          </div>

          {/* Install Scripts (max 10) */}
          <div className="breakdown-item">
            <div className="breakdown-labels">
              <span>Install Scripts (max 10)</span>
              <strong>{breakdown.scripts || 0} pts</strong>
            </div>
            <div className="breakdown-bar-bg">
              <div
                className="breakdown-bar-fill fill-scripts"
                style={{ width: `${Math.min(100, ((breakdown.scripts || 0) / 10) * 100)}%` }}
              />
            </div>
          </div>

          {/* License Risk (max 15) */}
          <div className="breakdown-item">
            <div className="breakdown-labels">
              <span>License Risk (max 15)</span>
              <strong>{breakdown.license || 0} pts</strong>
            </div>
            <div className="breakdown-bar-bg">
              <div
                className="breakdown-bar-fill fill-license"
                style={{ width: `${Math.min(100, ((breakdown.license || 0) / 15) * 100)}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Vulnerabilities List */}
      {pkg.vulns && pkg.vulns.length > 0 && (
        <div className="details-section">
          <h4 className="section-title">Detected Vulnerabilities ({pkg.vulns.length})</h4>
          <div className="vulns-list">
            {pkg.vulns.map((v, i) => (
              <div key={v.id || i} className="vuln-item">
                <div className="vuln-header">
                  <span className={`severity-badge sev-${(v.severity || 'medium').toLowerCase()}`}>
                    {(v.severity || 'MEDIUM').toUpperCase()}
                  </span>
                  <span className="vuln-id">{v.id}</span>
                </div>
                {v.summary && <p className="vuln-summary">{v.summary}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Security & Maintenance Notes */}
      {(pkg.licenseNote || pkg.abandonedReason) && (
        <div className="details-section">
          <h4 className="section-title">Security Notes</h4>
          {pkg.licenseNote && (
            <p className="note-text">
              <strong>License:</strong> {pkg.licenseNote}
            </p>
          )}
          {pkg.abandonedReason && (
            <p className="note-text">
              <strong>Maintenance:</strong> {pkg.abandonedReason}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
