import React, { useState, useRef } from 'react';
import {
  Play,
  Square,
  RotateCcw,
  Zap,
  ShieldAlert,
  KeyRound,
  FileQuestion,
  Skull,
  Send,
  CheckCircle,
  AlertTriangle,
  Ban,
  Clock,
} from 'lucide-react';
import type { UserRole } from '../types/sentinel';

interface SimulatorLog {
  id: string;
  time: string;
  method: string;
  endpoint: string;
  clientId: string;
  statusCode: number;
  latencyMs: number;
  riskScore: number;
  action: string;
  responsePreview: string;
}

type SimRequest = {
  method: string;
  endpoint: string;
  clientId: string;
  account?: string;
  session?: string;
  device?: string;
  body?: any;
  delayMs: number;
};

interface TrafficSimulatorTabProps {
  activeRole: UserRole;
  onRefreshAll: () => void;
}

export const TrafficSimulatorTab: React.FC<TrafficSimulatorTabProps> = ({
  activeRole,
  onRefreshAll,
}) => {
  const [isRunning, setIsRunning] = useState(false);
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const [logs, setLogs] = useState<SimulatorLog[]>([]);
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  // Custom request configuration state
  const [customMethod, setCustomMethod] = useState<'GET' | 'POST'>('GET');
  const [customEndpoint, setCustomEndpoint] = useState('/api/protected/products');
  const [customClientId, setCustomClientId] = useState('client-custom-probe');
  const [customPayload, setCustomPayload] = useState('{\n  "email": "attacker@darkweb.io",\n  "password": "incorrectPassword99!"\n}');
  const [customCount, setCustomCount] = useState<number>(10);
  const [customDelayMs, setCustomDelayMs] = useState<number>(100);

  const abortControllerRef = useRef<AbortController | null>(null);

  // Helper to append log
  const addLog = (log: SimulatorLog) => {
    setLogs((prev) => [log, ...prev.slice(0, 99)]);
  };

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsRunning(false);
    setActivePreset(null);
  };

  const handleResetEnvironment = async () => {
    handleStop();
    try {
      const res = await fetch('/api/simulator/reset', { method: 'POST' });
      if (res.ok) {
        setLogs([]);
        onRefreshAll();
      }
    } catch (e) {
      console.error('Reset failed:', e);
    }
  };

  // Generic request dispatcher
  const executeSimulation = async (
    name: string,
    requests: SimRequest[]
  ) => {
    if (isRunning) handleStop();

    setIsRunning(true);
    setActivePreset(name);
    setProgress({ current: 0, total: requests.length });

    const abortCtrl = new AbortController();
    abortControllerRef.current = abortCtrl;

    for (let i = 0; i < requests.length; i++) {
      if (abortCtrl.signal.aborted) break;

      const reqDef = requests[i];
      const start = Date.now();

      try {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          'X-Client-ID': reqDef.clientId,
        };
        if (reqDef.account) headers['X-Account-ID'] = reqDef.account;
        if (reqDef.session) headers['X-Session-ID'] = reqDef.session;
        if (reqDef.device) headers['X-Device-ID'] = reqDef.device;

        const fetchOptions: RequestInit = {
          method: reqDef.method,
          headers,
          signal: abortCtrl.signal,
        };

        if (reqDef.body && reqDef.method === 'POST') {
          fetchOptions.body = JSON.stringify(reqDef.body);
        }

        const res = await fetch(reqDef.endpoint, fetchOptions);
        const latencyMs = Date.now() - start;
        const text = await res.text();

        let preview = text.substring(0, 100);
        try {
          const json = JSON.parse(text);
          preview = JSON.stringify(json);
        } catch {}

        const riskScore = parseInt(res.headers.get('X-Sentinel-Risk-Score') || '0', 10);
        const action = res.headers.get('X-Sentinel-Action') || (res.status === 403 ? 'TEMPORARY_BLOCK' : res.status === 429 ? 'RATE_LIMIT' : 'ALLOW');

        addLog({
          id: Math.random().toString(36).substring(2, 8),
          time: new Date().toLocaleTimeString(),
          method: reqDef.method,
          endpoint: reqDef.endpoint,
          clientId: reqDef.clientId,
          statusCode: res.status,
          latencyMs,
          riskScore,
          action,
          responsePreview: preview,
        });

        setProgress({ current: i + 1, total: requests.length });
      } catch (err: any) {
        if (err.name === 'AbortError') break;
        console.error('Request error:', err);
      }

      if (reqDef.delayMs > 0 && i < requests.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, reqDef.delayMs));
      }
    }

    setIsRunning(false);
    setActivePreset(null);
    onRefreshAll();
  };

  // 1. Preset: Normal Traffic
  const runNormalTraffic = () => {
    const list: SimRequest[] = [];
    const clientId = 'client-normal-user-1';
    for (let i = 0; i < 8; i++) {
      const isProfile = i % 3 === 0;
      list.push({
        method: 'GET',
        endpoint: isProfile ? '/api/protected/profile' : '/api/protected/products',
        clientId,
        account: 'usr-normal-shopper',
        session: 'sess-legit-01',
        delayMs: 350,
      });
    }
    executeSimulation('Normal Traffic', list);
  };

  // 2. Preset: High Traffic Velocity Burst
  const runHighTrafficBurst = () => {
    const list: SimRequest[] = [];
    const clientId = 'client-velocity-spiker';
    for (let i = 0; i < 28; i++) {
      list.push({
        method: 'GET',
        endpoint: '/api/protected/products',
        clientId,
        account: 'usr-spiker-44',
        session: 'sess-burst-99',
        delayMs: 40,
      });
    }
    executeSimulation('High Traffic Burst', list);
  };

  // 3. Preset: Failed Login Burst (Credential Stuffing)
  const runFailedLoginBurst = () => {
    const list: SimRequest[] = [];
    const clientId = 'client-credential-attacker';
    const fakePasswords = [
      'password123',
      'admin2024',
      'hunter2',
      'letmein123',
      'spring2024!',
      'roottoor',
      'qwertyuiop',
    ];

    fakePasswords.forEach((pwd) => {
      list.push({
        method: 'POST',
        endpoint: '/api/protected/auth/login',
        clientId,
        account: 'target-account-alex',
        body: { email: 'alex@example.com', password: pwd },
        delayMs: 150,
      });
    });

    executeSimulation('Failed Login Burst', list);
  };

  // 4. Preset: Endpoint Anomaly & Sensitive Probing
  const runEndpointBurst = () => {
    const list: SimRequest[] = [];
    const clientId = 'client-dir-scanner';
    const paths = [
      '/api/protected/admin/keys',
      '/api/protected/admin/config',
      '/api/protected/internal/dump',
      '/api/protected/products/non-existent-99',
      '/api/protected/export/customers',
      '/api/protected/keys',
      '/api/protected/admin/keys',
    ];

    paths.forEach((p) => {
      list.push({
        method: 'GET',
        endpoint: p,
        clientId,
        delayMs: 120,
      });
    });

    executeSimulation('Endpoint Anomaly Burst', list);
  };

  // 5. Preset: Mixed Suspicious Multi-Vector Attack (Single IP Critical)
  const runMixedMultiVectorAttack = () => {
    const list: SimRequest[] = [];
    const clientId = 'client-multi-threat-91';

    for (let i = 0; i < 15; i++) {
      list.push({
        method: 'GET',
        endpoint: '/api/protected/products',
        clientId,
        delayMs: 30,
      });
    }

    for (let i = 0; i < 5; i++) {
      list.push({
        method: 'POST',
        endpoint: '/api/protected/auth/login',
        clientId,
        body: { email: 'victim@enterprise.com', password: `brute_${i}!` },
        delayMs: 40,
      });
    }

    for (let i = 0; i < 4; i++) {
      list.push({
        method: 'GET',
        endpoint: '/api/protected/admin/keys',
        clientId,
        delayMs: 30,
      });
    }

    for (let i = 0; i < 3; i++) {
      list.push({
        method: 'GET',
        endpoint: '/api/protected/products',
        clientId,
        delayMs: 50,
      });
    }

    executeSimulation('Mixed Suspicious Attack (Demo)', list);
  };

  // 6. Preset: Scenario A — College Result Release (Legitimate Synchronized Surge)
  const runCollegeResultSpike = () => {
    const list: SimRequest[] = [];
    const students = [
      { id: '103.21.244.11', acc: 'student-roll-4011', roll: 'CS-2026-001' },
      { id: '103.21.244.15', acc: 'student-roll-4012', roll: 'CS-2026-002' },
      { id: '103.21.244.19', acc: 'student-roll-4013', roll: 'CS-2026-003' },
      { id: '103.21.244.24', acc: 'student-roll-4014', roll: 'CS-2026-004' },
      { id: '103.21.244.30', acc: 'student-roll-4015', roll: 'CS-2026-005' },
      { id: '103.21.244.35', acc: 'student-roll-4016', roll: 'CS-2026-001' },
    ];

    students.forEach((s) => {
      list.push({
        method: 'GET',
        endpoint: `/api/protected/results?roll=${s.roll}`,
        clientId: s.id,
        account: s.acc,
        session: `sess-${s.acc}`,
        device: `dev-phone-${s.roll}`,
        delayMs: 160,
      });
    });

    executeSimulation('College Result Release (Legitimate Surge)', list);
  };

  // 7. Preset: Scenario B — Distributed Botnet Attack (Coordinated Multi-IP Pattern)
  const runDistributedBotnetAttack = () => {
    const list: SimRequest[] = [];
    const botIps = [
      '198.51.100.12',
      '198.51.100.14',
      '198.51.100.15',
      '198.51.100.22',
      '198.51.100.25',
      '198.51.100.31',
      '198.51.100.40',
    ];

    // Locked-step synchronized assault across 7 IPs and 12 Accounts
    for (let i = 0; i < botIps.length; i++) {
      const ip = botIps[i];
      const accNum = (i % 12) + 1;
      const accId = `acc-victim-${accNum < 10 ? '0' + accNum : accNum}`;

      // Auth spray
      list.push({
        method: 'POST',
        endpoint: '/api/protected/auth/login',
        clientId: ip,
        account: accId,
        session: `sess-bot-${800 + i}`,
        device: 'dev-headless-bot',
        body: { email: `${accId}@enterprise.com`, password: `p@ssword_stuff_${i}` },
        delayMs: 50,
      });

      // Rapid admin probe from bot cluster
      if (i % 2 === 0) {
        list.push({
          method: 'GET',
          endpoint: '/api/protected/admin/keys',
          clientId: ip,
          account: accId,
          session: `sess-bot-${800 + i}`,
          delayMs: 40,
        });
      }
    }

    executeSimulation('Coordinated Multi-IP Botnet Attack', list);
  };


  // Custom runner
  const runCustomTraffic = () => {
    let parsedBody: any = undefined;
    if (customMethod === 'POST' && customPayload.trim()) {
      try {
        parsedBody = JSON.parse(customPayload);
      } catch {
        alert('Invalid JSON in custom payload');
        return;
      }
    }

    const list: SimRequest[] = [];
    for (let i = 0; i < customCount; i++) {
      list.push({
        method: customMethod,
        endpoint: customEndpoint,
        clientId: customClientId,
        body: parsedBody,
        delayMs: customDelayMs,
      });
    }

    executeSimulation('Custom Dispatcher', list);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner Guide for Hackathon Judges */}
      <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-xl space-y-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
              <Zap className="w-4 h-4 text-cyan-400" />
              Controlled API Traffic Simulator & Attack Replay
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Safely fires real HTTP traffic against this application's protected backend. Observe the Sentinel gateway intercept, calculate risk, apply rate limits, or enact quarantine.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {isRunning && (
              <button
                onClick={handleStop}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-900/80 hover:bg-rose-800 text-rose-200 text-xs font-semibold rounded-md border border-rose-700 transition-colors"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
                Halt Simulation
              </button>
            )}

            <button
              onClick={handleResetEnvironment}
              disabled={isRunning}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-md border border-slate-700 transition-colors disabled:opacity-50"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset State & Unblock All
            </button>
          </div>
        </div>

        {isRunning && (
          <div className="pt-2">
            <div className="flex items-center justify-between text-xs font-mono text-cyan-300 mb-1">
              <span>Running {activePreset}...</span>
              <span>
                {progress.current} / {progress.total} requests
              </span>
            </div>
            <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-cyan-500 h-full transition-all duration-100"
                style={{
                  width: `${(progress.current / Math.max(1, progress.total)) * 100}%`,
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Preset Attacks & Flows Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Preset 1: Normal Traffic */}
        <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-lg flex flex-col justify-between space-y-3">
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-200">1. Normal Browsing Flow</span>
              <span className="text-[11px] font-mono text-emerald-400">Risk ~10</span>
            </div>
            <p className="text-xs text-slate-400">
              Legitimate user browsing catalog products and checking account profile at human intervals (350ms delay).
            </p>
          </div>
          <button
            onClick={runNormalTraffic}
            disabled={isRunning}
            className="w-full flex items-center justify-center gap-2 py-2 bg-emerald-950/70 hover:bg-emerald-900 text-emerald-300 text-xs font-semibold rounded border border-emerald-800/80 transition-colors disabled:opacity-50"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            Send Normal Traffic
          </button>
        </div>

        {/* Preset 2: High Traffic Spike */}
        <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-lg flex flex-col justify-between space-y-3">
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-200">2. Request Velocity Burst</span>
              <span className="text-[11px] font-mono text-amber-400">Risk ~65-75</span>
            </div>
            <p className="text-xs text-slate-400">
              Rapid burst of 28 requests with 40ms spacing. Exceeds velocity threshold and triggers HTTP 429 Rate Limiting.
            </p>
          </div>
          <button
            onClick={runHighTrafficBurst}
            disabled={isRunning}
            className="w-full flex items-center justify-center gap-2 py-2 bg-amber-950/70 hover:bg-amber-900 text-amber-300 text-xs font-semibold rounded border border-amber-800/80 transition-colors disabled:opacity-50"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            Send Traffic Burst
          </button>
        </div>

        {/* Preset 3: Failed Login Burst */}
        <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-lg flex flex-col justify-between space-y-3">
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-200">3. Failed Login Spray</span>
              <span className="text-[11px] font-mono text-amber-400">Risk ~70</span>
            </div>
            <p className="text-xs text-slate-400">
              Simulates credential stuffing / dictionary attack against `/api/protected/auth/login` with consecutive 401s.
            </p>
          </div>
          <button
            onClick={runFailedLoginBurst}
            disabled={isRunning}
            className="w-full flex items-center justify-center gap-2 py-2 bg-amber-950/70 hover:bg-amber-900 text-amber-300 text-xs font-semibold rounded border border-amber-800/80 transition-colors disabled:opacity-50"
          >
            <KeyRound className="w-3.5 h-3.5" />
            Send Auth Failure Burst
          </button>
        </div>

        {/* Preset 4: Endpoint Anomaly */}
        <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-lg flex flex-col justify-between space-y-3">
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-200">4. Endpoint Probing & 404s</span>
              <span className="text-[11px] font-mono text-indigo-400">Risk ~60</span>
            </div>
            <p className="text-xs text-slate-400">
              Automated directory fuzzing probing non-existent paths, admin keys, and database dump targets.
            </p>
          </div>
          <button
            onClick={runEndpointBurst}
            disabled={isRunning}
            className="w-full flex items-center justify-center gap-2 py-2 bg-indigo-950/70 hover:bg-indigo-900 text-indigo-300 text-xs font-semibold rounded border border-indigo-800/80 transition-colors disabled:opacity-50"
          >
            <FileQuestion className="w-3.5 h-3.5" />
            Send Endpoint Probe
          </button>
        </div>

        {/* Preset 5: Mixed Multi-Vector Attack (Hackathon Demo Star) */}
        <div className="md:col-span-2 lg:col-span-2 p-4 bg-rose-950/20 border border-rose-800/70 rounded-lg flex flex-col justify-between space-y-3">
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-rose-300 flex items-center gap-1.5">
                <Skull className="w-4 h-4 text-rose-400" />
                5. Mixed Multi-Vector Attack (Score 91+ & Quarantine Demo)
              </span>
              <span className="text-[11px] font-mono font-bold text-rose-400">
                P0 HACKATHON DEMO
              </span>
            </div>
            <p className="text-xs text-slate-300">
              Combines rapid velocity surge + credential assault + restricted admin probes. Forces risk score over 90, automatically triggering Sentinel's <strong>TEMPORARY BLOCK (HTTP 403)</strong> quarantine!
            </p>
          </div>

          <button
            onClick={runMixedMultiVectorAttack}
            disabled={isRunning}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded shadow-md transition-colors disabled:opacity-50"
          >
            <Play className="w-4 h-4 fill-current" />
            Execute Full Multi-Vector Attack (Score 91+ & Quarantine)
          </button>
        </div>
      </div>

      {/* Two Columns: Custom Traffic Builder & Real-time Live Log Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Custom Request Dispatcher Form */}
        <div className="p-5 bg-slate-900/70 border border-slate-800 rounded-xl space-y-4">
          <div className="border-b border-slate-800/80 pb-2.5">
            <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wider font-mono">
              Custom HTTP Request Builder
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Send bespoke parameters directly through the gateway
            </p>
          </div>

          <div className="space-y-3 text-xs font-mono">
            {/* Method & Endpoint */}
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Method</label>
                <select
                  value={customMethod}
                  onChange={(e) => setCustomMethod(e.target.value as 'GET' | 'POST')}
                  className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-slate-200"
                >
                  <option value="GET">GET</option>
                  <option value="POST">POST</option>
                </select>
              </div>

              <div className="col-span-2">
                <label className="text-[11px] text-slate-400 block mb-1">Target Endpoint</label>
                <input
                  type="text"
                  value={customEndpoint}
                  onChange={(e) => setCustomEndpoint(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-slate-200"
                />
              </div>
            </div>

            {/* Client ID */}
            <div>
              <label className="text-[11px] text-slate-400 block mb-1">X-Client-ID Header</label>
              <input
                type="text"
                value={customClientId}
                onChange={(e) => setCustomClientId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-slate-200"
              />
            </div>

            {/* Repeat count & delay */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Total Hits</label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={customCount}
                  onChange={(e) => setCustomCount(parseInt(e.target.value, 10) || 1)}
                  className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-slate-200"
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Delay (ms)</label>
                <input
                  type="number"
                  min="0"
                  max="2000"
                  step="50"
                  value={customDelayMs}
                  onChange={(e) => setCustomDelayMs(parseInt(e.target.value, 10) || 0)}
                  className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-slate-200"
                />
              </div>
            </div>

            {/* POST JSON Payload */}
            {customMethod === 'POST' && (
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">JSON Payload Body</label>
                <textarea
                  rows={4}
                  value={customPayload}
                  onChange={(e) => setCustomPayload(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-slate-200 text-[11px]"
                />
              </div>
            )}

            <button
              onClick={runCustomTraffic}
              disabled={isRunning}
              className="w-full flex items-center justify-center gap-2 py-2 bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-semibold rounded transition-colors disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              Dispatch Custom Requests
            </button>
          </div>
        </div>

        {/* Live Simulator Response Terminal Feed */}
        <div className="lg:col-span-2 p-5 bg-slate-900/70 border border-slate-800 rounded-xl space-y-3 flex flex-col">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
            <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wider font-mono">
              Simulator Telemetry Console
            </h3>
            <span className="text-[11px] text-slate-400 font-mono">
              {logs.length} responses recorded
            </span>
          </div>

          <div className="flex-1 min-h-[300px] max-h-[440px] overflow-y-auto space-y-2 pr-1 font-mono text-xs">
            {logs.length === 0 ? (
              <div className="py-20 text-center text-slate-500">
                <Clock className="w-6 h-6 mx-auto mb-2 opacity-40" />
                Select any preset above to initiate traffic and inspect live gateway responses.
              </div>
            ) : (
              logs.map((log) => {
                const isBlocked = log.statusCode === 403;
                const isRateLimited = log.statusCode === 429;
                return (
                  <div
                    key={log.id}
                    className={`p-2.5 rounded border text-[11px] ${
                      isBlocked
                        ? 'bg-rose-950/40 border-rose-800/70 text-rose-200'
                        : isRateLimited
                        ? 'bg-amber-950/40 border-amber-800/70 text-amber-200'
                        : 'bg-slate-950/60 border-slate-800/80 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 truncate">
                        <span className="text-slate-500">{log.time}</span>
                        <span className="font-bold text-cyan-400">{log.method}</span>
                        <span className="truncate">{log.endpoint}</span>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span
                          className={`font-bold px-1.5 py-0.5 rounded text-[10px] ${
                            log.statusCode === 200 || log.statusCode === 201
                              ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                              : isBlocked
                              ? 'bg-rose-950 text-rose-400 border border-rose-800'
                              : isRateLimited
                              ? 'bg-amber-950 text-amber-400 border border-amber-800'
                              : 'bg-slate-800 text-slate-300'
                          }`}
                        >
                          HTTP {log.statusCode}
                        </span>
                        <span className="text-slate-400 font-bold">
                          Risk: {log.riskScore}
                        </span>
                        <span className="text-[10px] px-1 bg-slate-900 border border-slate-700 rounded text-slate-300">
                          {log.action}
                        </span>
                      </div>
                    </div>

                    <div className="mt-1 flex items-center justify-between text-slate-400 text-[10px]">
                      <span>Client: {log.clientId} ({log.latencyMs}ms)</span>
                      <span className="truncate max-w-[280px] text-slate-500">
                        {log.responsePreview}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
