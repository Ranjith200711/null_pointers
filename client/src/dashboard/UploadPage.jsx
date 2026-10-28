import React, { useState } from 'react';
import ResultsTable from './ResultsTable';
import ProjectSummary from './ProjectSummary';
import PackageDetails from './PackageDetails';

// API base URL configuration (can be overridden via environment or fallback)
const API_BASE_URL = 'http://localhost:3000';

export default function UploadPage() {
  // Configurable Mock flag (also toggleable via UI)
  const [useMock, setUseMock] = useState(false);

  // Form inputs
  const [selectedFile, setSelectedFile] = useState(null);
  const [filePath, setFilePath] = useState('');

  // Status & Results state
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState('');
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [selectedPackageId, setSelectedPackageId] = useState(null);

  // Handle file input selection
  const handleFileChange = (e) => {
    const file = e.target.files && e.target.files[0];
    if (file) {
      setSelectedFile(file);
      setError(null);
    }
  };

  // Helper to load mock results
  const loadMockResult = async () => {
    setLoading(true);
    setLoadingStep('Loading mock data from /mock/result.json...');
    setError(null);
    try {
      const res = await fetch('/mock/result.json');
      if (!res.ok) {
        throw new Error(`Failed to load mock data: HTTP ${res.status}`);
      }
      const data = await res.json();
      setResult(data);
      if (data.packages && data.packages.length > 0) {
        setSelectedPackageId(data.packages[0].id);
      }
    } catch (err) {
      setError(`Mock Load Error: ${err.message}`);
    } finally {
      setLoading(false);
      setLoadingStep('');
    }
  };

  // Handle "Analyze" button click
  const handleAnalyze = async () => {
    setError(null);

    // If USE_MOCK flag is active, load mock result
    if (useMock) {
      return loadMockResult();
    }

    if (!selectedFile && !filePath.trim()) {
      setError('Please select a package-lock.json / package.json file, or enter a valid file path.');
      return;
    }

    setLoading(true);
    setLoadingStep('Uploading lockfile and analyzing dependencies...');

    try {
      let res;

      if (selectedFile) {
        // Multipart file upload
        const formData = new FormData();
        formData.append('file', selectedFile);

        res = await fetch(`${API_BASE_URL}/analyze`, {
          method: 'POST',
          body: formData
        });
      } else {
        // File path in JSON body
        res = await fetch(`${API_BASE_URL}/analyze`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ filePath: filePath.trim() })
        });
      }

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `Server responded with status HTTP ${res.status}`);
      }

      const data = await res.json();
      setResult(data);
      if (data.packages && data.packages.length > 0) {
        setSelectedPackageId(data.packages[0].id);
      }
    } catch (err) {
      if (err.message && err.message.includes('Failed to fetch')) {
        setError(
          `Unable to connect to analysis server at ${API_BASE_URL}. Ensure the backend is running with "npm start" in the server directory, or enable the "USE_MOCK" toggle above.`
        );
      } else {
        setError(err.message || 'Analysis failed. Please check the lockfile format and try again.');
      }
    } finally {
      setLoading(false);
      setLoadingStep('');
    }
  };

  // Handle "Use sample" button click
  const handleUseSample = async () => {
    setError(null);

    if (useMock) {
      return loadMockResult();
    }

    setLoading(true);
    setLoadingStep('Analyzing sample package-lock.json on server...');

    try {
      const res = await fetch(`${API_BASE_URL}/sample`);

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `Failed to fetch sample: HTTP ${res.status}`);
      }

      const data = await res.json();
      setResult(data);
      if (data.packages && data.packages.length > 0) {
        setSelectedPackageId(data.packages[0].id);
      }
    } catch (err) {
      if (err.message && err.message.includes('Failed to fetch')) {
        setError(
          `Unable to connect to analysis server at ${API_BASE_URL}. Ensure backend is running or toggle "USE_MOCK" on.`
        );
      } else {
        setError(err.message || 'Failed to analyze sample lockfile.');
      }
    } finally {
      setLoading(false);
      setLoadingStep('');
    }
  };

  // Find currently selected package object
  const selectedPkg = result?.packages?.find(p => p.id === selectedPackageId) || null;

  return (
    <div className="upload-page">
      {/* Top Banner & Mode Toggle */}
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <span className="title-highlight">Dependency</span> Inspector
          </h1>
          <p className="page-subtitle">
            Scan Node.js lockfiles for vulnerabilities, deprecations, risky licenses, and single-command upgrades.
          </p>
        </div>

        {/* USE_MOCK Toggle */}
        <div className="mock-toggle-container">
          <label className="toggle-switch-label">
            <input
              type="checkbox"
              checked={useMock}
              onChange={(e) => setUseMock(e.target.checked)}
              className="toggle-checkbox"
            />
            <span className="toggle-slider"></span>
            <span className="toggle-text">
              USE_MOCK: <strong>{useMock ? 'ENABLED (/mock/result.json)' : 'DISABLED (Live API)'}</strong>
            </span>
          </label>
        </div>
      </div>

      {/* Upload Card */}
      <div className="upload-card">
        <h2 className="card-heading">Analyze Project Lockfile</h2>
        <p className="card-subheading">
          Upload your <code>package-lock.json</code> or specify the file path on your system.
        </p>

        <div className="upload-form-grid">
          {/* File Picker */}
          <div className="form-group">
            <label className="input-label">1. Choose Lockfile (File Picker)</label>
            <div className="file-input-wrapper">
              <input
                type="file"
                id="lockfile-upload"
                className="native-file-input"
                accept=".json"
                onChange={handleFileChange}
                disabled={loading}
              />
              <label htmlFor="lockfile-upload" className="custom-file-button">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="17 8 12 3 7 8"></polyline>
                  <line x1="12" y1="3" x2="12" y2="15"></line>
                </svg>
                <span>{selectedFile ? selectedFile.name : 'Choose File...'}</span>
              </label>
              {selectedFile && (
                <button
                  type="button"
                  className="remove-file-btn"
                  onClick={() => setSelectedFile(null)}
                  title="Remove selected file"
                >
                  ✕
                </button>
              )}
            </div>
            {selectedFile && (
              <span className="file-meta">
                {(selectedFile.size / 1024).toFixed(1)} KB • Ready to analyze
              </span>
            )}
          </div>

          <div className="form-divider-or">
            <span>OR</span>
          </div>

          {/* Text Field for File Path */}
          <div className="form-group">
            <label className="input-label" htmlFor="file-path-input">
              2. Absolute / Relative File Path
            </label>
            <div className="text-input-wrapper">
              <input
                id="file-path-input"
                type="text"
                className="text-input"
                placeholder="e.g. samples/package-lock.json"
                value={filePath}
                onChange={(e) => {
                  setFilePath(e.target.value);
                  setError(null);
                }}
                disabled={loading}
              />
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="action-button-row">
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleAnalyze}
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="spinner"></span>
                <span>Analyzing...</span>
              </>
            ) : (
              <>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polygon points="5 3 19 12 5 21 5 3"></polygon>
                </svg>
                <span>Analyze</span>
              </>
            )}
          </button>

          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleUseSample}
            disabled={loading}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
              <line x1="8" y1="21" x2="16" y2="21"></line>
              <line x1="12" y1="17" x2="12" y2="21"></line>
            </svg>
            <span>Use Sample Lockfile</span>
          </button>

          {result && (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                setResult(null);
                setSelectedPackageId(null);
                setSelectedFile(null);
                setFilePath('');
              }}
            >
              Reset Results
            </button>
          )}
        </div>

        {/* Loading Indicator */}
        {loading && (
          <div className="loading-banner">
            <div className="spinner-large"></div>
            <p className="loading-text">{loadingStep || 'Processing lockfile...'}</p>
          </div>
        )}

        {/* Error Alert Box */}
        {error && (
          <div className="error-alert">
            <div className="error-alert-icon">⚠️</div>
            <div className="error-alert-content">
              <strong>Error during analysis:</strong>
              <p>{error}</p>
            </div>
            <button
              className="error-dismiss-btn"
              onClick={() => setError(null)}
              title="Dismiss error"
            >
              ✕
            </button>
          </div>
        )}
      </div>

      {/* Results Section */}
      {result && (
        <div className="results-container">
          <div className="results-heading-bar">
            <h2>Analysis Results</h2>
            <span className="results-badge">
              {result.packages ? result.packages.length : 0} Total Dependencies Analyzed
            </span>
          </div>

          {/* Project Summary Cards */}
          <ProjectSummary result={result} />

          {/* Layout: Table on left/center, Package Details Inspector on right */}
          <div className="results-content-layout">
            <div className="table-column">
              <ResultsTable
                packages={result.packages || []}
                onSelect={(id) => setSelectedPackageId(id)}
                selectedId={selectedPackageId}
              />
            </div>

            {selectedPkg && (
              <div className="details-column">
                <PackageDetails
                  pkg={selectedPkg}
                  onClose={() => setSelectedPackageId(null)}
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
