import React, { useState, useMemo } from 'react';

/**
 * Helper to determine the highest vulnerability severity for a package.
 *
 * @param {Array<Object>} vulns
 * @returns {'critical'|'high'|'medium'|'low'|'none'}
 */
export function getHighestSeverity(vulns) {
  if (!Array.isArray(vulns) || vulns.length === 0) {
    return 'none';
  }

  const severities = vulns.map(v => {
    const s = (typeof v === 'string' ? v : v?.severity || '').toString().toLowerCase();
    if (s.includes('crit')) return 'critical';
    if (s.includes('high')) return 'high';
    if (s.includes('mod') || s.includes('med')) return 'medium';
    if (s.includes('low')) return 'low';
    return 'medium';
  });

  if (severities.includes('critical')) return 'critical';
  if (severities.includes('high')) return 'high';
  if (severities.includes('medium')) return 'medium';
  if (severities.includes('low')) return 'low';
  return 'medium';
}

/**
 * Helper to get score badge styling based on value.
 * Red for high risk (>=60), Amber for medium (20-59), Green for low (<20).
 */
export function getScoreBadgeClass(score) {
  const val = Number(score) || 0;
  if (val >= 60) return 'score-badge score-high';
  if (val >= 20) return 'score-badge score-medium';
  return 'score-badge score-low';
}

/**
 * Format ISO date string into readable YYYY-MM-DD
 */
function formatDate(dateStr) {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '—';
    return d.toISOString().split('T')[0];
  } catch {
    return '—';
  }
}

