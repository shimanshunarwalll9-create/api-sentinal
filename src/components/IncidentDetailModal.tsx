import React, { useState } from 'react';
import {
  X,
  AlertTriangle,
  ShieldAlert,
  Bot,
  Sparkles,
  Lock,
  Unlock,
  Clock,
  ArrowRight,
  CheckCircle2,
} from 'lucide-react';
import type { ThreatEvent, UserRole } from '../types/sentinel';

interface IncidentDetailModalProps {
  threat: ThreatEvent | null;
  onClose: () => void;
  activeRole: UserRole;
  onUnblockClient: (clientId: string) => Promise<void>;
  onManualBlockClient: (clientId: string, durationSec: number, reason: string) => Promise<void>;
}

export const IncidentDetailModal: React.FC<IncidentDetailModalProps> = ({
  threat,
  onClose,
  activeRole,
  onUnblockClient,
  onManualBlockClient,
}) => {
  const [aiReport, setAiReport] = useState<string | null>(threat?.aiAnalysis || null);
  const [aiLoading, setAiLoading] = useState(false);
  const [remediation, setRemediation] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  if (!threat) return null;

  const handleFetchAiExplanation = async () => {
    setAiLoading(true);
    try {
      const res = await fetch('/api/security/explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          riskScore: threat.riskScore,
          reasons: threat.reasons,
          clientInfo: {
            clientId: threat.clientId,
            endpoint: threat.endpoint,
            method: threat.method,
          },
          breakdown: threat.breakdown,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setAiReport(data.explanation);
        setRemediation(data.recommendation);
      }
    } catch (e) {
      console.error('Error fetching AI explanation:', e);
    } finally {
      setAiLoading(false);
    }
  };

  const handlePardon = async () => {
    await onUnblockClient(threat.clientId);
    setActionSuccess(`Client ${threat.clientId} has been pardoned and unblocked.`);
  };

  const handleForceBlock = async () => {
    await onManualBlockClient(threat.clientId, 300, `Quarantined from incident ${threat.id}`);
    setActionSuccess(`Client ${threat.clientId} manually quarantined for 5 minutes.`);
  };

  const getActionBadgeColor = (action: string) => {
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-xl shadow-2xl overflow-hidden text-slate-100 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded bg-rose-950/60 border border-rose-700/50 text-rose-400">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-100 flex items-center gap-2">
                Incident Investigation
                <span className="text-xs text-slate-400 font-mono font-normal">
                  [{threat.id}]
                </span>
              </h2>
              {/* Clean unboxed metadata (zero-pill discipline) */}
              <div className="flex items-center gap-2 text-xs text-slate-400 font-mono mt-0.5">
                <span>{new Date(threat.timestamp).toLocaleString()}</span>
                <span>·</span>
                <span>Client: {threat.clientId}</span>
                <span>·</span>
                <span>Status: {threat.status}</span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-sm">
          {actionSuccess && (
            <div className="p-3 bg-emerald-950/70 border border-emerald-700/60 rounded-lg text-emerald-200 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{actionSuccess}</span>
            </div>
          )}

          {/* Top Score & Action Banner */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-lg bg-slate-950/80 border border-slate-800 flex flex-col justify-between">
              <span className="text-xs text-slate-400 uppercase tracking-wider font-mono">
                Calculated Risk Score
              </span>
              <div className="flex items-baseline gap-2 mt-2">
                <span
                  className={`text-3xl font-bold font-mono ${
                    threat.riskScore >= 80
                      ? 'text-rose-400'
                      : threat.riskScore >= 60
                      ? 'text-amber-400'
                      : 'text-cyan-400'
                  }`}
                >
                  {threat.riskScore}
                </span>
                <span className="text-xs text-slate-500 font-mono">/ 100</span>
              </div>
              <div className="w-full bg-slate-800 h-1.5 rounded-full mt-3 overflow-hidden">
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

            <div className="p-4 rounded-lg bg-slate-950/80 border border-slate-800 flex flex-col justify-between">
              <span className="text-xs text-slate-400 uppercase tracking-wider font-mono">
                Enforced Policy Action
              </span>
              <div className="mt-2">
                <span
                  className={`inline-block px-2.5 py-1 text-xs font-mono font-semibold rounded border ${getActionBadgeColor(
                    threat.action
                  )}`}
                >
                  {threat.action}
                </span>
              </div>
              <span className="text-[11px] text-slate-500 mt-2">
                {threat.action === 'TEMPORARY_BLOCK'
                  ? 'HTTP 403 Forbidden with Retry-After header'
                  : threat.action === 'RATE_LIMIT'
                  ? 'HTTP 429 Too Many Requests throttle'
                  : 'Telemetry captured for SOC review'}
              </span>
            </div>

            <div className="p-4 rounded-lg bg-slate-950/80 border border-slate-800 flex flex-col justify-between">
              <span className="text-xs text-slate-400 uppercase tracking-wider font-mono">
                Request Target
              </span>
              <div className="mt-2 font-mono text-xs text-slate-200 truncate">
                <span className="text-cyan-400 font-bold mr-1">{threat.method}</span>
                {threat.endpoint}
              </div>
              <div className="text-[11px] text-slate-400 font-mono mt-2">
                HTTP Code: <span className="text-slate-200">{threat.statusCode}</span>
              </div>
            </div>
          </div>

          {/* Explainable Equation Breakdown Section */}
          <div className="p-4 rounded-lg bg-slate-950/60 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider font-mono">
                Deterministic Signal Breakdown
              </h3>
              <span className="text-xs text-slate-400 font-mono">Explainable Equation</span>
            </div>

            <div className="space-y-2.5 text-xs font-mono">
              <div className="flex items-center justify-between p-2 rounded bg-slate-900 border border-slate-800/80">
                <span className="text-slate-300">Request Rate Velocity Anomaly</span>
                <span className="text-cyan-400 font-bold">
                  +{threat.breakdown.requestRateScore} pts
                </span>
              </div>

              <div className="flex items-center justify-between p-2 rounded bg-slate-900 border border-slate-800/80">
                <span className="text-slate-300">Failed Authentication & Login Spike</span>
                <span className="text-amber-400 font-bold">
                  +{threat.breakdown.failedAuthScore} pts
                </span>
              </div>

              <div className="flex items-center justify-between p-2 rounded bg-slate-900 border border-slate-800/80">
                <span className="text-slate-300">Unusual Endpoint & Path Anomaly</span>
                <span className="text-indigo-400 font-bold">
                  +{threat.breakdown.endpointAnomalyScore} pts
                </span>
              </div>

              <div className="flex items-center justify-between p-2 rounded bg-slate-900 border border-slate-800/80">
                <span className="text-slate-300">Sudden Baseline Behavior Deviation</span>
                <span className="text-rose-400 font-bold">
                  +{threat.breakdown.behaviorChangeScore} pts
                </span>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-sm">
                <span className="text-slate-200 font-semibold">Total Cumulative Risk Score</span>
                <span className="text-slate-100 font-bold">{threat.riskScore} / 100</span>
              </div>
            </div>
          </div>

          {/* Detected Reasons Evidence */}
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider font-mono">
              Detected Threat Evidence
            </h3>
            <div className="space-y-1.5">
              {threat.reasons.map((reason, i) => (
                <div
                  key={i}
                  className="flex items-start gap-2.5 p-2.5 rounded bg-slate-950/40 border border-slate-800 text-xs text-slate-300 font-mono"
                >
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                  <span>{reason}</span>
                </div>
              ))}
            </div>
          </div>

          {/* AI Security Analyst Section */}
          <div className="p-4 rounded-lg bg-indigo-950/30 border border-indigo-800/50 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1 rounded bg-indigo-900/60 text-indigo-400">
                  <Bot className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-semibold text-indigo-200">
                    AI Security Analyst Briefing
                  </h3>
                  <p className="text-[11px] text-indigo-400/80">
                    Assisted incident context & remediation recommendation (Gemini 3.8 Flash)
                  </p>
                </div>
              </div>

              {!aiReport && (
                <button
                  onClick={handleFetchAiExplanation}
                  disabled={aiLoading}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium rounded-md transition-colors disabled:opacity-50"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  {aiLoading ? 'Analyzing Evidence...' : 'Generate AI Assessment'}
                </button>
              )}
            </div>

            {aiLoading && (
              <div className="p-4 flex items-center gap-3 text-xs text-indigo-300 font-mono animate-pulse">
                <div className="w-4 h-4 rounded-full border-2 border-indigo-400 border-t-transparent animate-spin" />
                <span>Evaluating structured risk signals and baseline telemetry...</span>
              </div>
            )}

            {aiReport && (
              <div className="space-y-3 text-xs leading-relaxed text-indigo-100 bg-slate-950/60 p-3.5 rounded border border-indigo-900/40">
                <div>
                  <span className="text-[11px] font-mono text-indigo-400 uppercase tracking-wider block mb-1">
                    Assessment:
                  </span>
                  <p>{aiReport}</p>
                </div>

                {remediation && (
                  <div className="pt-2 border-t border-indigo-900/50">
                    <span className="text-[11px] font-mono text-cyan-400 uppercase tracking-wider block mb-1">
                      Tactical Recommendation:
                    </span>
                    <p className="text-cyan-200/90">{remediation}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer with Operator Controls */}
        <div className="px-6 py-4 bg-slate-950 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-slate-400 font-mono">
            Client IP: <span className="text-slate-200">{threat.clientIp}</span>
          </div>

          <div className="flex items-center gap-2">
            {activeRole === 'admin' ? (
              <>
                <button
                  onClick={handlePardon}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-emerald-400 text-xs font-medium rounded-md border border-slate-700 transition-colors"
                >
                  <Unlock className="w-3.5 h-3.5" />
                  Pardon / Unblock
                </button>
                <button
                  onClick={handleForceBlock}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-900/60 hover:bg-rose-800/80 text-rose-200 text-xs font-medium rounded-md border border-rose-700/60 transition-colors"
                >
                  <Lock className="w-3.5 h-3.5" />
                  Quarantine (5 min)
                </button>
              </>
            ) : (
              <span className="text-xs text-slate-500 italic">
                Role '{activeRole}' has read-only operator access.
              </span>
            )}
            <button
              onClick={onClose}
              className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-md transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
