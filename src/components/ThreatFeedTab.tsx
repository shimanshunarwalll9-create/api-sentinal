import React, { useState, useMemo } from 'react';
import {
  Search,
  Filter,
  ShieldAlert,
  ArrowUpRight,
  Activity,
  CheckCircle2,
  Clock,
  ChevronRight,
} from 'lucide-react';
import type { ThreatEvent, ApiRequestTelemetry } from '../types/sentinel';

interface ThreatFeedTabProps {
  threats: ThreatEvent[];
  telemetry: ApiRequestTelemetry[];
  onSelectThreat: (threat: ThreatEvent) => void;
}

export const ThreatFeedTab: React.FC<ThreatFeedTabProps> = ({
  threats,
  telemetry,
  onSelectThreat,
}) => {
  const [viewMode, setViewMode] = useState<'threats' | 'telemetry'>('threats');
  const [searchQuery, setSearchQuery] = useState('');
  const [severityFilter, setSeverityFilter] = useState<'all' | 'critical' | 'high' | 'medium' | 'low'>('all');

  const filteredThreats = useMemo(() => {
    return threats.filter((t) => {
      const matchesSearch =
        t.clientId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.endpoint.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.clientIp.includes(searchQuery) ||
        t.reasons.some((r) => r.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesSeverity =
        severityFilter === 'all' ||
        (severityFilter === 'critical' && t.riskScore >= 80) ||
        (severityFilter === 'high' && t.riskScore >= 60 && t.riskScore < 80) ||
        (severityFilter === 'medium' && t.riskScore >= 30 && t.riskScore < 60) ||
        (severityFilter === 'low' && t.riskScore < 30);

      return matchesSearch && matchesSeverity;
    });
  }, [threats, searchQuery, severityFilter]);

  const filteredTelemetry = useMemo(() => {
    return telemetry.filter((tel) => {
      const matchesSearch =
        tel.clientId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tel.endpoint.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tel.clientIp.includes(searchQuery);

      const score = tel.riskEvaluation.riskScore;
      const matchesSeverity =
        severityFilter === 'all' ||
        (severityFilter === 'critical' && score >= 80) ||
        (severityFilter === 'high' && score >= 60 && score < 80) ||
        (severityFilter === 'medium' && score >= 30 && score < 60) ||
        (severityFilter === 'low' && score < 30);

      return matchesSearch && matchesSeverity;
    });
  }, [telemetry, searchQuery, severityFilter]);

  const getActionStyle = (action: string) => {
    switch (action) {
      case 'TEMPORARY_BLOCK':
        return 'text-rose-400 bg-rose-950/60 border-rose-800';
      case 'RATE_LIMIT':
        return 'text-amber-400 bg-amber-950/60 border-amber-800';
      case 'MONITOR':
        return 'text-cyan-400 bg-cyan-950/60 border-cyan-800';
      default:
        return 'text-emerald-400 bg-emerald-950/60 border-emerald-800';
    }
  };

  const getStatusColor = (code: number) => {
    if (code >= 200 && code < 300) return 'text-emerald-400';
    if (code === 401 || code === 403) return 'text-rose-400';
    if (code === 429) return 'text-amber-400';
    if (code >= 400 && code < 500) return 'text-yellow-400';
    return 'text-purple-400';
  };

  return (
    <div className="space-y-4">
      {/* Controls Bar */}
      <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* View Mode Switcher (interactive button group) */}
        <div className="flex items-center gap-1 p-1 bg-slate-950 border border-slate-800 rounded-lg shrink-0">
          <button
            onClick={() => setViewMode('threats')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              viewMode === 'threats'
                ? 'bg-slate-800 text-cyan-300 font-semibold shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Threat Incidents ({threats.length})
          </button>
          <button
            onClick={() => setViewMode('telemetry')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              viewMode === 'telemetry'
                ? 'bg-slate-800 text-cyan-300 font-semibold shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            All Telemetry Logs ({telemetry.length})
          </button>
        </div>

        {/* Search & Severity Filters */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Search Input */}
          <div className="relative flex-1 md:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Filter client, path, reason..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-md pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono"
            />
          </div>

          {/* Severity Segmented Filter */}
          <div className="flex items-center gap-1 p-0.5 bg-slate-950 border border-slate-800 rounded-md text-xs font-mono">
            {(['all', 'critical', 'high', 'medium', 'low'] as const).map((sev) => (
              <button
                key={sev}
                onClick={() => setSeverityFilter(sev)}
                className={`px-2.5 py-1 rounded transition-colors uppercase ${
                  severityFilter === sev
                    ? 'bg-slate-800 text-slate-100 font-semibold'
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                {sev}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Table Container */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-slate-950 border-b border-slate-800 text-slate-400 uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Client</th>
                <th className="py-3 px-4">Method & Endpoint</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Risk Score</th>
                <th className="py-3 px-4">Action</th>
                <th className="py-3 px-4">Top Indicator</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {viewMode === 'threats' ? (
                filteredThreats.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-500 text-xs">
                      No threat incidents match current criteria.
                    </td>
                  </tr>
                ) : (
                  filteredThreats.map((threat) => (
                    <tr
                      key={threat.id}
                      onClick={() => onSelectThreat(threat)}
                      className="hover:bg-slate-800/40 cursor-pointer transition-colors group"
                    >
                      <td className="py-3 px-4 text-slate-400 whitespace-nowrap">
                        {new Date(threat.timestamp).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                      </td>
                      <td className="py-3 px-4 text-slate-200 font-bold whitespace-nowrap">
                        {threat.clientId}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="text-cyan-400 font-bold mr-1.5">{threat.method}</span>
                        <span className="text-slate-300 truncate max-w-xs inline-block align-bottom">
                          {threat.endpoint}
                        </span>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className={`font-bold ${getStatusColor(threat.statusCode)}`}>
                          {threat.statusCode}
                        </span>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span
                            className={`font-bold text-sm ${
                              threat.riskScore >= 80
                                ? 'text-rose-400'
                                : threat.riskScore >= 60
                                ? 'text-amber-400'
                                : 'text-cyan-400'
                            }`}
                          >
                            {threat.riskScore}
                          </span>
                          <div className="w-12 bg-slate-800 h-1.5 rounded-full overflow-hidden hidden sm:block">
                            <div
                              className={`h-full ${
                                threat.riskScore >= 80
                                ? 'bg-rose-500'
                                : threat.riskScore >= 60
                                ? 'bg-amber-500'
                                : 'bg-cyan-500'
                              }`}
                              style={{ width: `${threat.riskScore}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 text-[11px] font-semibold rounded border ${getActionStyle(
                            threat.action
                          )}`}
                        >
                          {threat.action}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-400 text-[11px] max-w-xs truncate">
                        {threat.reasons[0] || 'Behavior deviation'}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <span className="text-cyan-400 hover:text-cyan-300 text-[11px] flex items-center justify-end gap-1 group-hover:underline">
                          Investigate
                          <ChevronRight className="w-3.5 h-3.5" />
                        </span>
                      </td>
                    </tr>
                  ))
                )
              ) : filteredTelemetry.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500 text-xs">
                    No telemetry logs match current criteria.
                  </td>
                </tr>
              ) : (
                filteredTelemetry.map((tel) => {
                  const evalRisk = tel.riskEvaluation;
                  const threatObj: ThreatEvent = {
                    id: 'from-tel-' + tel.id,
                    timestamp: tel.timestamp,
                    clientId: tel.clientId,
                    clientIp: tel.clientIp,
                    endpoint: tel.endpoint,
                    method: tel.method,
                    riskScore: evalRisk.riskScore,
                    riskLevel: evalRisk.riskLevel,
                    action: evalRisk.action,
                    reasons: evalRisk.reasons,
                    breakdown: evalRisk.breakdown,
                    statusCode: tel.statusCode,
                    status: tel.blocked ? 'mitigated' : 'active',
                  };

                  return (
                    <tr
                      key={tel.id}
                      onClick={() => onSelectThreat(threatObj)}
                      className="hover:bg-slate-800/40 cursor-pointer transition-colors group"
                    >
                      <td className="py-2.5 px-4 text-slate-400 whitespace-nowrap">
                        {new Date(tel.timestamp).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                      </td>
                      <td className="py-2.5 px-4 text-slate-300 whitespace-nowrap">
                        {tel.clientId}
                      </td>
                      <td className="py-2.5 px-4 whitespace-nowrap">
                        <span className="text-cyan-400 font-bold mr-1.5">{tel.method}</span>
                        <span className="text-slate-300 truncate max-w-xs inline-block align-bottom">
                          {tel.endpoint}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 whitespace-nowrap">
                        <span className={`font-bold ${getStatusColor(tel.statusCode)}`}>
                          {tel.statusCode}
                        </span>
                        <span className="text-slate-500 text-[10px] ml-1.5">
                          {tel.latencyMs}ms
                        </span>
                      </td>
                      <td className="py-2.5 px-4 whitespace-nowrap">
                        <span
                          className={`font-bold ${
                            evalRisk.riskScore >= 80
                              ? 'text-rose-400'
                              : evalRisk.riskScore >= 60
                              ? 'text-amber-400'
                              : evalRisk.riskScore >= 30
                              ? 'text-cyan-400'
                              : 'text-slate-400'
                          }`}
                        >
                          {evalRisk.riskScore}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 text-[10px] font-semibold rounded border ${getActionStyle(
                            evalRisk.action
                          )}`}
                        >
                          {evalRisk.action}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-slate-400 text-[11px] max-w-xs truncate">
                        {evalRisk.reasons[0] || 'Nominal'}
                      </td>
                      <td className="py-2.5 px-4 text-right whitespace-nowrap">
                        <span className="text-slate-400 group-hover:text-cyan-300 text-[11px] flex items-center justify-end gap-1">
                          Details
                          <ChevronRight className="w-3.5 h-3.5" />
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
    </div>
  );
};
