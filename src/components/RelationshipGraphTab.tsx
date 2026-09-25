import React, { useState, useEffect, useRef } from 'react';
import {
  Network,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Filter,
  ShieldAlert,
  ShieldCheck,
  Ban,
  Activity,
  X,
  Layers,
  Search,
  CheckCircle,
} from 'lucide-react';
import type { GraphNode, GraphEdge, RelationshipGraphData, UserRole } from '../types/sentinel';

interface RelationshipGraphTabProps {
  activeRole: UserRole;
  onManualBlockClient: (clientId: string, durationSec: number, reason: string) => Promise<void>;
  onUnblockClient: (clientId: string) => Promise<void>;
}

export const RelationshipGraphTab: React.FC<RelationshipGraphTabProps> = ({
  activeRole,
  onManualBlockClient,
  onUnblockClient,
}) => {
  const [graphData, setGraphData] = useState<RelationshipGraphData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<GraphEdge | null>(null);
  const [filterType, setFilterType] = useState<string>('all');
  const [filterRiskOnly, setFilterRiskOnly] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  // Fetch relationship graph from API Sentinel
  const fetchGraph = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/relationship-graph');
      if (res.ok) {
        const data: RelationshipGraphData = await res.json();
        // Compute circular / force layout coordinates for nodes
        const width = 800;
        const height = 500;
        const centerX = width / 2;
        const centerY = height / 2;
        const count = data.nodes.length;

        const laidOutNodes = data.nodes.map((node, i) => {
          // Layout nodes hierarchically or clustered by type
          let radius = 180;
          if (node.type === 'endpoint') radius = 80;
          else if (node.type === 'ip') radius = 220;
          else if (node.type === 'account') radius = 140;

          const angle = (i / count) * 2 * Math.PI;
          return {
            ...node,
            x: centerX + radius * Math.cos(angle) + (node.riskScore > 70 ? (Math.random() - 0.5) * 40 : 0),
            y: centerY + radius * Math.sin(angle) * 0.85 + (node.riskScore > 70 ? (Math.random() - 0.5) * 40 : 0),
          };
        });

        setGraphData({ nodes: laidOutNodes, edges: data.edges });
        if (laidOutNodes.length > 0 && !selectedNode) {
          setSelectedNode(laidOutNodes[0]);
        }
      }
    } catch (e) {
      console.error('Failed to load relationship graph:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGraph();
  }, []);

  // Zoom controls
  const handleZoomIn = () => setZoom((prev) => Math.min(2.5, prev + 0.2));
  const handleZoomOut = () => setZoom((prev) => Math.max(0.5, prev - 0.2));
  const handleResetZoom = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  // Pan controls
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.target instanceof SVGElement && e.target.tagName === 'svg') {
      setIsDragging(true);
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setPan({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  };

  const handleMouseUp = () => setIsDragging(false);

  // Filter nodes
  const visibleNodes = (graphData?.nodes || []).filter((n) => {
    const matchesType = filterType === 'all' || n.type === filterType;
    const matchesRisk = !filterRiskOnly || n.riskScore >= 60;
    return matchesType && matchesRisk;
  });

  const visibleNodeIds = new Set(visibleNodes.map((n) => n.id));

  const visibleEdges = (graphData?.edges || []).filter(
    (e) => visibleNodeIds.has(e.source) && visibleNodeIds.has(e.target)
  );

  const getNodeColor = (node: GraphNode) => {
    if (node.type === 'endpoint') return '#38bdf8'; // sky
    if (node.riskScore >= 80) return '#f43f5e'; // rose (critical)
    if (node.riskScore >= 60) return '#f59e0b'; // amber (high)
    if (node.type === 'account') return '#818cf8'; // indigo
    return '#10b981'; // emerald
  };

  const handleBlockNode = async (node: GraphNode) => {
    await onManualBlockClient(node.id, 300, `Quarantined from Relationship Graph investigation (${node.id})`);
    setActionNotice(`Entity ${node.label} quarantined for 5 minutes.`);
    setTimeout(() => setActionNotice(null), 4000);
  };

  const handleUnblockNode = async (node: GraphNode) => {
    await onUnblockClient(node.id);
    setActionNotice(`Entity ${node.label} pardoned.`);
    setTimeout(() => setActionNotice(null), 4000);
  };

  return (
    <div className="space-y-4">
      {/* Header Banner */}
      <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
            <Network className="w-4 h-4 text-cyan-400" />
            Behavior Relationship Graph (Multi-Entity Correlation)
          </h2>
          <p className="text-xs text-slate-400 mt-0.5 max-w-3xl leading-relaxed">
            Visualizes interconnected entities (IPs, User Accounts, Sessions, and Endpoints). Highlighted pulsing edges reveal synchronized behavioral coordination across distinct subnets. Click any node or edge to inspect fingerprint evidence.
          </p>
        </div>

        {/* Toolbar & Filter Controls */}
        <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
          {/* Entity Type Filter */}
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-slate-200"
          >
            <option value="all">All Entity Types</option>
            <option value="ip">IP Addresses Only</option>
            <option value="account">User Accounts Only</option>
            <option value="endpoint">API Endpoints Only</option>
            <option value="session">Sessions Only</option>
          </select>

          {/* High Risk Toggle */}
          <button
            onClick={() => setFilterRiskOnly(!filterRiskOnly)}
            className={`px-3 py-1 rounded border transition-colors ${
              filterRiskOnly
                ? 'bg-rose-950/80 text-rose-300 border-rose-700 font-bold'
                : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
            }`}
          >
            High Risk (60+)
          </button>

          {/* Zoom Actions */}
          <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 rounded p-0.5">
            <button
              onClick={handleZoomIn}
              title="Zoom In"
              className="p-1 hover:bg-slate-800 rounded text-slate-300"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleZoomOut}
              title="Zoom Out"
              className="p-1 hover:bg-slate-800 rounded text-slate-300"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleResetZoom}
              title="Reset View"
              className="p-1 hover:bg-slate-800 rounded text-slate-300"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {actionNotice && (
        <div className="p-3 bg-emerald-950/80 border border-emerald-700/80 rounded-lg text-emerald-200 text-xs font-mono flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{actionNotice}</span>
        </div>
      )}

      {/* Main Canvas & Inspector Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (8 cols): Interactive SVG Canvas */}
        <div
          ref={containerRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          className="lg:col-span-8 relative aspect-[800/520] bg-slate-950 border border-slate-800 rounded-xl overflow-hidden cursor-grab active:cursor-grabbing select-none shadow-xl"
        >
          {loading ? (
            <div className="w-full h-full flex items-center justify-center text-slate-500 font-mono text-xs">
              Synthesizing entity relationship topologies...
            </div>
          ) : (
            <svg
              viewBox="0 0 800 520"
              className="w-full h-full"
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                transformOrigin: 'center center',
                transition: isDragging ? 'none' : 'transform 0.15s ease-out',
              }}
            >
              <defs>
                {/* Glow Filter for coordinated edges */}
                <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
              </defs>

              {/* Edge Lines */}
              <g className="edges">
                {visibleEdges.map((edge) => {
                  const sourceNode = visibleNodes.find((n) => n.id === edge.source);
                  const targetNode = visibleNodes.find((n) => n.id === edge.target);
                  if (!sourceNode || !targetNode) return null;

                  const isSelected = selectedEdge?.id === edge.id;
                  const isCoord = edge.isHighlighted;

                  return (
                    <g key={edge.id} className="cursor-pointer" onClick={() => setSelectedEdge(edge)}>
                      {/* Thicker invisible hit-line */}
                      <line
                        x1={sourceNode.x}
                        y1={sourceNode.y}
                        x2={targetNode.x}
                        y2={targetNode.y}
                        stroke="transparent"
                        strokeWidth="12"
                      />

                      {/* Actual visible link line */}
                      <line
                        x1={sourceNode.x}
                        y1={sourceNode.y}
                        x2={targetNode.x}
                        y2={targetNode.y}
                        stroke={isCoord ? '#f43f5e' : '#475569'}
                        strokeWidth={isSelected ? 3.5 : isCoord ? 2.5 : 1.2}
                        strokeDasharray={edge.relationshipType === 'similar_timing' ? '4 3' : undefined}
                        opacity={isCoord ? 0.85 : 0.4}
                        filter={isCoord ? 'url(#glow)' : undefined}
                      />

                      {/* Similarity badge along edge */}
                      {isCoord && (
                        <text
                          x={((sourceNode.x || 0) + (targetNode.x || 0)) / 2}
                          y={((sourceNode.y || 0) + (targetNode.y || 0)) / 2 - 4}
                          textAnchor="middle"
                          fontSize="9"
                          fill="#f43f5e"
                          fontFamily="monospace"
                          fontWeight="bold"
                        >
                          {edge.similarityScore}%
                        </text>
                      )}
                    </g>
                  );
                })}
              </g>

              {/* Graph Nodes */}
              <g className="nodes">
                {visibleNodes.map((node) => {
                  const isSelected = selectedNode?.id === node.id;
                  const color = getNodeColor(node);
                  const radius = node.type === 'endpoint' ? 16 : node.type === 'ip' ? 14 : 11;

                  return (
                    <g
                      key={node.id}
                      transform={`translate(${node.x}, ${node.y})`}
                      onClick={() => {
                        setSelectedNode(node);
                        setSelectedEdge(null);
                      }}
                      className="cursor-pointer group"
                    >
                      {/* Pulse ring for high risk */}
                      {node.riskScore >= 80 && (
                        <circle
                          r={radius + 8}
                          fill="none"
                          stroke={color}
                          strokeWidth="1.5"
                          opacity="0.35"
                          className="animate-ping"
                        />
                      )}

                      {/* Selection ring */}
                      {isSelected && (
                        <circle
                          r={radius + 5}
                          fill="none"
                          stroke="#38bdf8"
                          strokeWidth="2.5"
                          strokeDasharray="3 3"
                        />
                      )}

                      {/* Main node bubble */}
                      <circle
                        r={radius}
                        fill="#090d16"
                        stroke={color}
                        strokeWidth={node.riskScore >= 70 ? 3 : 2}
                      />

                      {/* Inner dot */}
                      <circle r={radius * 0.45} fill={color} />

                      {/* Label Text */}
                      <text
                        y={radius + 12}
                        textAnchor="middle"
                        fontSize="9.5"
                        fill="#cbd5e1"
                        fontFamily="monospace"
                        fontWeight={isSelected ? 'bold' : 'normal'}
                      >
                        {node.id.length > 18 ? node.id.substring(0, 16) + '…' : node.id}
                      </text>
                    </g>
                  );
                })}
              </g>
            </svg>
          )}

          {/* Canvas Bottom Legend */}
          <div className="absolute bottom-3 left-3 flex flex-wrap items-center gap-3 bg-slate-900/90 backdrop-blur-md px-3 py-1.5 rounded-lg border border-slate-800 text-[10px] font-mono text-slate-400 pointer-events-none">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
              <span>Critical Threat (&gt;80)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
              <span>High Risk (60-79)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-sky-400" />
              <span>Endpoint Target</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
              <span>Nominal / Student</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-4 h-0.5 bg-rose-500 inline-block" />
              <span>Coordinated Edge (90%+)</span>
            </div>
          </div>
        </div>

        {/* Right Column (4 cols): Node & Edge Inspector Drawer (Prompt Section 8) */}
        <div className="lg:col-span-4 space-y-4">
          {selectedNode ? (
            <div className="p-5 bg-slate-900/80 border border-slate-800 rounded-xl space-y-4 shadow-xl text-xs font-mono">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="space-y-0.5">
                  <span className="text-[10px] text-slate-500 uppercase tracking-widest block">
                    Entity Topology Node
                  </span>
                  <h3 className="text-sm font-bold text-slate-100 truncate max-w-[200px]">
                    {selectedNode.label}
                  </h3>
                </div>
                <span
                  className="px-2 py-0.5 text-[10px] font-bold rounded uppercase border"
                  style={{
                    color: getNodeColor(selectedNode),
                    borderColor: getNodeColor(selectedNode),
                    backgroundColor: 'rgba(0,0,0,0.4)',
                  }}
                >
                  {selectedNode.type}
                </span>
              </div>

              {/* KPI metrics */}
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="p-2.5 bg-slate-950/60 rounded border border-slate-800">
                  <span className="text-slate-500 block text-[10px]">Risk Index</span>
                  <span
                    className={`text-lg font-bold ${
                      selectedNode.riskScore >= 80
                        ? 'text-rose-400'
                        : selectedNode.riskScore >= 60
                        ? 'text-amber-400'
                        : 'text-emerald-400'
                    }`}
                  >
                    {selectedNode.riskScore} / 100
                  </span>
                </div>

                <div className="p-2.5 bg-slate-950/60 rounded border border-slate-800">
                  <span className="text-slate-500 block text-[10px]">Request Rate</span>
                  <span className="text-lg font-bold text-slate-200">
                    {selectedNode.requestRate} <span className="text-xs font-normal text-slate-500">RPS</span>
                  </span>
                </div>

                <div className="p-2.5 bg-slate-950/60 rounded border border-slate-800">
                  <span className="text-slate-500 block text-[10px]">Failure Ratio</span>
                  <span className="text-sm font-bold text-amber-400">
                    {Math.round(selectedNode.failureRatio * 100)}%
                  </span>
                </div>

                <div className="p-2.5 bg-slate-950/60 rounded border border-slate-800">
                  <span className="text-slate-500 block text-[10px]">Related Peers</span>
                  <span className="text-sm font-bold text-cyan-400">
                    {selectedNode.relatedEntities.length} entities
                  </span>
                </div>
              </div>

              {/* Top Endpoints */}
              <div className="space-y-1.5">
                <span className="text-slate-400 text-[10px] uppercase tracking-wider block">
                  Top Targeted Endpoints:
                </span>
                <div className="space-y-1">
                  {selectedNode.topEndpoints.map((ep, i) => (
                    <div
                      key={i}
                      className="p-1.5 bg-slate-950/70 border border-slate-800/80 rounded text-[11px] text-slate-300 truncate"
                    >
                      {ep}
                    </div>
                  ))}
                </div>
              </div>

              {/* Connected Entities */}
              <div className="space-y-1.5">
                <span className="text-slate-400 text-[10px] uppercase tracking-wider block">
                  Correlated Entity Links:
                </span>
                <div className="flex flex-wrap gap-1">
                  {selectedNode.relatedEntities.map((rel, i) => (
                    <span
                      key={i}
                      className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-slate-300 text-[10px]"
                    >
                      {rel}
                    </span>
                  ))}
                </div>
              </div>

              {/* Quick Sanction Buttons for Admins */}
              {activeRole === 'admin' && (
                <div className="pt-3 border-t border-slate-800 flex items-center gap-2">
                  <button
                    onClick={() => handleBlockNode(selectedNode)}
                    className="flex-1 py-2 bg-rose-900/60 hover:bg-rose-800/80 text-rose-200 font-semibold rounded border border-rose-700/60 transition-colors text-[11px] flex items-center justify-center gap-1.5"
                  >
                    <Ban className="w-3.5 h-3.5" />
                    Quarantine Entity
                  </button>
                  <button
                    onClick={() => handleUnblockNode(selectedNode)}
                    className="py-2 px-3 bg-slate-800 hover:bg-slate-700 text-emerald-300 rounded border border-slate-700 transition-colors text-[11px]"
                  >
                    Pardon
                  </button>
                </div>
              )}
            </div>
          ) : selectedEdge ? (
            <div className="p-5 bg-slate-900/80 border border-slate-800 rounded-xl space-y-4 shadow-xl text-xs font-mono">
              <div className="border-b border-slate-800 pb-3">
                <span className="text-[10px] text-slate-500 uppercase tracking-widest block">
                  Edge Correlation Link
                </span>
                <h3 className="text-sm font-bold text-slate-100">
                  {selectedEdge.relationshipType.replace(/_/g, ' ').toUpperCase()}
                </h3>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between p-2 rounded bg-slate-950 border border-slate-800">
                  <span className="text-slate-400">Behavior Similarity:</span>
                  <span className="text-rose-400 font-bold text-sm">
                    {selectedEdge.similarityScore}%
                  </span>
                </div>
                <div className="p-2 rounded bg-slate-950 border border-slate-800 text-[11px] space-y-1">
                  <div className="text-slate-400">Source: <span className="text-slate-200">{selectedEdge.source}</span></div>
                  <div className="text-slate-400">Target: <span className="text-slate-200">{selectedEdge.target}</span></div>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-8 text-center text-slate-500 font-mono text-xs bg-slate-900/40 border border-slate-800 rounded-xl">
              Click any node or link in the graph to inspect detailed behavioral evidence.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
