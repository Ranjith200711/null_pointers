import React, { useState, useEffect, useRef, useMemo } from 'react';
import ForceGraph2D from 'react-force-graph-2d';

/**
 * Returns color string for a given score/risk level (high-contrast on white background).
 */
function getNodeColor(score = 0) {
  const s = Number(score) || 0;
  if (s >= 60) return '#dc2626'; // High Contrast Crimson Red
  if (s >= 40) return '#ea580c'; // High Contrast Dark Orange
  if (s >= 20) return '#d97706'; // High Contrast Warm Amber
  return '#059669';              // High Contrast Emerald Green
}

/**
 * Returns radius size based on risk score (prominent on white canvas).
 */
function getNodeRadius(score = 0) {
  const s = Number(score) || 0;
  // Radius between 7px and 22px
  return Math.max(7, Math.min(22, 7 + (s / 100) * 15));
}

export default function DependencyGraph({
  graph,
  selectedId,
  packages = [],
  onSelect
}) {
  const fgRef = useRef();
  const containerRef = useRef();

  // Container dimensions for responsive canvas
  const [dimensions, setDimensions] = useState({ width: 900, height: 520 });

  // Filter toggle: show only risky nodes if node count > 100 (or on demand)
  const [onlyRisky, setOnlyRisky] = useState(false);

  // Resize listener
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const { width } = containerRef.current.getBoundingClientRect();
        if (width > 0) {
          setDimensions(prev => ({
            ...prev,
            width: Math.floor(width)
          }));
        }
      }
    };

    updateDimensions();
    const ro = new ResizeObserver(updateDimensions);
    if (containerRef.current) ro.observe(containerRef.current);
    window.addEventListener('resize', updateDimensions);

    return () => {
      ro.disconnect();
      window.removeEventListener('resize', updateDimensions);
    };
  }, []);

  // Quick lookup from package id to package data
  const packageMap = useMemo(() => {
    const map = new Map();
    if (Array.isArray(packages)) {
      for (const p of packages) {
        if (p && p.id) map.set(p.id, p);
      }
    }
    return map;
  }, [packages]);

  // Selected package details
  const selectedPkg = selectedId ? packageMap.get(selectedId) : null;

  // Determine highlighted nodes and edges along blastRadius.path
  const { highlightedNodeIds, highlightedEdgeKeys } = useMemo(() => {
    const nodeIds = new Set();
    const edgeKeys = new Set();

    if (selectedPkg) {
      nodeIds.add(selectedPkg.id);

      // Check blastRadius.path
      const path =
        typeof selectedPkg.blastRadius === 'object' && selectedPkg.blastRadius !== null
          ? selectedPkg.blastRadius.path
          : null;

      if (Array.isArray(path)) {
        for (let i = 0; i < path.length; i++) {
          const id = path[i];
          if (id && id !== 'app') {
            nodeIds.add(id);
          }
          if (i > 0) {
            const prev = path[i - 1];
            const curr = path[i];
            if (prev && curr && prev !== 'app') {
              edgeKeys.add(`${prev}->${curr}`);
              edgeKeys.add(`${curr}->${prev}`);
            }
          }
        }
      }
    }

    return { highlightedNodeIds: nodeIds, highlightedEdgeKeys: edgeKeys };
  }, [selectedPkg]);

  const rawNodes = graph?.nodes || [];
  const rawEdges = graph?.edges || [];
  const hasManyNodes = rawNodes.length > 100;

  // Prepared graph data for ForceGraph2D
  const graphData = useMemo(() => {
    if (!graph || !Array.isArray(rawNodes) || rawNodes.length === 0) {
      return { nodes: [], links: [] };
    }

    // Filter nodes if onlyRisky is active
    let nodesToUse = rawNodes;
    if (onlyRisky) {
      nodesToUse = rawNodes.filter(n => {
        const pkg = packageMap.get(n.id);
        const score = pkg?.score ?? n.risk ?? 0;
        // Keep node if risky (score >= 20) OR if it is in the highlighted path
        return score >= 20 || highlightedNodeIds.has(n.id);
      });
    }

    const validNodeIdSet = new Set(nodesToUse.map(n => n.id));

    // Clone nodes with metadata
    const nodes = nodesToUse.map(n => {
      const pkg = packageMap.get(n.id);
      const score = pkg?.score ?? n.risk ?? 0;
      return {
        id: n.id,
        name: n.name || n.id.split('@')[0] || n.id,
        score,
        color: getNodeColor(score),
        radius: getNodeRadius(score)
      };
    });

    // Format links
    const links = [];
    for (const edge of rawEdges) {
      const from = edge.from || edge.source;
      const to = edge.to || edge.target;
      if (validNodeIdSet.has(from) && validNodeIdSet.has(to)) {
        links.push({
          source: from,
          target: to,
          key: `${from}->${to}`
        });
      }
    }

    return { nodes, links };
  }, [graph, rawNodes, rawEdges, onlyRisky, packageMap, highlightedNodeIds]);

  // Zoom handlers
  const handleZoomIn = () => {
    if (fgRef.current) {
      fgRef.current.zoom(fgRef.current.zoom() * 1.35, 400);
    }
  };

  const handleZoomOut = () => {
    if (fgRef.current) {
      fgRef.current.zoom(fgRef.current.zoom() / 1.35, 400);
    }
  };

  const handleZoomReset = () => {
    if (fgRef.current) {
      fgRef.current.zoomToFit(400, 36);
    }
  };

  const hasSelection = Boolean(selectedId);

  return (
    <div className="dependency-graph-card" ref={containerRef}>
      {/* Header with Title, Controls, and Legend */}
      <div className="graph-card-header">
        <div>
          <h3 className="graph-title">Interactive Dependency Graph</h3>
          <p className="graph-subtitle">
            Visualizing package relationships, blast radius chains, and supply chain exposure.
          </p>
        </div>

        <div className="graph-header-controls">
          {/* Toggle for risky nodes (visible when > 100 nodes or user toggle) */}
          {(hasManyNodes || onlyRisky) && (
            <label className="risky-filter-toggle">
              <input
                type="checkbox"
                checked={onlyRisky}
                onChange={e => setOnlyRisky(e.target.checked)}
              />
              <span>Show Only Risky Nodes (≥20)</span>
            </label>
          )}

          {/* Zoom Control Buttons */}
          <div className="zoom-btn-group">
            <button className="graph-control-btn" onClick={handleZoomIn} title="Zoom In">
              +
            </button>
            <button className="graph-control-btn" onClick={handleZoomOut} title="Zoom Out">
              −
            </button>
            <button className="graph-control-btn" onClick={handleZoomReset} title="Fit to Screen">
              ⛶
            </button>
          </div>
        </div>
      </div>

      {/* Graph Legend */}
      <div className="graph-legend-bar">
        <div className="legend-items">
          <span className="legend-label">Node Risk:</span>
          <div className="legend-pill">
            <span className="legend-dot" style={{ backgroundColor: '#ef4444' }} />
            <span>Critical (&ge;60)</span>
          </div>
          <div className="legend-pill">
            <span className="legend-dot" style={{ backgroundColor: '#f97316' }} />
            <span>High (40–59)</span>
          </div>
          <div className="legend-pill">
            <span className="legend-dot" style={{ backgroundColor: '#f59e0b' }} />
            <span>Medium (20–39)</span>
          </div>
          <div className="legend-pill">
            <span className="legend-dot" style={{ backgroundColor: '#10b981' }} />
            <span>Low (&lt;20)</span>
          </div>
          {hasSelection && (
            <div className="legend-pill legend-highlight-indicator">
              <span className="legend-glow-dot" />
              <span>Blast Radius Path (Highlighted)</span>
            </div>
          )}
        </div>

        <span className="node-stats-tag">
          {graphData.nodes.length} nodes • {graphData.links.length} edges
        </span>
      </div>

      {/* Force Graph Canvas Area */}
      <div className="canvas-wrapper">
        <ForceGraph2D
          ref={fgRef}
          width={dimensions.width}
          height={dimensions.height}
          graphData={graphData}
          backgroundColor="#ffffff"
          nodeId="id"
          nodeVal={node => node.radius}
          cooldownTicks={120}
          onNodeClick={node => onSelect && onSelect(node.id)}
          linkDirectionalArrowLength={6}
          linkDirectionalArrowRelPos={0.96}
          linkDirectionalArrowColor={link => {
            const linkKey1 = `${link.source?.id || link.source}->${link.target?.id || link.target}`;
            const linkKey2 = `${link.target?.id || link.target}->${link.source?.id || link.source}`;
            const isHighlight =
              highlightedEdgeKeys.has(linkKey1) ||
              highlightedEdgeKeys.has(linkKey2) ||
              (highlightedNodeIds.has(link.source?.id || link.source) &&
                highlightedNodeIds.has(link.target?.id || link.target));

            if (isHighlight) return '#dc2626';
            if (hasSelection) return 'rgba(100, 116, 139, 0.45)';
            return '#0f172a';
          }}
          // Link coloring and width highlighting
          linkWidth={link => {
            const linkKey1 = `${link.source?.id || link.source}->${link.target?.id || link.target}`;
            const linkKey2 = `${link.target?.id || link.target}->${link.source?.id || link.source}`;
            const isHighlight =
              highlightedEdgeKeys.has(linkKey1) ||
              highlightedEdgeKeys.has(linkKey2) ||
              (highlightedNodeIds.has(link.source?.id || link.source) &&
                highlightedNodeIds.has(link.target?.id || link.target));

            return isHighlight ? 4.5 : 2;
          }}
          linkColor={link => {
            const linkKey1 = `${link.source?.id || link.source}->${link.target?.id || link.target}`;
            const linkKey2 = `${link.target?.id || link.target}->${link.source?.id || link.source}`;
            const isHighlight =
              highlightedEdgeKeys.has(linkKey1) ||
              highlightedEdgeKeys.has(linkKey2) ||
              (highlightedNodeIds.has(link.source?.id || link.source) &&
                highlightedNodeIds.has(link.target?.id || link.target));

            if (isHighlight) return '#dc2626'; // Vivid Highlight Red
            if (hasSelection) return 'rgba(100, 116, 139, 0.45)'; // Clearly visible dimmed gray
            return '#0f172a'; // Bold Jet Black
          }}
          // Custom Node Canvas Renderer
          nodeCanvasObject={(node, ctx, globalScale) => {
            const isSelected = selectedId === node.id;
            const isPathNode = highlightedNodeIds.has(node.id);
            const radius = node.radius || 8;

            // Opacity: Dim non-selected nodes slightly to 0.45 so they remain clearly visible
            let alpha = 1;
            if (hasSelection && !isPathNode && !isSelected) {
              alpha = 0.45;
            }

            ctx.save();
            ctx.globalAlpha = alpha;

            // Highlight ring for path and selected node
            if (isSelected) {
              ctx.beginPath();
              ctx.arc(node.x, node.y, radius + 5, 0, 2 * Math.PI, false);
              ctx.strokeStyle = '#2563eb';
              ctx.lineWidth = 3.5;
              ctx.stroke();
            } else if (isPathNode) {
              ctx.beginPath();
              ctx.arc(node.x, node.y, radius + 4.5, 0, 2 * Math.PI, false);
              ctx.strokeStyle = '#dc2626';
              ctx.lineWidth = 3;
              ctx.stroke();
            }

            // Draw Node Circle
            ctx.beginPath();
            ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI, false);
            ctx.fillStyle = node.color || '#059669';
            ctx.fill();

            // Dark solid border around every node for contrast on white canvas
            ctx.strokeStyle = isSelected ? '#1e3a8a' : isPathNode ? '#991b1b' : '#0f172a';
            ctx.lineWidth = 2;
            ctx.stroke();

            // Label text: show on zoom, selection, path, or elevated score
            const shouldShowLabel =
              globalScale > 1.2 || isSelected || isPathNode || node.score >= 40;

            if (shouldShowLabel) {
              const label = node.name || node.id;
              const fontSize = Math.max(10, Math.min(14, 12 / Math.sqrt(globalScale)));
              ctx.font = `${isSelected || isPathNode ? 'bold ' : '600 '}${fontSize}px JetBrains Mono, monospace`;
              ctx.textAlign = 'center';
              ctx.textBaseline = 'top';

              const textWidth = ctx.measureText(label).width;
              const boxPadding = 4;
              const boxHeight = fontSize + 6;

              // Label background pill
              ctx.fillStyle = isSelected
                ? '#1e40af'
                : isPathNode
                ? '#991b1b'
                : '#ffffff';

              ctx.beginPath();
              if (ctx.roundRect) {
                ctx.roundRect(
                  node.x - textWidth / 2 - boxPadding,
                  node.y + radius + 4,
                  textWidth + boxPadding * 2,
                  boxHeight,
                  4
                );
              } else {
                ctx.rect(
                  node.x - textWidth / 2 - boxPadding,
                  node.y + radius + 4,
                  textWidth + boxPadding * 2,
                  boxHeight
                );
              }
              ctx.fill();

              ctx.strokeStyle = isSelected
                ? '#3b82f6'
                : isPathNode
                ? '#ef4444'
                : '#0f172a';
              ctx.lineWidth = 1.2;
              ctx.stroke();

              // Label text color
              ctx.fillStyle = (isSelected || isPathNode) ? '#ffffff' : '#0f172a';
              ctx.fillText(label, node.x, node.y + radius + 6);
            }

            ctx.restore();
          }}
          nodePointerAreaPaint={(node, color, ctx) => {
            const radius = (node.radius || 8) + 5;
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI, false);
            ctx.fill();
          }}
        />
      </div>
    </div>
  );
}
