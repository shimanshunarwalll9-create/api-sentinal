import React from 'react';
import {
  Activity,
  ShieldAlert,
  ShieldCheck,
  Ban,
  Gauge,
  ArrowUpRight,
  TrendingUp,
  AlertTriangle,
  Play,
  Globe,
} from 'lucide-react';
import type {
  DashboardOverview,
  TrafficDataPoint,
  ThreatEvent,
  BlockedClient,
} from '../types/sentinel';
import { TrafficChart } from './TrafficChart';

interface OverviewTabProps {
  overview: DashboardOverview | null;
  trafficPoints: TrafficDataPoint[];
  threats: ThreatEvent[];
  blockedClients: BlockedClient[];
  onSelectThreat: (threat: ThreatEvent) => void;
  onNavigateToSimulator: () => void;
  onNavigateToDistributed?: () => void;
  distributedCount?: number;
}

export const OverviewTab: React.FC<OverviewTabProps> = ({
  overview,
  trafficPoints,
  threats,
  blockedClients,
  onSelectThreat,
  onNavigateToSimulator,
  onNavigateToDistributed,
  distributedCount,
}) => {
  const avgRisk = overview?.averageRiskScore ?? 0;
  const totalReq = overview?.totalRequests ?? 0;
  const rpm = overview?.requestsPerMinute ?? 0;
  const threatsCount = overview?.threatsDetected ?? threats.length;
  const blockedCount = overview?.blockedClientsCount ?? blockedClients.length;
  const coordPatternsCount = distributedCount ?? overview?.potentialCoordinatedPatterns ?? 0;

  return (
    <div className="space-y-6">
      {/* Top Banner Alert / Hackathon Guide */}
      <div className="p-4 bg-slate-900/90 border border-slate-800 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
            <h2 className="text-sm font-semibold text-slate-100">
              API Sentinel Defense Engine: Operational
            </h2>
          </div>
          <p className="text-xs text-slate-400">
            Real-time proxy observing protected routes (`/api/protected/*`). Automated rate limiting and quarantine active.
          </p>
        </div>

        <button
          onClick={onNavigateToSimulator}
          className="flex items-center gap-2 px-3.5 py-2 bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-semibold text-xs rounded-lg transition-colors shadow-sm shrink-0 self-start md:self-auto"
        >
          <Play className="w-3.5 h-3.5 fill-current" />
          Launch Traffic Simulator
        </button>
      </div>

      {/* Primary KPI Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
        {/* Metric 1: Total Requests */}
        <div className="p-4 bg-slate-900/70 border border-slate-800 rounded-lg">
          <div className="flex items-center justify-between text-slate-400 text-xs font-mono">
            <span>Total Inspected</span>
            <Activity className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-slate-100">{totalReq}</div>
          <div className="mt-1 text-[11px] text-slate-400 font-mono">Real-time HTTP requests</div>
        </div>

        {/* Metric 2: Requests per Minute */}
        <div className="p-4 bg-slate-900/70 border border-slate-800 rounded-lg">
          <div className="flex items-center justify-between text-slate-400 text-xs font-mono">
            <span>Velocity</span>
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-slate-100">{rpm} <span className="text-xs font-normal text-slate-400">RPM</span></div>
          <div className="mt-1 text-[11px] text-slate-400 font-mono">Sliding 60s window</div>
        </div>

        {/* Metric 3: Threats Detected */}
        <div className="p-4 bg-slate-900/70 border border-slate-800 rounded-lg">
          <div className="flex items-center justify-between text-slate-400 text-xs font-mono">
            <span>Threats Flagged</span>
            <ShieldAlert className="w-4 h-4 text-amber-400" />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-amber-400">{threatsCount}</div>
          <div className="mt-1 text-[11px] text-slate-400 font-mono">Risk score ≥ 30</div>
        </div>

        {/* Metric 4: Coordinated Patterns (New Innovation) */}
        <div
          onClick={onNavigateToDistributed}
          className={`p-4 bg-slate-900/70 border rounded-lg transition-all ${
            onNavigateToDistributed
              ? 'border-indigo-500/40 hover:border-indigo-400 hover:bg-indigo-950/20 cursor-pointer group'
              : 'border-slate-800'
          }`}
        >
          <div className="flex items-center justify-between text-slate-400 text-xs font-mono">
            <span className="group-hover:text-indigo-300 transition-colors">Coordinated</span>
            <Globe className="w-4 h-4 text-indigo-400 group-hover:scale-110 transition-transform" />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-indigo-300">
            {coordPatternsCount}
          </div>
          <div className="mt-1 text-[11px] text-slate-400 font-mono flex items-center justify-between">
            <span>Distributed clusters</span>
            {onNavigateToDistributed && <ArrowUpRight className="w-3 h-3 text-indigo-400" />}
          </div>
        </div>

        {/* Metric 5: Blocked Clients */}
        <div className="p-4 bg-slate-900/70 border border-slate-800 rounded-lg">
          <div className="flex items-center justify-between text-slate-400 text-xs font-mono">
            <span>Active Blocks</span>
            <Ban className="w-4 h-4 text-rose-400" />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-rose-400">{blockedCount}</div>
          <div className="mt-1 text-[11px] text-slate-400 font-mono">Quarantined by policy</div>
        </div>

        {/* Metric 6: Average Risk Score */}
        <div className="p-4 bg-slate-900/70 border border-slate-800 rounded-lg">
          <div className="flex items-center justify-between text-slate-400 text-xs font-mono">
            <span>Avg Risk Index</span>
            <Gauge className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span
              className={`text-2xl font-bold font-mono ${
                avgRisk >= 60
                  ? 'text-rose-400'
                  : avgRisk >= 30
                  ? 'text-amber-400'
                  : 'text-emerald-400'
              }`}
            >
              {avgRisk}
            </span>
            <span className="text-xs text-slate-500 font-mono">/ 100</span>
          </div>
          <div className="mt-1 text-[11px] text-slate-400 font-mono">
            {avgRisk < 30 ? 'Nominal Baseline' : avgRisk < 60 ? 'Moderate Noise' : 'Elevated Threat'}
          </div>
        </div>
      </div>

      {/* Traffic Time-Series Chart */}
      <div className="p-5 bg-slate-900/70 border border-slate-800 rounded-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-200">
              Live API Traffic & Enforcement Velocity
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Continuously aggregated request volume categorized by security classification
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-400 font-mono">
            <span>Auto-refreshing 10s intervals</span>
          </div>
        </div>

        <TrafficChart data={trafficPoints} />
      </div>

      {/* Two Column Layout: Recent Threats Feed & Active Sanctions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left (2 cols): Latest Incidents */}
        <div className="lg:col-span-2 p-5 bg-slate-900/70 border border-slate-800 rounded-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-200">Recent Security Incidents</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Threat events flagged by behavior rules and risk scoring
              </p>
            </div>
            <span className="text-xs font-mono text-slate-400">
              Showing last {Math.min(threats.length, 5)} events
            </span>
          </div>

          {threats.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-xs font-mono">
              <ShieldCheck className="w-8 h-8 text-emerald-500/50 mx-auto mb-2" />
              No threats detected yet. Send traffic via the Simulator or Store to test detection!
            </div>
          ) : (
            <div className="space-y-2.5">
              {threats.slice(0, 5).map((threat) => (
                <div
                  key={threat.id}
                  onClick={() => onSelectThreat(threat)}
                  className="p-3.5 bg-slate-950/60 hover:bg-slate-800/60 border border-slate-800/80 hover:border-slate-700 rounded-lg cursor-pointer transition-all flex items-center justify-between gap-4 group"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-xs font-mono font-bold ${
                          threat.riskScore >= 80
                            ? 'text-rose-400'
                            : threat.riskScore >= 60
                            ? 'text-amber-400'
                            : 'text-cyan-400'
                        }`}
                      >
                        Score: {threat.riskScore}/100
                      </span>
                      <span className="text-slate-600">·</span>
                      <span className="text-xs font-mono text-slate-300 truncate">
                        {threat.method} {threat.endpoint}
                      </span>
                      <span className="text-slate-600">·</span>
                      <span className="text-xs font-mono text-slate-400">{threat.clientId}</span>
                    </div>

                    <p className="text-xs text-slate-400 truncate">
                      {threat.reasons[0] || 'Behavior anomaly detected'}
                    </p>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span
                      className={`px-2 py-0.5 text-[11px] font-mono font-semibold rounded border ${
                        threat.action === 'TEMPORARY_BLOCK'
                          ? 'text-rose-400 bg-rose-950/60 border-rose-800'
                          : threat.action === 'RATE_LIMIT'
                          ? 'text-amber-400 bg-amber-950/60 border-amber-800'
                          : 'text-cyan-400 bg-cyan-950/60 border-cyan-800'
                      }`}
                    >
                      {threat.action}
                    </span>
                    <ArrowUpRight className="w-4 h-4 text-slate-500 group-hover:text-slate-200 transition-colors" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right (1 col): Active Quarantines & Defense Matrix */}
        <div className="p-5 bg-slate-900/70 border border-slate-800 rounded-xl space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="border-b border-slate-800/80 pb-3">
              <h3 className="text-sm font-semibold text-slate-200">Quarantine & Throttle State</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Current active automated sanctions
              </p>
            </div>

            {blockedClients.length === 0 ? (
              <div className="py-8 text-center text-slate-500 text-xs font-mono">
                <CheckCircleIcon className="w-6 h-6 text-emerald-500/60 mx-auto mb-2" />
                No clients currently in quarantine.
              </div>
            ) : (
              <div className="space-y-2">
                {blockedClients.map((client) => {
                  const remainingSec = Math.max(
                    0,
                    Math.ceil((new Date(client.expiresAt).getTime() - Date.now()) / 1000)
                  );
                  return (
                    <div
                      key={client.clientId}
                      className="p-3 bg-rose-950/30 border border-rose-900/50 rounded-lg text-xs space-y-1 font-mono"
                    >
                      <div className="flex items-center justify-between text-rose-300 font-bold">
                        <span>{client.clientId}</span>
                        <span>{remainingSec}s left</span>
                      </div>
                      <p className="text-slate-400 text-[11px] truncate">{client.reason}</p>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Quick Enforcement Policy Summary */}
            <div className="pt-3 border-t border-slate-800/80 space-y-2 text-xs font-mono">
              <span className="text-[11px] text-slate-400 uppercase tracking-wider block">
                Policy Routing Rules:
              </span>
              <div className="flex items-center justify-between text-slate-300">
                <span>0 – 29</span>
                <span className="text-emerald-400 font-semibold">ALLOW</span>
              </div>
              <div className="flex items-center justify-between text-slate-300">
                <span>30 – 59</span>
                <span className="text-cyan-400 font-semibold">MONITOR</span>
              </div>
              <div className="flex items-center justify-between text-slate-300">
                <span>60 – 79</span>
                <span className="text-amber-400 font-semibold">RATE LIMIT (429)</span>
              </div>
              <div className="flex items-center justify-between text-slate-300">
                <span>80 – 100</span>
                <span className="text-rose-400 font-semibold">TEMPORARY BLOCK (403)</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

function CheckCircleIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}
