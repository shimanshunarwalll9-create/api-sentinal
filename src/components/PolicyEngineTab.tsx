import React, { useState } from 'react';
import {
  Sliders,
  Shield,
  Save,
  CheckCircle,
  AlertCircle,
  Clock,
  ToggleLeft,
  ToggleRight,
  Info,
} from 'lucide-react';
import type { SecurityPolicy, UserRole, SecurityAction } from '../types/sentinel';

interface PolicyEngineTabProps {
  policies: SecurityPolicy[];
  activeRole: UserRole;
  onRefreshAll: () => void;
}

export const PolicyEngineTab: React.FC<PolicyEngineTabProps> = ({
  policies,
  activeRole,
  onRefreshAll,
}) => {
  const [editedPolicies, setEditedPolicies] = useState<SecurityPolicy[]>(policies);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Sync state if external policies change
  React.useEffect(() => {
    setEditedPolicies(policies);
  }, [policies]);

  const handleFieldChange = (
    id: string,
    field: keyof SecurityPolicy,
    value: any
  ) => {
    setEditedPolicies((prev) =>
      prev.map((p) => (p.id === id ? { ...p, [field]: value } : p))
    );
  };

  const handleSavePolicy = async (policy: SecurityPolicy) => {
    if (activeRole !== 'admin') {
      setErrorMsg('Policy modifications require Admin privileges.');
      return;
    }

    setSavingId(policy.id);
    setErrorMsg(null);
    setSaveSuccess(null);

    try {
      const res = await fetch(`/api/policies/${policy.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Actor-Name': `SOC ${activeRole.toUpperCase()} (Session)`,
        },
        body: JSON.stringify(policy),
      });

      if (res.ok) {
        setSaveSuccess(`Policy "${policy.name}" updated successfully.`);
        onRefreshAll();
        setTimeout(() => setSaveSuccess(null), 4000);
      } else {
        const data = await res.json();
        setErrorMsg(data.error || 'Failed to update policy.');
      }
    } catch (e: any) {
      setErrorMsg(e.message || 'Error updating policy');
    } finally {
      setSavingId(null);
    }
  };

  const actionsList: SecurityAction[] = [
    'ALLOW',
    'MONITOR',
    'RATE_LIMIT',
    'TEMPORARY_BLOCK',
  ];

  return (
    <div className="space-y-6">
      {/* Policy Engine Header Banner */}
      <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-xl space-y-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-cyan-400" />
            <h2 className="text-sm font-semibold text-slate-100">
              Adaptive Policy Enforcement Matrix
            </h2>
          </div>

          <div className="text-xs font-mono text-slate-400">
            Current Operator Role:{' '}
            <span
              className={`font-bold ${
                activeRole === 'admin' ? 'text-cyan-400' : 'text-amber-400'
              }`}
            >
              {activeRole.toUpperCase()}
            </span>
          </div>
        </div>
        <p className="text-xs text-slate-400">
          Configure risk thresholds, defense actions, throttle durations, and quarantine windows. All modifications trigger cryptographic audit log entries.
        </p>
      </div>

      {saveSuccess && (
        <div className="p-3 bg-emerald-950/70 border border-emerald-700/60 rounded-lg text-emerald-200 text-xs flex items-center gap-2 font-mono">
          <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{saveSuccess}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-3 bg-rose-950/70 border border-rose-700/60 rounded-lg text-rose-200 text-xs flex items-center gap-2 font-mono">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Policies List */}
      <div className="space-y-4">
        {editedPolicies.map((policy) => {
          const isSaving = savingId === policy.id;
          const isAdmin = activeRole === 'admin';

          return (
            <div
              key={policy.id}
              className={`p-5 rounded-xl border transition-all ${
                policy.enabled
                  ? 'bg-slate-900/70 border-slate-800'
                  : 'bg-slate-950/40 border-slate-900 opacity-60'
              }`}
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-3">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-3 h-3 rounded-full ${
                      policy.level === 'critical'
                        ? 'bg-rose-500'
                        : policy.level === 'high'
                        ? 'bg-amber-500'
                        : policy.level === 'medium'
                        ? 'bg-cyan-500'
                        : 'bg-emerald-500'
                    }`}
                  />
                  <div>
                    <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                      {policy.name}
                      <span className="text-[11px] font-mono text-slate-500 uppercase">
                        [{policy.level}]
                      </span>
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">{policy.description}</p>
                  </div>
                </div>

                {/* Enable toggle & Save button */}
                <div className="flex items-center gap-3">
                  <button
                    disabled={!isAdmin}
                    onClick={() =>
                      handleFieldChange(policy.id, 'enabled', !policy.enabled)
                    }
                    className="flex items-center gap-1.5 text-xs font-mono text-slate-300 disabled:opacity-50"
                  >
                    {policy.enabled ? (
                      <ToggleRight className="w-6 h-6 text-emerald-400" />
                    ) : (
                      <ToggleLeft className="w-6 h-6 text-slate-600" />
                    )}
                    <span>{policy.enabled ? 'Enabled' : 'Disabled'}</span>
                  </button>

                  {isAdmin && (
                    <button
                      onClick={() => handleSavePolicy(policy)}
                      disabled={isSaving}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-semibold text-xs rounded transition-colors disabled:opacity-50"
                    >
                      <Save className="w-3.5 h-3.5" />
                      {isSaving ? 'Saving...' : 'Apply'}
                    </button>
                  )}
                </div>
              </div>

              {/* Policy Inputs Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-4 text-xs font-mono">
                {/* Min Risk Score */}
                <div className="space-y-1">
                  <label className="text-slate-400 block">Min Risk Score</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    disabled={!isAdmin}
                    value={policy.minScore}
                    onChange={(e) =>
                      handleFieldChange(
                        policy.id,
                        'minScore',
                        parseInt(e.target.value, 10) || 0
                      )
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-slate-200 disabled:opacity-60"
                  />
                </div>

                {/* Max Risk Score */}
                <div className="space-y-1">
                  <label className="text-slate-400 block">Max Risk Score</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    disabled={!isAdmin}
                    value={policy.maxScore}
                    onChange={(e) =>
                      handleFieldChange(
                        policy.id,
                        'maxScore',
                        parseInt(e.target.value, 10) || 0
                      )
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-slate-200 disabled:opacity-60"
                  />
                </div>

                {/* Action Dropdown */}
                <div className="space-y-1">
                  <label className="text-slate-400 block">Enforcement Action</label>
                  <select
                    disabled={!isAdmin}
                    value={policy.action}
                    onChange={(e) =>
                      handleFieldChange(
                        policy.id,
                        'action',
                        e.target.value as SecurityAction
                      )
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-slate-200 disabled:opacity-60"
                  >
                    {actionsList.map((a) => (
                      <option key={a} value={a}>
                        {a}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Block / Throttle Duration */}
                <div className="space-y-1">
                  <label className="text-slate-400 block">
                    Sanction Window (Seconds)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="3600"
                    step="10"
                    disabled={!isAdmin || policy.action === 'ALLOW' || policy.action === 'MONITOR'}
                    value={policy.blockDurationSec}
                    onChange={(e) =>
                      handleFieldChange(
                        policy.id,
                        'blockDurationSec',
                        parseInt(e.target.value, 10) || 0
                      )
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-slate-200 disabled:opacity-40"
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {activeRole !== 'admin' && (
        <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg flex items-center gap-2 text-xs text-slate-400 font-mono">
          <Info className="w-4 h-4 text-cyan-400 shrink-0" />
          <span>
            You are currently operating in <strong>{activeRole}</strong> mode. Switch to <strong>Admin</strong> in the top header to edit policy values.
          </span>
        </div>
      )}
    </div>
  );
};
