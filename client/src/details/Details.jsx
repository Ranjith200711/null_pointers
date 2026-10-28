import React from 'react';

/**
 * Maps risk score to human label and CSS styling.
 */
function getRiskBadge(score = 0) {
  const s = Number(score) || 0;
  if (s >= 60) {
    return { label: 'Critical / High Risk', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.15)', border: '#ef4444' };
  }
  if (s >= 40) {
    return { label: 'High Risk', color: '#f97316', bg: 'rgba(249, 115, 22, 0.15)', border: '#f97316' };
  }
  if (s >= 20) {
    return { label: 'Medium Risk', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)', border: '#f59e0b' };
  }
  return { label: 'Low Risk', color: '#10b981', bg: 'rgba(16, 185, 129, 0.15)', border: '#10b981' };
}

/**
 * Score breakdown configuration with labels, max points, and colors.
 */
const BREAKDOWN_CONFIG = [
  { key: 'vulns', label: 'Vulnerabilities', max: 40, color: '#ef4444' },
  { key: 'deprecated', label: 'Deprecation', max: 20, color: '#f97316' },
  { key: 'stale', label: 'Staleness / Abandonment', max: 15, color: '#eab308' },
  { key: 'scripts', label: 'Install Scripts', max: 10, color: '#a855f7' },
  { key: 'license', label: 'License Risk', max: 15, color: '#ec4899' }
];

