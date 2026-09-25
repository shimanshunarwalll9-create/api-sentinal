import React, { useState, useEffect } from 'react';
import {
  Server,
  Activity,
  Terminal,
  Database,
  CheckCircle2,
  AlertTriangle,
  Play,
  Copy,
  Check,
  Send,
  Code2,
  ArrowRight,
  Shield,
  Layers,
  Cpu,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import type { UserRole } from '../types/sentinel';

interface BackendApiTabProps {
  activeRole: UserRole;
  onRefreshAll?: () => void;
}

interface RouteItem {
  category: string;
  method: string;
  path: string;
  description: string;
  protectedBySentinel: boolean;
  headersRequired?: string[];
}

interface ProbeResult {
  statusCode: number;
  gatewayDecision: string;
  riskScore: number;
  riskLevel: string;
  latencyMs: number;
  reasons: string[];
  breakdown: {
    requestRateScore: number;
    failedAuthScore: number;
    endpointAnomalyScore: number;
    behaviorChangeScore: number;
  };
  headers: Record<string, string>;
  responseBody: any;
}

export const BackendApiTab: React.FC<BackendApiTabProps> = ({
  activeRole,
  onRefreshAll,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'tester' | 'routes' | 'architecture' | 'database' | 'code'>('tester');
  const [routes, setRoutes] = useState<RouteItem[]>([]);
  const [selectedRoute, setSelectedRoute] = useState<string>('/api/protected/auth/login');
  const [method, setMethod] = useState<string>('POST');
  const [clientId, setClientId] = useState<string>('client-test-88');
  const [accountId, setAccountId] = useState<string>('acc-user-42');
  const [requestBody, setRequestBody] = useState<string>(
    JSON.stringify({ email: 'target@corp.internal', password: 'wrongPassword123' }, null, 2)
  );
  const [probeResult, setProbeResult] = useState<ProbeResult | null>(null);
  const [isProbing, setIsProbing] = useState<boolean>(false);
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [healthData, setHealthData] = useState<any>(null);
  const [statusData, setStatusData] = useState<any>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  // Load routes and health status
  const fetchBackendMeta = async () => {
    try {
      const [healthRes, statusRes, routesRes] = await Promise.all([
        fetch('/api/health'),
        fetch('/api/backend/status'),
        fetch('/api/backend/routes'),
      ]);
      if (healthRes.ok) setHealthData(await healthRes.json());
      if (statusRes.ok) setStatusData(await statusRes.json());
      if (routesRes.ok) {
        const data = await routesRes.json();
        setRoutes(data.routes || []);
      }
    } catch (e) {
      console.error('Failed to fetch backend diagnostics:', e);
    }
  };

  useEffect(() => {
    fetchBackendMeta();
  }, []);

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(label);
    setTimeout(() => setCopiedText(null), 2000);
  };

  const handleExecuteProbe = async () => {
    setIsProbing(true);
    setProbeResult(null);

    let parsedBody = {};
    if (method !== 'GET') {
      try {
        parsedBody = JSON.parse(requestBody);
      } catch {
        parsedBody = { raw: requestBody };
      }
    }

    try {
      const res = await fetch('/api/backend/test-probe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          method,
          path: selectedRoute,
          clientId: clientId.trim() || undefined,
          accountId: accountId.trim() || undefined,
          body: parsedBody,
        }),
      });

      const data = await res.json();
      setProbeResult(data);
      if (onRefreshAll) onRefreshAll();
    } catch (err: any) {
      setProbeResult({
        statusCode: 500,
        gatewayDecision: 'ERROR',
        riskScore: 0,
        riskLevel: 'unknown',
        latencyMs: 1,
        reasons: ['Probe execution error: ' + err.message],
        breakdown: {
          requestRateScore: 0,
          failedAuthScore: 0,
          endpointAnomalyScore: 0,
          behaviorChangeScore: 0,
        },
        headers: {},
        responseBody: { error: err.message },
      });
    } finally {
      setIsProbing(false);
    }
  };

  const categories = ['ALL', ...Array.from(new Set(routes.map((r) => r.category)))];
  const filteredRoutes =
    selectedCategory === 'ALL'
      ? routes
      : routes.filter((r) => r.category === selectedCategory);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 bg-slate-900/80 border border-slate-800 rounded-xl">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-lg bg-cyan-950/70 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
            <Server className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
              API Sentinel Backend & Gateway Architecture
              <span className="px-2 py-0.5 text-[10px] font-mono uppercase bg-emerald-950/60 border border-emerald-500/40 text-emerald-400 rounded">
                Operational
              </span>
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Dual-runtime engine (Node.js Express & Python FastAPI) with live behavioral reverse-proxy middleware.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchBackendMeta}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-md transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5 text-cyan-400" />
            <span>Refresh Diagnostics</span>
          </button>
        </div>
      </div>

      {/* KPI Engine Status Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="p-3.5 bg-slate-900/60 border border-slate-800 rounded-lg">
          <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
            <span>Gateway Runtime</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-1.5 text-lg font-bold font-mono text-slate-100">
            Express + FastAPI
          </div>
          <div className="text-[11px] text-slate-500 font-mono">Ports: 3000 & 8000</div>
        </div>

        <div className="p-3.5 bg-slate-900/60 border border-slate-800 rounded-lg">
          <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
            <span>Scoring Engine</span>
            <Activity className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="mt-1.5 text-lg font-bold font-mono text-cyan-400">
            7 Feature Dimensions
          </div>
          <div className="text-[11px] text-slate-500 font-mono">Sliding window & entropy</div>
        </div>

        <div className="p-3.5 bg-slate-900/60 border border-slate-800 rounded-lg">
          <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
            <span>Enforcement Latency</span>
            <Cpu className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="mt-1.5 text-lg font-bold font-mono text-slate-100">
            &lt; 1.2 ms
          </div>
          <div className="text-[11px] text-slate-500 font-mono">Zero proxy bottleneck</div>
        </div>

        <div className="p-3.5 bg-slate-900/60 border border-slate-800 rounded-lg">
          <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
            <span>AI Incident Analyst</span>
            <Shield className="w-4 h-4 text-purple-400" />
          </div>
          <div className="mt-1.5 text-lg font-bold font-mono text-purple-300">
            Gemini 2.5 Flash
          </div>
          <div className="text-[11px] text-slate-500 font-mono">Automated incident briefing</div>
        </div>
      </div>

      {/* Sub-Navigation Tabs */}
      <div className="flex border-b border-slate-800 space-x-2">
        <button
          onClick={() => setActiveSubTab('tester')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
            activeSubTab === 'tester'
              ? 'border-cyan-400 text-cyan-300 bg-slate-900/40'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Play className="w-3.5 h-3.5" />
          <span>Interactive Probe Tester</span>
        </button>
        <button
          onClick={() => setActiveSubTab('routes')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
            activeSubTab === 'routes'
              ? 'border-cyan-400 text-cyan-300 bg-slate-900/40'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Terminal className="w-3.5 h-3.5" />
          <span>API Routes Catalog ({routes.length})</span>
        </button>
        <button
          onClick={() => setActiveSubTab('architecture')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
            activeSubTab === 'architecture'
              ? 'border-cyan-400 text-cyan-300 bg-slate-900/40'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Gateway Pipeline</span>
        </button>
        <button
          onClick={() => setActiveSubTab('database')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
            activeSubTab === 'database'
              ? 'border-cyan-400 text-cyan-300 bg-slate-900/40'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Database className="w-3.5 h-3.5" />
          <span>Database Schema (PostgreSQL)</span>
        </button>
        <button
          onClick={() => setActiveSubTab('code')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
            activeSubTab === 'code'
              ? 'border-cyan-400 text-cyan-300 bg-slate-900/40'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Code2 className="w-3.5 h-3.5" />
          <span>SDK & Integration Snippets</span>
        </button>
      </div>

      {/* SUB-TAB 1: Interactive Probe Tester */}
      {activeSubTab === 'tester' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Configuration Panel */}
          <div className="lg:col-span-5 space-y-4 bg-slate-900/70 border border-slate-800 p-5 rounded-xl">
            <h2 className="text-sm font-semibold text-slate-200 flex items-center justify-between">
              <span>Direct Gateway Probe Request</span>
              <span className="text-[11px] text-slate-500 font-mono">Live In-Flight Interception</span>
            </h2>

            {/* Target Route */}
            <div>
              <label className="block text-xs font-mono text-slate-400 mb-1">
                Target Protected Endpoint
              </label>
              <select
                value={selectedRoute}
                onChange={(e) => {
                  setSelectedRoute(e.target.value);
                  if (e.target.value.includes('/auth/login') || e.target.value.includes('/orders')) {
                    setMethod('POST');
                  } else {
                    setMethod('GET');
                  }
                }}
                className="w-full bg-slate-950 border border-slate-700 text-slate-200 text-xs rounded-md p-2 font-mono focus:border-cyan-500 focus:outline-none"
              >
                <option value="/api/protected/auth/login">POST /api/protected/auth/login (Auth Bruteforce Target)</option>
                <option value="/api/protected/results">GET /api/protected/results (Grade/Degree Release Surge)</option>
                <option value="/api/protected/products">GET /api/protected/products (Store Catalog)</option>
                <option value="/api/protected/orders">POST /api/protected/orders (Checkout Transaction)</option>
                <option value="/api/protected/profile">GET /api/protected/profile (User Account Data)</option>
                <option value="/api/protected/admin/keys">GET /api/protected/admin/keys (Restricted Admin Secret)</option>
              </select>
            </div>

            {/* Method & Client ID */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1">Method</label>
                <select
                  value={method}
                  onChange={(e) => setMethod(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 text-slate-200 text-xs rounded-md p-2 font-mono focus:border-cyan-500 focus:outline-none"
                >
                  <option value="GET">GET</option>
                  <option value="POST">POST</option>
                  <option value="PUT">PUT</option>
                  <option value="DELETE">DELETE</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1">
                  Client Identifier (IP/ID)
                </label>
                <input
                  type="text"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  placeholder="e.g. 198.51.100.22"
                  className="w-full bg-slate-950 border border-slate-700 text-slate-200 text-xs rounded-md p-2 font-mono focus:border-cyan-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Account ID */}
            <div>
              <label className="block text-xs font-mono text-slate-400 mb-1">
                Account ID / Session ID (Optional)
              </label>
              <input
                type="text"
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                placeholder="e.g. acc-victim-01 or student-roll-4011"
                className="w-full bg-slate-950 border border-slate-700 text-slate-200 text-xs rounded-md p-2 font-mono focus:border-cyan-500 focus:outline-none"
              />
            </div>

            {/* Request Body */}
            {method !== 'GET' && (
              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1">
                  Request Payload (JSON)
                </label>
                <textarea
                  rows={4}
                  value={requestBody}
                  onChange={(e) => setRequestBody(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 text-cyan-300 text-xs rounded-md p-2 font-mono focus:border-cyan-500 focus:outline-none resize-none"
                />
              </div>
            )}

            {/* Execute Button */}
            <button
              onClick={handleExecuteProbe}
              disabled={isProbing}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold rounded-md shadow-md shadow-cyan-600/20 transition-all disabled:opacity-50"
            >
              {isProbing ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              <span>{isProbing ? 'Evaluating Through Gateway...' : 'Send Probe Through Sentinel Gateway'}</span>
            </button>
          </div>

          {/* Right Live Results Panel */}
          <div className="lg:col-span-7 space-y-4">
            {probeResult ? (
              <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-xl space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-0.5 text-xs font-mono font-bold rounded ${
                        probeResult.statusCode === 200
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                          : probeResult.statusCode === 403
                          ? 'bg-rose-950 text-rose-300 border border-rose-800'
                          : 'bg-amber-950 text-amber-300 border border-amber-800'
                      }`}
                    >
                      HTTP {probeResult.statusCode}
                    </span>
                    <span className="text-xs font-mono text-slate-300">
                      Gateway Decision:
                    </span>
                    <span
                      className={`text-xs font-mono font-bold ${
                        probeResult.gatewayDecision === 'ALLOW'
                          ? 'text-emerald-400'
                          : probeResult.gatewayDecision === 'TEMPORARY_BLOCK'
                          ? 'text-rose-400'
                          : probeResult.gatewayDecision === 'RATE_LIMIT'
                          ? 'text-amber-400'
                          : 'text-cyan-400'
                      }`}
                    >
                      {probeResult.gatewayDecision}
                    </span>
                  </div>

                  <span className="text-xs font-mono text-slate-500">
                    Latency: {probeResult.latencyMs}ms
                  </span>
                </div>

                {/* Score & Risk Level */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div className="p-2.5 bg-slate-950/70 border border-slate-800 rounded">
                    <span className="text-[10px] text-slate-500 font-mono block">Threat Score</span>
                    <span className="text-lg font-bold font-mono text-cyan-400">
                      {probeResult.riskScore} <span className="text-xs text-slate-500">/ 100</span>
                    </span>
                  </div>
                  <div className="p-2.5 bg-slate-950/70 border border-slate-800 rounded">
                    <span className="text-[10px] text-slate-500 font-mono block">Risk Level</span>
                    <span className="text-sm font-bold font-mono text-slate-200 uppercase">
                      {probeResult.riskLevel}
                    </span>
                  </div>
                  <div className="p-2.5 bg-slate-950/70 border border-slate-800 rounded">
                    <span className="text-[10px] text-slate-500 font-mono block">Rate Anomaly</span>
                    <span className="text-sm font-bold font-mono text-slate-200">
                      +{probeResult.breakdown?.requestRateScore ?? 0}
                    </span>
                  </div>
                  <div className="p-2.5 bg-slate-950/70 border border-slate-800 rounded">
                    <span className="text-[10px] text-slate-500 font-mono block">Auth Friction</span>
                    <span className="text-sm font-bold font-mono text-slate-200">
                      +{probeResult.breakdown?.failedAuthScore ?? 0}
                    </span>
                  </div>
                </div>

                {/* Reasons List */}
                <div>
                  <span className="text-xs font-mono text-slate-400 block mb-1">
                    Behavioral Heuristics Triggered:
                  </span>
                  <ul className="space-y-1">
                    {probeResult.reasons.map((r, i) => (
                      <li
                        key={i}
                        className="text-xs text-slate-300 font-mono bg-slate-950 px-2.5 py-1 rounded border border-slate-800/80 flex items-center gap-1.5"
                      >
                        <span className="text-cyan-400">•</span>
                        <span>{r}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Gateway Response Headers */}
                <div>
                  <span className="text-xs font-mono text-slate-400 block mb-1">
                    Injected Gateway Security Headers:
                  </span>
                  <pre className="p-2.5 bg-slate-950 border border-slate-800 rounded text-xs text-cyan-300 font-mono overflow-x-auto">
                    {Object.entries(probeResult.headers)
                      .map(([k, v]) => `${k}: ${v}`)
                      .join('\n')}
                  </pre>
                </div>

                {/* Response Body */}
                <div>
                  <span className="text-xs font-mono text-slate-400 block mb-1">
                    Returned Response Body:
                  </span>
                  <pre className="p-2.5 bg-slate-950 border border-slate-800 rounded text-xs text-slate-300 font-mono overflow-x-auto max-h-48">
                    {JSON.stringify(probeResult.responseBody, null, 2)}
                  </pre>
                </div>
              </div>
            ) : (
              <div className="h-full min-h-[300px] flex flex-col items-center justify-center p-8 bg-slate-900/40 border border-slate-800 border-dashed rounded-xl text-center">
                <Terminal className="w-10 h-10 text-slate-600 mb-3" />
                <h3 className="text-sm font-semibold text-slate-300">Ready for Live Probe</h3>
                <p className="text-xs text-slate-500 max-w-sm mt-1">
                  Configure a target endpoint and client ID on the left to observe real-time Sentinel Gateway risk evaluation and policy enforcement.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUB-TAB 2: API Routes Catalog */}
      {activeSubTab === 'routes' && (
        <div className="space-y-4">
          {/* Category Filter Pills */}
          <div className="flex flex-wrap gap-1.5">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1 text-xs font-mono rounded transition-colors ${
                  selectedCategory === cat
                    ? 'bg-cyan-600 text-white font-semibold'
                    : 'bg-slate-900 text-slate-400 hover:bg-slate-800 border border-slate-800'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Routes Table */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="p-3">Method</th>
                    <th className="p-3">Path</th>
                    <th className="p-3">Category</th>
                    <th className="p-3">Gateway Protection</th>
                    <th className="p-3">Description</th>
                    <th className="p-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  {filteredRoutes.map((r, i) => (
                    <tr key={i} className="hover:bg-slate-800/40 transition-colors">
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                            r.method === 'GET'
                              ? 'bg-blue-950 text-blue-300 border border-blue-800'
                              : r.method === 'POST'
                              ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                              : r.method === 'PUT'
                              ? 'bg-amber-950 text-amber-300 border border-amber-800'
                              : 'bg-rose-950 text-rose-300 border border-rose-800'
                          }`}
                        >
                          {r.method}
                        </span>
                      </td>
                      <td className="p-3 font-semibold text-cyan-300">{r.path}</td>
                      <td className="p-3 text-slate-400">{r.category}</td>
                      <td className="p-3">
                        {r.protectedBySentinel ? (
                          <span className="inline-flex items-center gap-1 text-emerald-400 text-[11px]">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Intercepted</span>
                          </span>
                        ) : (
                          <span className="text-slate-500 text-[11px]">Direct Core</span>
                        )}
                      </td>
                      <td className="p-3 text-slate-400 max-w-xs truncate">{r.description}</td>
                      <td className="p-3 text-right">
                        <button
                          onClick={() => {
                            setSelectedRoute(r.path);
                            setMethod(r.method);
                            setActiveSubTab('tester');
                          }}
                          className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-[11px] transition-colors"
                        >
                          Probe Test
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 3: Gateway Pipeline Architecture */}
      {activeSubTab === 'architecture' && (
        <div className="space-y-6">
          <div className="bg-slate-900/80 border border-slate-800 p-6 rounded-xl space-y-6">
            <h2 className="text-sm font-semibold text-slate-100">
              API Sentinel Real-Time Reverse-Proxy Pipeline (6-Stage Flow)
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
              {/* Step 1 */}
              <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-lg space-y-2">
                <div className="w-6 h-6 rounded-full bg-cyan-950 border border-cyan-500/40 text-cyan-400 font-mono text-xs flex items-center justify-center">
                  1
                </div>
                <h4 className="text-xs font-semibold text-slate-200">Ingress Interception</h4>
                <p className="text-[11px] text-slate-400">
                  Captures <code className="text-cyan-300">X-Client-ID</code>, IP, User-Agent, and session contexts.
                </p>
              </div>

              {/* Step 2 */}
              <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-lg space-y-2">
                <div className="w-6 h-6 rounded-full bg-rose-950 border border-rose-500/40 text-rose-400 font-mono text-xs flex items-center justify-center">
                  2
                </div>
                <h4 className="text-xs font-semibold text-slate-200">Quarantine Lookup</h4>
                <p className="text-[11px] text-slate-400">
                  Fast <code className="text-rose-300">O(1)</code> cache check for active blocks with 403 Forbidden rejection.
                </p>
              </div>

              {/* Step 3 */}
              <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-lg space-y-2">
                <div className="w-6 h-6 rounded-full bg-amber-950 border border-amber-500/40 text-amber-400 font-mono text-xs flex items-center justify-center">
                  3
                </div>
                <h4 className="text-xs font-semibold text-slate-200">Sliding Velocity</h4>
                <p className="text-[11px] text-slate-400">
                  Calculates 60-second RPM velocity and auth error ratios in real time.
                </p>
              </div>

              {/* Step 4 */}
              <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-lg space-y-2">
                <div className="w-6 h-6 rounded-full bg-indigo-950 border border-indigo-500/40 text-indigo-400 font-mono text-xs flex items-center justify-center">
                  4
                </div>
                <h4 className="text-xs font-semibold text-slate-200">Behavioral Score</h4>
                <p className="text-[11px] text-slate-400">
                  Evaluates 7-dimensional scoring matrix (0 to 100) with explainable reasons.
                </p>
              </div>

              {/* Step 5 */}
              <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-lg space-y-2">
                <div className="w-6 h-6 rounded-full bg-emerald-950 border border-emerald-500/40 text-emerald-400 font-mono text-xs flex items-center justify-center">
                  5
                </div>
                <h4 className="text-xs font-semibold text-slate-200">Policy Enforcement</h4>
                <p className="text-[11px] text-slate-400">
                  Enforces ALLOW, MONITOR, RATE_LIMIT, or TEMPORARY_BLOCK actions.
                </p>
              </div>

              {/* Step 6 */}
              <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-lg space-y-2">
                <div className="w-6 h-6 rounded-full bg-purple-950 border border-purple-500/40 text-purple-400 font-mono text-xs flex items-center justify-center">
                  6
                </div>
                <h4 className="text-xs font-semibold text-slate-200">Broadcast & AI</h4>
                <p className="text-[11px] text-slate-400">
                  Pushes WebSocket live telemetry and triggers Gemini incident summaries.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 4: Database Schema */}
      {activeSubTab === 'database' && (
        <div className="space-y-4">
          <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-200">
                  PostgreSQL Production Relational Schema
                </h3>
                <p className="text-xs text-slate-500 font-mono">
                  From <code className="text-cyan-400">database/schema.sql</code> (6 core tables)
                </p>
              </div>
              <button
                onClick={() =>
                  handleCopy(
                    `-- PostgreSQL Schema
-- Tables: users, api_projects, api_requests, threat_events, security_rules, blocked_clients`,
                    'schema'
                  )
                }
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded border border-slate-700"
              >
                {copiedText === 'schema' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedText === 'schema' ? 'Copied' : 'Copy SQL'}</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {[
                {
                  name: 'users',
                  desc: 'Authentication, hashed passwords, roles (admin, analyst, viewer).',
                  cols: ['id UUID PK', 'email VARCHAR', 'hashed_password VARCHAR', 'role VARCHAR', 'created_at TZ'],
                },
                {
                  name: 'api_projects',
                  desc: 'Protected upstream microservice hosts and routing targets.',
                  cols: ['id UUID PK', 'name VARCHAR', 'slug VARCHAR', 'target_base_url VARCHAR', 'is_active BOOL'],
                },
                {
                  name: 'api_requests',
                  desc: 'Sanitized live request telemetry, latency, and risk scoring.',
                  cols: ['id UUID PK', 'client_id VARCHAR', 'method VARCHAR', 'endpoint VARCHAR', 'status_code INT', 'risk_score INT'],
                },
                {
                  name: 'threat_events',
                  desc: 'Security incidents with score breakdown and AI explanation.',
                  cols: ['id UUID PK', 'risk_score INT', 'action_enforced VARCHAR', 'reasons JSONB', 'ai_explanation TEXT'],
                },
                {
                  name: 'security_rules',
                  desc: 'Configurable policy score thresholds, rate limits, block duration.',
                  cols: ['id UUID PK', 'name VARCHAR', 'min_score INT', 'max_score INT', 'action VARCHAR', 'block_duration_sec INT'],
                },
                {
                  name: 'blocked_clients',
                  desc: 'Active quarantined clients with countdown timestamps and reasons.',
                  cols: ['id UUID PK', 'client_id VARCHAR', 'risk_score INT', 'expires_at TZ', 'is_active BOOL'],
                },
              ].map((table, idx) => (
                <div key={idx} className="p-3 bg-slate-950 border border-slate-800 rounded-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-xs text-cyan-300">{table.name}</span>
                    <span className="text-[10px] font-mono text-slate-500">TABLE</span>
                  </div>
                  <p className="text-[11px] text-slate-400">{table.desc}</p>
                  <div className="pt-2 border-t border-slate-800 space-y-1">
                    {table.cols.map((col, cIdx) => (
                      <div key={cIdx} className="text-[10px] font-mono text-slate-500">
                        {col}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 5: SDK & Integration Snippets */}
      {activeSubTab === 'code' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Express.js Middleware */}
            <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-200">Express.js Gateway Middleware</span>
                <span className="text-[11px] font-mono text-cyan-400">Node.js / TypeScript</span>
              </div>
              <pre className="p-3 bg-slate-950 border border-slate-800 rounded text-xs text-slate-300 font-mono overflow-x-auto max-h-64">
{`import express from 'express';
import { calculateRiskScore } from './sentinel';

const app = express();

app.use('/api/protected', async (req, res, next) => {
  const clientId = req.headers['x-client-id'] || req.ip;
  const evaluation = calculateRiskScore(clientId, req.path, req.method);

  res.setHeader('X-Sentinel-Risk-Score', evaluation.riskScore);
  res.setHeader('X-Sentinel-Action', evaluation.action);

  if (evaluation.action === 'TEMPORARY_BLOCK') {
    return res.status(403).json({ error: 'Quarantined by API Sentinel' });
  }
  next();
});`}
              </pre>
            </div>

            {/* FastAPI Middleware */}
            <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-200">FastAPI Gateway Middleware</span>
                <span className="text-[11px] font-mono text-emerald-400">Python 3.10+</span>
              </div>
              <pre className="p-3 bg-slate-950 border border-slate-800 rounded text-xs text-slate-300 font-mono overflow-x-auto max-h-64">
{`from fastapi import FastAPI, Request, Response
from sentinel import calculate_risk

app = FastAPI()

@app.middleware("http")
async def sentinel_middleware(request: Request, call_next):
    if not request.url.path.startswith("/api/protected"):
        return await call_next(request)
        
    client_id = request.headers.get("x-client-id") or request.client.host
    evaluation = calculate_risk(client_id, request.url.path, request.method)
    
    if evaluation["action"] == "TEMPORARY_BLOCK":
        return Response(content='{"error": "Quarantined"}', status_code=403)
        
    response = await call_next(request)
    response.headers["X-Sentinel-Risk-Score"] = str(evaluation["risk_score"])
    return response`}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
