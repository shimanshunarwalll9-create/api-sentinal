import React, { useState } from 'react';
import {
  Globe,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  Users,
  Network,
  Activity,
  ArrowRight,
  CheckCircle,
  Eye,
  Sliders,
  Sparkles,
  Search,
  Filter,
} from 'lucide-react';
import type { DistributedPattern, UserRole } from '../types/sentinel';

interface DistributedPatternsTabProps {
  patterns: DistributedPattern[];
  activeRole: UserRole;
  onNavigateToGraph: () => void;
  onRefreshAll: () => void;
}

export const DistributedPatternsTab: React.FC<DistributedPatternsTabProps> = ({
  patterns,
  activeRole,
  onNavigateToGraph,
  onRefreshAll,
}) => {
  const [selectedPattern, setSelectedPattern] = useState<DistributedPattern | null>(patterns[0] || null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'coordinated' | 'legitimate'>('all');

  const filtered = patterns.filter((p) => {
    const matchesSearch =
      p.patternName.toLowerCase().includes(search.toLowerCase()) ||
      p.relatedIps.some((ip) => ip.includes(search)) ||
      p.relatedAccounts.some((acc) => acc.toLowerCase().includes(search.toLowerCase())) ||
      p.reasons.some((r) => r.toLowerCase().includes(search.toLowerCase()));

    const matchesType =
      filterType === 'all' ||
      (filterType === 'coordinated' && !p.isLegitimateSpike) ||
      (filterType === 'legitimate' && p.isLegitimateSpike);

    return matchesSearch && matchesType;
  });

  const handleUpdateStatus = async (id: string, newStatus: string) => {
    setUpdatingId(id);
    try {
      const res = await fetch(`/api/distributed-patterns/${id}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        onRefreshAll();
        if (selectedPattern && selectedPattern.id === id) {
          setSelectedPattern({ ...selectedPattern, status: newStatus as any });
        }
      }
    } catch (e) {
      console.error('Failed to update pattern status:', e);
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner Guide on Distributed Pattern Detection */}
      <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-cyan-400" />
            <h2 className="text-sm font-semibold text-slate-100">
              Distributed Abuse Pattern Recognition & Behavioral Clustering
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-1 max-w-3xl leading-relaxed">
            Unlike isolated IP rate-limiters, API Sentinel creates multidimensional behavioral fingerprints across IP addresses, user accounts, sessions, and endpoint sequences to detect synchronized botnets while safely distinguishing legitimate surges (e.g. college result publication, ticket bookings).
          </p>
        </div>

        <button
          onClick={onNavigateToGraph}
          className="flex items-center gap-2 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs rounded-lg transition-colors shrink-0 shadow-sm"
        >
          <Network className="w-4 h-4" />
          <span>Open Relationship Graph</span>
        </button>
      </div>

      {/* Filter & Search Bar */}
      <div className="p-3 bg-slate-900/60 border border-slate-800 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-mono">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search pattern, IPs, accounts, reasons..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-md pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
          />
        </div>

        <div className="flex items-center gap-1.5 p-0.5 bg-slate-950 border border-slate-800 rounded-md">
          <button
            onClick={() => setFilterType('all')}
            className={`px-3 py-1 rounded transition-colors ${
              filterType === 'all' ? 'bg-slate-800 text-slate-100 font-bold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            All Clusters ({patterns.length})
          </button>
          <button
            onClick={() => setFilterType('coordinated')}
            className={`px-3 py-1 rounded transition-colors ${
              filterType === 'coordinated' ? 'bg-slate-800 text-rose-300 font-bold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Potential Abuse ({patterns.filter((p) => !p.isLegitimateSpike).length})
          </button>
          <button
            onClick={() => setFilterType('legitimate')}
            className={`px-3 py-1 rounded transition-colors ${
              filterType === 'legitimate' ? 'bg-slate-800 text-emerald-300 font-bold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Legitimate Surges ({patterns.filter((p) => p.isLegitimateSpike).length})
          </button>
        </div>
      </div>

      {/* Main Grid: Left patterns list, Right detailed inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (5 cols): Pattern Cards */}
        <div className="lg:col-span-5 space-y-3">
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-xs font-mono bg-slate-900/40 rounded-xl border border-slate-800">
              No distributed patterns matching criteria.
            </div>
          ) : (
            filtered.map((pat) => {
              const isSelected = selectedPattern?.id === pat.id;
              const isThreat = !pat.isLegitimateSpike;

              return (
                <div
                  key={pat.id}
                  onClick={() => setSelectedPattern(pat)}
                  className={`p-4 rounded-xl border cursor-pointer transition-all space-y-3 ${
                    isSelected
                      ? 'bg-slate-800/90 border-cyan-500/80 shadow-md ring-1 ring-cyan-500/30'
                      : 'bg-slate-900/70 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`w-2 h-2 rounded-full ${
                            isThreat ? 'bg-rose-400 animate-pulse' : 'bg-emerald-400'
                          }`}
                        />
                        <span
                          className={`text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${
                            isThreat
                              ? 'bg-rose-950/70 text-rose-300 border-rose-800'
                              : 'bg-emerald-950/70 text-emerald-300 border-emerald-800'
                          }`}
                        >
                          {isThreat ? 'Potential Coordinated Pattern' : 'Legitimate Traffic Surge'}
                        </span>
                      </div>
                      <h3 className="text-xs font-bold text-slate-100">{pat.patternName}</h3>
                    </div>

                    <div className="text-right font-mono shrink-0">
                      <div
                        className={`text-lg font-bold ${
                          pat.distributedThreatScore >= 80
                            ? 'text-rose-400'
                            : pat.distributedThreatScore >= 60
                            ? 'text-amber-400'
                            : 'text-emerald-400'
                        }`}
                      >
                        {pat.distributedThreatScore}
                        <span className="text-[10px] text-slate-500 font-normal">/100</span>
                      </div>
                      <div className="text-[10px] text-slate-400">{pat.confidence}% Conf.</div>
                    </div>
                  </div>

                  {/* Entity Counts Strip (zero-pill discipline) */}
                  <div className="flex items-center gap-3 text-xs font-mono text-slate-400 border-t border-slate-800/60 pt-2">
                    <span className="text-slate-200 font-bold">{pat.relatedIps.length} IPs</span>
                    <span>·</span>
                    <span className="text-slate-200 font-bold">{pat.relatedAccounts.length} Accounts</span>
                    <span>·</span>
                    <span className="text-cyan-400">{pat.similarityPct}% Similarity</span>
                  </div>

                  <p className="text-[11px] text-slate-400 line-clamp-2">
                    {pat.summaryExplanation}
                  </p>
                </div>
              );
            })
          )}
        </div>

        {/* Right Column (7 cols): Selected Pattern Deep Dive */}
        <div className="lg:col-span-7">
          {selectedPattern ? (
            <div className="p-6 bg-slate-900/80 border border-slate-800 rounded-xl space-y-6 shadow-xl text-xs font-mono">
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`px-2.5 py-0.5 text-[10px] font-bold rounded uppercase tracking-wider border ${
                        !selectedPattern.isLegitimateSpike
                          ? 'bg-rose-950 text-rose-300 border-rose-800'
                          : 'bg-emerald-950 text-emerald-300 border-emerald-800'
                      }`}
                    >
                      {selectedPattern.classification.replace(/_/g, ' ')}
                    </span>
                    <span className="text-slate-500">[{selectedPattern.id}]</span>
                  </div>
                  <h2 className="text-sm font-bold text-slate-100">{selectedPattern.patternName}</h2>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-slate-400">Status:</span>
                  <select
                    disabled={activeRole === 'viewer'}
                    value={selectedPattern.status}
                    onChange={(e) => handleUpdateStatus(selectedPattern.id, e.target.value)}
                    className="bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-slate-200 text-xs focus:outline-none"
                  >
                    <option value="Under Investigation">Under Investigation</option>
                    <option value="Mitigated">Mitigated</option>
                    <option value="Monitoring">Monitoring</option>
                    <option value="Legitimate Spike">Legitimate Spike</option>
                  </select>
                </div>
              </div>

              {/* Key Score Metrics Bar */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-lg">
                  <span className="text-[10px] text-slate-500 uppercase block">Distributed Score</span>
                  <span
                    className={`text-xl font-bold ${
                      selectedPattern.distributedThreatScore >= 80
                        ? 'text-rose-400'
                        : selectedPattern.distributedThreatScore >= 60
                        ? 'text-amber-400'
                        : 'text-emerald-400'
                    }`}
                  >
                    {selectedPattern.distributedThreatScore} / 100
                  </span>
                </div>

                <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-lg">
                  <span className="text-[10px] text-slate-500 uppercase block">Behavior Similarity</span>
                  <span className="text-xl font-bold text-cyan-400">
                    {selectedPattern.similarityPct}%
                  </span>
                </div>

                <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-lg">
                  <span className="text-[10px] text-slate-500 uppercase block">Classification Conf.</span>
                  <span className="text-xl font-bold text-indigo-400">
                    {selectedPattern.confidence}%
                  </span>
                </div>

                <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-lg">
                  <span className="text-[10px] text-slate-500 uppercase block">Related Entities</span>
                  <span className="text-xl font-bold text-slate-200">
                    {selectedPattern.relatedIps.length + selectedPattern.relatedAccounts.length}
                  </span>
                </div>
              </div>

              {/* Explainable Pattern Reasons (Prompt Section 3 & 6) */}
              <div className="space-y-2">
                <h4 className="text-slate-300 font-semibold uppercase tracking-wider text-[11px]">
                  Detected Evidence & Temporal Indicators
                </h4>
                <div className="space-y-1.5">
                  {selectedPattern.reasons.map((r, i) => (
                    <div
                      key={i}
                      className="p-2.5 rounded bg-slate-950/60 border border-slate-800 text-slate-300 flex items-start gap-2"
                    >
                      <AlertTriangle
                        className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${
                          selectedPattern.isLegitimateSpike ? 'text-cyan-400' : 'text-amber-400'
                        }`}
                      />
                      <span>{r}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Related IPs Cluster */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-slate-300 font-semibold uppercase tracking-wider text-[11px]">
                    Correlated IP Subnets ({selectedPattern.relatedIps.length})
                  </h4>
                  <span className="text-slate-500 text-[10px]">Synchronized Timing</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {selectedPattern.relatedIps.map((ip) => (
                    <span
                      key={ip}
                      className="px-2 py-1 rounded bg-slate-950 border border-slate-800 text-slate-300 text-[11px]"
                    >
                      {ip}
                    </span>
                  ))}
                </div>
              </div>

              {/* Related Accounts Cluster */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-slate-300 font-semibold uppercase tracking-wider text-[11px]">
                    Associated User Accounts ({selectedPattern.relatedAccounts.length})
                  </h4>
                  <span className="text-slate-500 text-[10px]">Cross-Session Rotation</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {selectedPattern.relatedAccounts.map((acc) => (
                    <span
                      key={acc}
                      className="px-2 py-1 rounded bg-slate-950 border border-slate-800 text-indigo-300 text-[11px]"
                    >
                      {acc}
                    </span>
                  ))}
                </div>
              </div>

              {/* Common Endpoints */}
              <div className="space-y-2">
                <h4 className="text-slate-300 font-semibold uppercase tracking-wider text-[11px]">
                  Targeted API Endpoints
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {selectedPattern.commonEndpoints.map((ep) => (
                    <span
                      key={ep}
                      className="px-2 py-1 rounded bg-slate-950 border border-slate-800 text-cyan-300 text-[11px]"
                    >
                      {ep}
                    </span>
                  ))}
                </div>
              </div>

              {/* Action Bar */}
              <div className="pt-4 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
                <div className="text-[11px] text-slate-500">
                  First seen: {new Date(selectedPattern.firstSeen).toLocaleTimeString()}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={onNavigateToGraph}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded border border-slate-700 transition-colors"
                  >
                    <Network className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Inspect Cluster in Graph</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center p-12 bg-slate-900/40 border border-slate-800 rounded-xl text-slate-500 font-mono text-xs">
              Select a cluster on the left to inspect correlation evidence.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