export default function Details({ pkg, package: pkgProp, selectedPackage, selectedId, packages = [], onClose }) {
  // Resolve target package
  const activePkg =
    pkg ||
    pkgProp ||
    selectedPackage ||
    (selectedId && packages ? packages.find(p => p.id === selectedId) : null);

  // Placeholder when nothing is selected
  if (!activePkg) {
    return (
      <div className="package-details-card details-placeholder-card">
        <div className="placeholder-icon">📦</div>
        <h4 className="placeholder-title">No Package Selected</h4>
        <p className="placeholder-description">
          Click on any row in the Results Table or click a node in the Dependency Graph to inspect risk score breakdown, vulnerabilities, flags, and the dependency chain.
        </p>
        <div className="placeholder-features">
          <div className="feature-item">
            <span className="feature-dot" style={{ backgroundColor: '#ef4444' }}></span>
            <span>Why this score: transparent 5-factor breakdown</span>
          </div>
          <div className="feature-item">
            <span className="feature-dot" style={{ backgroundColor: '#f59e0b' }}></span>
            <span>Pulled in by: dependency chain path</span>
          </div>
          <div className="feature-item">
            <span className="feature-dot" style={{ backgroundColor: '#10b981' }}></span>
            <span>Security flags: scripts, licenses, deprecations</span>
          </div>
        </div>
      </div>
    );
  }

  const riskBadge = getRiskBadge(activePkg.score);
  const breakdown = activePkg.scoreBreakdown || {};

  // Extract blast radius count
  const blastCount =
    typeof activePkg.blastRadius === 'object' && activePkg.blastRadius !== null
      ? (activePkg.blastRadius.count ?? 0)
      : (Number(activePkg.blastRadius) || 0);

  // Extract blast radius path
  let pathSegments = [];
  if (typeof activePkg.blastRadius === 'object' && activePkg.blastRadius !== null && Array.isArray(activePkg.blastRadius.path)) {
    pathSegments = [...activePkg.blastRadius.path];
  } else if (activePkg.direct) {
    pathSegments = [activePkg.id];
  } else {
    pathSegments = ['...', activePkg.id];
  }

  // Ensure 'app' is the root of the chain
  if (pathSegments.length === 0 || pathSegments[0] !== 'app') {
    pathSegments.unshift('app');
  }

  // Calculate breakdown items with nonzero points first or proportional widths
  const breakdownItems = BREAKDOWN_CONFIG.map(item => ({
    ...item,
    points: Number(breakdown[item.key]) || 0
  }));

  const totalPoints = breakdownItems.reduce((acc, curr) => acc + curr.points, 0) || 1;

  // Flags evaluation
  const hasInstallScripts = Boolean(
    activePkg.installScripts &&
    (Array.isArray(activePkg.installScripts) ? activePkg.installScripts.length > 0 : activePkg.installScripts)
  );

  const scriptNames = Array.isArray(activePkg.installScripts)
    ? activePkg.installScripts.join(', ')
    : 'preinstall / install / postinstall';

  return (
    <div className="package-details-card details-active-view">
      {/* 1. Header: Package ID and Risk Badge */}
      <div className="details-header">
        <div className="details-title-group">
          <span className="details-tag">{activePkg.direct ? 'Direct Dependency' : 'Transitive Dependency'}</span>
          <h3 className="details-package-id">{activePkg.id}</h3>
        </div>
        <div className="details-header-actions">
          <span
            className="details-risk-badge"
            style={{ color: riskBadge.color, backgroundColor: riskBadge.bg, borderColor: riskBadge.border }}
          >
            {activePkg.score} pts • {riskBadge.label}
          </span>
          {onClose && (
            <button className="details-close-btn" onClick={onClose} title="Deselect package">
              ✕
            </button>
          )}
        </div>
      </div>

      {/* 2. "Why this score" Stacked Bar and List */}
      <div className="details-section">
        <div className="section-header-row">
          <h4 className="details-section-title">Why This Score?</h4>
          <span className="total-score-pill">Total: {activePkg.score} / 100</span>
        </div>

        {/* Stacked Bar */}
        <div className="stacked-score-bar" title="Stacked score breakdown">
          {breakdownItems.map(item => {
            if (item.points === 0) return null;
            const pct = (item.points / Math.max(100, totalPoints)) * 100;
            return (
              <div
                key={item.key}
                className="stacked-bar-segment"
                style={{
                  width: `${pct}%`,
                  backgroundColor: item.color
                }}
                title={`${item.label}: ${item.points} pts`}
              />
            );
          })}
        </div>

        {/* Breakdown List (Label, Points, Color) */}
        <div className="breakdown-cards-list">
          {breakdownItems.map(item => (
            <div key={item.key} className="breakdown-card-row">
              <div className="breakdown-row-left">
                <span className="breakdown-dot" style={{ backgroundColor: item.color }} />
                <span className="breakdown-label">{item.label}</span>
                <span className="breakdown-max">(max {item.max})</span>
              </div>
              <strong className="breakdown-points" style={{ color: item.points > 0 ? item.color : 'var(--text-dim)' }}>
                {item.points} pts
              </strong>
            </div>
          ))}
        </div>
      </div>

      {/* 3. Vulnerability List with IDs and Severities */}
      <div className="details-section">
        <h4 className="details-section-title">
          Vulnerabilities ({activePkg.vulns ? activePkg.vulns.length : 0})
        </h4>
        {activePkg.vulns && activePkg.vulns.length > 0 ? (
          <div className="vuln-items-list">
            {activePkg.vulns.map((v, idx) => {
              const sev = (v?.severity || 'medium').toLowerCase();
              return (
                <div key={v.id || idx} className="vuln-entry-card">
                  <div className="vuln-entry-header">
                    <span className={`severity-badge sev-${sev}`}>
                      {sev.toUpperCase()}
                    </span>
                    <span className="vuln-entry-id">{v.id}</span>
                  </div>
                  {v.summary && <p className="vuln-entry-summary">{v.summary}</p>}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="clean-status-box">
            <span className="clean-status-icon">✓</span>
            <span>No known vulnerabilities found for this version.</span>
          </div>
        )}
      </div>

      {/* 4. Flags (Deprecated, Install Scripts, License Note, Abandoned Reason) */}
      <div className="details-section">
        <h4 className="details-section-title">Security & Maintenance Flags</h4>
        <div className="flags-grid">
          {/* Deprecated Flag */}
          <div className={`flag-card ${activePkg.deprecated ? 'flag-warning' : 'flag-ok'}`}>
            <span className="flag-card-title">Deprecated</span>
            <span className="flag-card-value">
              {activePkg.deprecated ? '⚠️ Yes (Author flagged as deprecated)' : '✓ Active'}
            </span>
          </div>

          {/* Install Scripts Flag */}
          <div className={`flag-card ${hasInstallScripts ? 'flag-warning' : 'flag-ok'}`}>
            <span className="flag-card-title">Install Scripts</span>
            <span className="flag-card-value">
              {hasInstallScripts ? `⚠️ Detected (${scriptNames})` : '✓ None'}
            </span>
          </div>

          {/* License Note Flag */}
          <div className={`flag-card ${activePkg.riskyLicense ? 'flag-warning' : 'flag-ok'}`}>
            <span className="flag-card-title">License</span>
            <span className="flag-card-value">
              {activePkg.licenseNote || `${activePkg.license || 'UNKNOWN'}`}
            </span>
          </div>

          {/* Abandoned Reason Flag */}
          <div className={`flag-card ${activePkg.abandoned ? 'flag-warning' : 'flag-ok'}`}>
            <span className="flag-card-title">Maintenance</span>
            <span className="flag-card-value">
              {activePkg.abandoned
                ? `⚠️ Abandoned: ${activePkg.abandonedReason || 'Stale release'}`
                : '✓ Actively maintained'}
            </span>
          </div>
        </div>
      </div>

      {/* 5. "Pulled in by" Chain & Dependents Text */}
      <div className="details-section">
        <h4 className="details-section-title">Pulled In By (Dependency Chain)</h4>
        <div className="chain-container">
          <div className="chain-breadcrumb">
            {pathSegments.map((seg, i) => (
              <React.Fragment key={i}>
                <span className={`chain-node ${i === pathSegments.length - 1 ? 'chain-target' : ''}`}>
                  {seg}
                </span>
                {i < pathSegments.length - 1 && <span className="chain-arrow">→</span>}
              </React.Fragment>
            ))}
          </div>
          <p className="dependents-count-text">
            <strong>{blastCount}</strong> {blastCount === 1 ? 'package depends' : 'packages depend'} on this package in your project.
          </p>
        </div>
      </div>
    </div>
  );
}
