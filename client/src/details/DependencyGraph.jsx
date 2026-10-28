import React, { useState, useEffect, useRef, useMemo } from 'react';
import ForceGraph2D from 'react-force-graph-2d';

/**
 * Returns color string for a given score/risk level.
 */
function getNodeColor(score = 0) {
  const s = Number(score) || 0;
  if (s >= 60) return '#ef4444'; // Critical Red
  if (s >= 40) return '#f97316'; // High Orange
  if (s >= 20) return '#f59e0b'; // Medium Amber
  return '#10b981';              // Low / None Gray-Green
}

/**
 * Returns radius size based on risk score.
 */
function getNodeRadius(score = 0) {
  const s = Number(score) || 0;
  // Radius between 5px and 16px
  return Math.max(5, Math.min(16, 5 + (s / 100) * 11));
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
          backgroundColor="#090d16"
          nodeId="id"
          nodeVal={node => node.radius}
          cooldownTicks={120}
          onNodeClick={node => onSelect && onSelect(node.id)}
          linkDirectionalArrowLength={4}
          linkDirectionalArrowRelPos={0.95}
          // Link coloring and width highlighting
          linkWidth={link => {
            const linkKey1 = `${link.source?.id || link.source}->${link.target?.id || link.target}`;
            const linkKey2 = `${link.target?.id || link.target}->${link.source?.id || link.source}`;
            const isHighlight =
              highlightedEdgeKeys.has(linkKey1) ||
              highlightedEdgeKeys.has(linkKey2) ||
              (highlightedNodeIds.has(link.source?.id || link.source) &&
                highlightedNodeIds.has(link.target?.id || link.target));

            return isHighlight ? 3.5 : 1;
          }}
          linkColor={link => {
            const linkKey1 = `${link.source?.id || link.source}->${link.target?.id || link.target}`;
            const linkKey2 = `${link.target?.id || link.target}->${link.source?.id || link.source}`;
            const isHighlight =
              highlightedEdgeKeys.has(linkKey1) ||
              highlightedEdgeKeys.has(linkKey2) ||
              (highlightedNodeIds.has(link.source?.id || link.source) &&
                highlightedNodeIds.has(link.target?.id || link.target));

            if (isHighlight) return '#ef4444';
            if (hasSelection) return 'rgba(51, 65, 85, 0.2)';
            return 'rgba(100, 116, 139, 0.45)';
          }}
          // Custom Node Canvas Renderer
          nodeCanvasObject={(node, ctx, globalScale) => {
            const isSelected = selectedId === node.id;
            const isPathNode = highlightedNodeIds.has(node.id);
            const radius = node.radius || 6;

            // Opacity: Dim if selection exists and node is not in path
            let alpha = 1;
            if (hasSelection && !isPathNode && !isSelected) {
              alpha = 0.25;
            }

            ctx.save();
            ctx.globalAlpha = alpha;

            // Highlight ring for path and selected node
            if (isSelected) {
              ctx.beginPath();
              ctx.arc(node.x, node.y, radius + 4, 0, 2 * Math.PI, false);
              ctx.strokeStyle = '#60a5fa';
              ctx.lineWidth = 3;
              ctx.shadowColor = '#3b82f6';
              ctx.shadowBlur = 10;
              ctx.stroke();
            } else if (isPathNode) {
              ctx.beginPath();
              ctx.arc(node.x, node.y, radius + 3, 0, 2 * Math.PI, false);
              ctx.strokeStyle = '#ef4444';
              ctx.lineWidth = 2.5;
              ctx.shadowColor = '#ef4444';
              ctx.shadowBlur = 8;
              ctx.stroke();
            }

            // Draw Node Circle
            ctx.beginPath();
            ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI, false);
            ctx.fillStyle = node.color || '#10b981';
            ctx.fill();

            ctx.strokeStyle = '#1e293b';
            ctx.lineWidth = 1;
            ctx.stroke();

            // Label text: show label if zoomed in, or if node is selected/in path, or score is high
            const shouldShowLabel =
              globalScale > 1.8 || isSelected || isPathNode || node.score >= 50;

            if (shouldShowLabel) {
              const label = node.name || node.id;
              const fontSize = Math.max(9, Math.min(13, 11 / Math.sqrt(globalScale)));
              ctx.font = `${isSelected ? 'bold ' : ''}${fontSize}px JetBrains Mono, sans-serif`;
              ctx.textAlign = 'center';
              ctx.textBaseline = 'top';

              // Text background bubble for readability
              const textWidth = ctx.measureText(label).width;
              ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
              ctx.fillRect(
                node.x - textWidth / 2 - 3,
                node.y + radius + 2,
                textWidth + 6,
                fontSize + 4
              );

              ctx.fillStyle = isSelected ? '#93c5fd' : isPathNode ? '#fca5a5' : '#f1f5f9';
              ctx.fillText(label, node.x, node.y + radius + 4);
            }

            ctx.restore();
          }}
          nodePointerAreaPaint={(node, color, ctx) => {
            const radius = (node.radius || 6) + 4;
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
