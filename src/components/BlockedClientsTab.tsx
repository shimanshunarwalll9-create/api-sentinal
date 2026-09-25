import React, { useState, useEffect } from 'react';
import {
  Ban,
  Unlock,
  PlusCircle,
  Clock,
  AlertTriangle,
  CheckCircle,
  Shield,
  Search,
} from 'lucide-react';
import type { BlockedClient, UserRole } from '../types/sentinel';

interface BlockedClientsTabProps {
  blockedClients: BlockedClient[];
  activeRole: UserRole;
  onRefreshAll: () => void;
  onUnblockClient: (clientId: string) => Promise<void>;
  onManualBlockClient: (clientId: string, durationSec: number, reason: string) => Promise<void>;
}

export const BlockedClientsTab: React.FC<BlockedClientsTabProps> = ({
  blockedClients,
  activeRole,
  onRefreshAll,
  onUnblockClient,
  onManualBlockClient,
}) => {
  const [search, setSearch] = useState('');
  const [now, setNow] = useState(Date.now());
  const [manualClientId, setManualClientId] = useState('');
  const [manualDuration, setManualDuration] = useState(120);
  const [manualReason, setManualReason] = useState('Manual security containment by administrator');
  const [submitting, setSubmitting] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  // Update countdown clock every second
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleManualBlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualClientId.trim() || activeRole !== 'admin') return;

    setSubmitting(true);
    try {
      await onManualBlockClient(manualClientId.trim(), manualDuration, manualReason);
      setStatusMsg(`Client ${manualClientId} has been placed under active quarantine.`);
      setManualClientId('');
      setTimeout(() => setStatusMsg(null), 4000);
    } catch {
      setStatusMsg('Failed to apply quarantine');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePardon = async (clientId: string) => {
    try {
      await onUnblockClient(clientId);
      setStatusMsg(`Client ${clientId} pardoned and restored to normal traffic.`);
      setTimeout(() => setStatusMsg(null), 4000);
    } catch {
      setStatusMsg('Failed to pardon client');
    }
  };

  const filtered = blockedClients.filter(
    (b) =>
      b.clientId.toLowerCase().includes(search.toLowerCase()) ||
      b.reason.toLowerCase().includes(search.toLowerCase()) ||
      b.clientIp.includes(search)
  );

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
            <Ban className="w-4 h-4 text-rose-400" />
            Active Client Quarantines & IP Isolation
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Clients subjected to automated or administrative HTTP 403 temporary blocks. Gateway rejects all requests until the countdown elapses.
          </p>
        </div>

        <div className="text-xs font-mono text-slate-400">
          Total Quarantined: <span className="text-rose-400 font-bold">{blockedClients.length}</span>
        </div>
      </div>

      {statusMsg && (
        <div className="p-3 bg-slate-900 border border-slate-700 rounded-lg text-xs font-mono text-cyan-300 flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-cyan-400 shrink-0" />
          <span>{statusMsg}</span>
        </div>
      )}

      {/* Manual Quarantine Form for Admins */}
      {activeRole === 'admin' && (
        <div className="p-5 bg-slate-900/60 border border-slate-800 rounded-xl space-y-3">
          <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wider font-mono flex items-center gap-2">
            <PlusCircle className="w-4 h-4 text-cyan-400" />
            Manual Client Quarantine Form
          </h3>

          <form onSubmit={handleManualBlock} className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs font-mono">
            <div>
              <label className="text-slate-400 block mb-1 text-[11px]">Client Identifier / IP</label>
              <input
                type="text"
                required
                placeholder="e.g. client-hostile-44"
                value={manualClientId}
                onChange={(e) => setManualClientId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-slate-200"
              />
            </div>

            <div>
              <label className="text-slate-400 block mb-1 text-[11px]">Duration (Seconds)</label>
              <input
                type="number"
                min="10"
                max="86400"
                value={manualDuration}
                onChange={(e) => setManualDuration(parseInt(e.target.value, 10) || 60)}
                className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-slate-200"
              />
            </div>

            <div>
              <label className="text-slate-400 block mb-1 text-[11px]">Reason for Quarantine</label>
              <input
                type="text"
                value={manualReason}
                onChange={(e) => setManualReason(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-slate-200"
              />
            </div>

            <div className="flex items-end">
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2 bg-rose-600 hover:bg-rose-500 text-white font-semibold rounded transition-colors disabled:opacity-50"
              >
                {submitting ? 'Applying...' : 'Quarantine Client'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Quarantined Clients Table */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between gap-4">
          <div className="relative w-full max-w-xs">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search blocked clients..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-md pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 font-mono"
            />
          </div>
          <span className="text-xs font-mono text-slate-400">
            {filtered.length} active sanctions
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-slate-950 border-b border-slate-800 text-slate-400 uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3 px-4">Client ID</th>
                <th className="py-3 px-4">IP Address</th>
                <th className="py-3 px-4">Reason</th>
                <th className="py-3 px-4">Risk Index</th>
                <th className="py-3 px-4">Remaining Time</th>
                <th className="py-3 px-4 text-right">Sanction Action</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500 text-xs">
                    No clients are currently blocked. Send the Mixed Multi-Vector attack in the Simulator to trigger automated quarantine!
                  </td>
                </tr>
              ) : (
                filtered.map((block) => {
                  const expiryMs = new Date(block.expiresAt).getTime();
                  const remainingSec = Math.max(0, Math.ceil((expiryMs - now) / 1000));
                  const isExpired = remainingSec <= 0;

                  return (
                    <tr key={block.clientId} className="hover:bg-slate-800/40">
                      <td className="py-3 px-4 font-bold text-slate-100 whitespace-nowrap">
                        {block.clientId}
                      </td>
                      <td className="py-3 px-4 text-slate-400 whitespace-nowrap">
                        {block.clientIp}
                      </td>
                      <td className="py-3 px-4 text-slate-300 max-w-sm truncate">
                        {block.reason}
                      </td>
                      <td className="py-3 px-4 font-bold text-rose-400 whitespace-nowrap">
                        {block.riskScore}/100
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`flex items-center gap-1.5 font-bold ${
                            isExpired
                              ? 'text-slate-500'
                              : remainingSec <= 10
                              ? 'text-amber-400 animate-pulse'
                              : 'text-rose-400'
                          }`}
                        >
                          <Clock className="w-3.5 h-3.5" />
                          {isExpired ? 'Re-enabling...' : `${remainingSec}s remaining`}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        {activeRole === 'admin' ? (
                          <button
                            onClick={() => handlePardon(block.clientId)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-emerald-400 rounded border border-slate-700 transition-colors text-[11px]"
                          >
                            <Unlock className="w-3 h-3" />
                            Pardon / Unblock
                          </button>
                        ) : (
                          <span className="text-slate-500 text-[11px] italic">Admin only</span>
                        )}
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