export default function ResultsTable({ packages = [], onSelect, selectedId }) {
  // Sort state: default sort: score descending
  const [sortField, setSortField] = useState('score');
  const [sortOrder, setSortOrder] = useState('desc');

  // Filters state
  const [severityFilter, setSeverityFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Handle header click to toggle sort
  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder(field === 'score' ? 'desc' : 'asc');
    }
  };

  // Filtered & Sorted packages
  const filteredPackages = useMemo(() => {
    return packages.filter(pkg => {
      // 1. Search filter (by package id or name)
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchesId = pkg.id && pkg.id.toLowerCase().includes(query);
        const matchesName = pkg.name && pkg.name.toLowerCase().includes(query);
        if (!matchesId && !matchesName) return false;
      }

      // 2. Type filter (all / direct / transitive)
      if (typeFilter === 'direct' && !pkg.direct) return false;
      if (typeFilter === 'transitive' && pkg.direct) return false;

      // 3. Severity filter (all / critical / high / medium / low / none)
      if (severityFilter !== 'all') {
        const highest = getHighestSeverity(pkg.vulns);
        if (highest !== severityFilter) return false;
      }

      return true;
    });
  }, [packages, searchQuery, typeFilter, severityFilter]);

  const sortedPackages = useMemo(() => {
    const list = [...filteredPackages];

    list.sort((a, b) => {
      let result = 0;

      switch (sortField) {
        case 'id':
          result = (a.id || '').localeCompare(b.id || '');
          break;
        case 'direct':
          result = (b.direct ? 1 : 0) - (a.direct ? 1 : 0);
          break;
        case 'vulns': {
          const aCount = a.vulns ? a.vulns.length : 0;
          const bCount = b.vulns ? b.vulns.length : 0;
          result = aCount - bCount;
          break;
        }
        case 'deprecated':
          result = (b.deprecated ? 1 : 0) - (a.deprecated ? 1 : 0);
          break;
        case 'lastPublish': {
          const aTime = a.lastPublish ? new Date(a.lastPublish).getTime() : 0;
          const bTime = b.lastPublish ? new Date(b.lastPublish).getTime() : 0;
          result = aTime - bTime;
          break;
        }
        case 'license':
          result = (a.license || '').localeCompare(b.license || '');
          break;
        case 'score':
        default:
          result = (Number(a.score) || 0) - (Number(b.score) || 0);
          break;
      }

      return sortOrder === 'asc' ? result : -result;
    });

    return list;
  }, [filteredPackages, sortField, sortOrder]);

  const renderSortIndicator = (field) => {
    if (sortField !== field) return <span className="sort-arrow-inactive">⇅</span>;
    return <span className="sort-arrow-active">{sortOrder === 'asc' ? '▲' : '▼'}</span>;
  };

  return (
    <div className="results-table-container">
      {/* Table Header Controls: Search & Filters */}
      <div className="table-controls">
        <div className="search-box-wrapper">
          <svg className="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <input
            type="text"
            className="search-input"
            placeholder="Filter packages by name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button className="clear-search-btn" onClick={() => setSearchQuery('')} title="Clear search">
              ✕
            </button>
          )}
        </div>

        <div className="filter-group">
          <label className="filter-label">
            <span>Type:</span>
            <select
              className="filter-select"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
            >
              <option value="all">All Types</option>
              <option value="direct">Direct</option>
              <option value="transitive">Transitive</option>
            </select>
          </label>

          <label className="filter-label">
            <span>Severity:</span>
            <select
              className="filter-select"
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
            >
              <option value="all">All Severities</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
              <option value="none">None (0 vulns)</option>
            </select>
          </label>

          <div className="table-count-badge">
            {sortedPackages.length} of {packages.length} packages
          </div>
        </div>
      </div>

      {/* Main Results Table */}
      <div className="table-responsive">
        <table className="results-table">
          <thead>
            <tr>
              <th className="sortable-th col-id" onClick={() => handleSort('id')}>
                Package ID {renderSortIndicator('id')}
              </th>
              <th className="sortable-th col-type" onClick={() => handleSort('direct')}>
                Type {renderSortIndicator('direct')}
              </th>
              <th className="sortable-th col-vulns" onClick={() => handleSort('vulns')}>
                Vulnerabilities {renderSortIndicator('vulns')}
              </th>
              <th className="sortable-th col-deprecated" onClick={() => handleSort('deprecated')}>
                Deprecated {renderSortIndicator('deprecated')}
              </th>
              <th className="sortable-th col-publish" onClick={() => handleSort('lastPublish')}>
                Last Publish Date {renderSortIndicator('lastPublish')}
              </th>
              <th className="sortable-th col-license" onClick={() => handleSort('license')}>
                License {renderSortIndicator('license')}
              </th>
              <th className="sortable-th col-score" onClick={() => handleSort('score')}>
                Score {renderSortIndicator('score')}
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedPackages.length === 0 ? (
              <tr>
                <td colSpan="7" className="empty-table-cell">
                  No packages matched the selected filters.
                </td>
              </tr>
            ) : (
              sortedPackages.map(pkg => {
                const highestSev = getHighestSeverity(pkg.vulns);
                const vulnCount = Array.isArray(pkg.vulns) ? pkg.vulns.length : 0;
                const isSelected = selectedId === pkg.id;

                return (
                  <tr
                    key={pkg.id}
                    className={`results-table-row ${isSelected ? 'row-selected' : ''}`}
                    onClick={() => onSelect && onSelect(pkg.id)}
                    title="Click to view package details"
                  >
                    {/* Package ID */}
                    <td className="col-id">
                      <span className="package-id-text">{pkg.id}</span>
                      {pkg.installScripts && (
                        <span className="mini-badge badge-scripts" title="Contains pre/post install scripts">
                          scripts
                        </span>
                      )}
                      {pkg.abandoned && (
                        <span className="mini-badge badge-abandoned" title={pkg.abandonedReason || 'Abandoned'}>
                          abandoned
                        </span>
                      )}
                    </td>

                    {/* Direct vs Transitive */}
                    <td className="col-type">
                      <span className={`type-badge ${pkg.direct ? 'type-direct' : 'type-transitive'}`}>
                        {pkg.direct ? 'Direct' : 'Transitive'}
                      </span>
                    </td>

                    {/* Vuln Count with Highest Severity Badge */}
                    <td className="col-vulns">
                      {vulnCount > 0 ? (
                        <div className="vuln-cell-content">
                          <span className="vuln-count">{vulnCount}</span>
                          <span className={`severity-badge sev-${highestSev}`}>
                            {highestSev.toUpperCase()}
                          </span>
                        </div>
                      ) : (
                        <span className="vuln-clean">0 none</span>
                      )}
                    </td>

                    {/* Deprecated */}
                    <td className="col-deprecated">
                      {pkg.deprecated ? (
                        <span className="deprecated-badge">Deprecated</span>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>

                    {/* Last Publish Date */}
                    <td className="col-publish">
                      <span className="date-text">{formatDate(pkg.lastPublish)}</span>
                    </td>

                    {/* License */}
                    <td className="col-license">
                      <span className={`license-badge ${pkg.riskyLicense ? 'license-risky' : 'license-safe'}`} title={pkg.licenseNote || pkg.license}>
                        {pkg.license || 'UNKNOWN'}
                      </span>
                    </td>

                    {/* Score (color coded: red high, amber medium, green low) */}
                    <td className="col-score">
                      <span className={getScoreBadgeClass(pkg.score)}>
                        {pkg.score ?? 0}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
