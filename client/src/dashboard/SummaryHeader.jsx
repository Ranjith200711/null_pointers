import React, { useMemo } from 'react';

/**
 * Returns color and styling details for a given letter grade.
 */
function getGradeMeta(grade = '—') {
  const g = grade.toUpperCase();
  switch (g) {
    case 'A':
      return { color: '#10b981', bg: 'rgba(16, 185, 129, 0.15)', border: '#10b981', label: 'Healthy / Low Risk' };
    case 'B':
      return { color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.15)', border: '#3b82f6', label: 'Moderate Risk' };
    case 'C':
      return { color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)', border: '#f59e0b', label: 'Elevated Risk' };
    case 'D':
      return { color: '#f97316', bg: 'rgba(249, 115, 22, 0.15)', border: '#f97316', label: 'High Risk' };
    case 'F':
      return { color: '#ef4444', bg: 'rgba(239, 68, 68, 0.15)', border: '#ef4444', label: 'Critical Risk' };
    default:
      return { color: '#94a3b8', bg: 'rgba(148, 163, 184, 0.15)', border: '#94a3b8', label: 'Unranked' };
  }
}

export default function SummaryHeader({ result = {} }) {
  const {
    projectScore = 0,
    grade = '—',
    packages = []
  } = result;

  // Calculate dependency counts and vulnerability counts
  const stats = useMemo(() => {
    let directCount = 0;
    let transitiveCount = 0;
    let criticalVulns = 0;
    let highVulns = 0;

    for (const pkg of packages) {
      if (pkg.direct) {
        directCount++;
      } else {
        transitiveCount++;
      }

      if (Array.isArray(pkg.vulns)) {
        for (const v of pkg.vulns) {
          const sev = (v?.severity || '').toString().toLowerCase();
          if (sev.includes('crit')) {
            criticalVulns++;
          } else if (sev.includes('high')) {
            highVulns++;
          }
        }
      }
    }

    return {
      totalPackages: packages.length,
      directCount,
      transitiveCount,
      criticalVulns,
      highVulns
    };
  }, [packages]);

  const gradeMeta = getGradeMeta(grade);

  return (
    <div className="summary-header-card">
      <div className="summary-header-left">
        {/* Big Grade Letter */}
        <div
          className="grade-letter-container"
          style={{
            color: gradeMeta.color,
            backgroundColor: gradeMeta.bg,
            borderColor: gradeMeta.border
          }}
          title={`Grade ${grade}: ${gradeMeta.label}`}
        >
          <span className="grade-letter">{grade}</span>
          <span className="grade-subtext">GRADE</span>
        </div>

        {/* Project Score & Description */}
        <div className="project-score-info">
          <span className="score-eyebrow">Project Security Rating</span>
          <div className="score-number-row">
            <span className="score-val">{projectScore}</span>
            <span className="score-unit">/ 100</span>
            <span
              className="grade-pill"
              style={{ color: gradeMeta.color, borderColor: gradeMeta.border, backgroundColor: gradeMeta.bg }}
            >
              {gradeMeta.label}
            </span>
          </div>
          <div className="score-meter-bar">
            <div
              className="score-meter-fill"
              style={{
                width: `${Math.min(100, Math.max(0, projectScore))}%`,
                backgroundColor: gradeMeta.color
              }}
            />
          </div>
          <span className="score-caption">
            Calculated from the top 10 riskiest dependencies across the project.
          </span>
        </div>
      </div>

      {/* Metrics Grid: Total, Direct vs Transitive, Critical & High Vulns */}
      <div className="summary-header-metrics">
        {/* Total Packages */}
        <div className="metric-box">
          <span className="metric-label">Total Dependencies</span>
          <span className="metric-number">{stats.totalPackages}</span>
          <span className="metric-sub">in lockfile</span>
        </div>

        {/* Direct vs Transitive */}
        <div className="metric-box">
          <span className="metric-label">Direct vs Transitive</span>
          <div className="metric-split">
            <span className="split-direct" title="Direct dependencies">
              <strong>{stats.directCount}</strong> direct
            </span>
            <span className="split-sep">/</span>
            <span className="split-transitive" title="Transitive dependencies">
              <strong>{stats.transitiveCount}</strong> transitive
            </span>
          </div>
          <div className="split-bar">
            <div
              className="split-bar-direct"
              style={{
                width: stats.totalPackages > 0
                  ? `${(stats.directCount / stats.totalPackages) * 100}%`
                  : '50%'
              }}
            />
          </div>
        </div>

        {/* Critical & High Vulnerabilities */}
        <div className="metric-box">
          <span className="metric-label">Severe Vulnerabilities</span>
          <div className="vuln-stat-row">
            <div className="vuln-pill pill-critical">
              <span className="vuln-stat-val">{stats.criticalVulns}</span>
              <span className="vuln-stat-tag">Critical</span>
            </div>
            <div className="vuln-pill pill-high">
              <span className="vuln-stat-val">{stats.highVulns}</span>
              <span className="vuln-stat-tag">High</span>
            </div>
          </div>
          <span className="metric-sub">
            {stats.criticalVulns + stats.highVulns === 0 ? '✓ No severe CVEs' : 'Action required'}
          </span>
        </div>
      </div>
    </div>
  );
}
