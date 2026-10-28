import React from 'react';
import { getScoreBadgeClass, getHighestSeverity } from './ResultsTable';

export default function PackageDetails({ pkg, onClose }) {
  if (!pkg) return null;

  const highestSev = getHighestSeverity(pkg.vulns);
  const breakdown = pkg.scoreBreakdown || {};

  return (
    <div className="package-details-card">
      <div className="details-header">
        <div>
          <span className="details-eyebrow">{pkg.direct ? 'Direct Dependency' : 'Transitive Dependency'}</span>
          <h3 className="details-title">{pkg.id}</h3>
        </div>
        <div className="details-header-right">
          <span className={getScoreBadgeClass(pkg.score)}>
            Score {pkg.score}
          </span>
          {onClose && (
            <button className="details-close-btn" onClick={onClose} title="Close details">
              ✕
            </button>
          )}
        </div>
      </div>

      <div className="details-stats-grid">
        <div className="stat-card">
          <span className="stat-label">Blast Radius</span>
          <span className="stat-val">{pkg.blastRadius ?? 0}</span>
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
          <span className="stat-label">Status</span>
          <span className="stat-val">{pkg.deprecated ? 'Deprecated' : 'Active'}</span>
          <span className="stat-hint">{pkg.abandoned ? 'Abandoned' : 'Maintained'}</span>
        </div>
      </div>

      {/* Score Breakdown Bars */}
      <div className="details-section">
        <h4 className="section-title">Score Breakdown (Transparent Weighting)</h4>
        <div className="score-breakdown-list">
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

          <div className="breakdown-item">
            <div className="breakdown-labels">
              <span>Staleness / Abandonment (max 15)</span>
              <strong>{breakdown.stale || 0} pts</strong>
            </div>
            <div className="breakdown-bar-bg">
              <div
                className="breakdown-bar-fill fill-stale"
                style={{ width: `${Math.min(100, ((breakdown.stale || 0) / 15) * 100)}%` }}
              />
            </div>
          </div>

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

      {/* Flag details */}
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
