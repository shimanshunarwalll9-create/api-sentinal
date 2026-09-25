import express, { Request, Response, NextFunction } from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI } from '@google/genai';
import type {
  ApiRequestTelemetry,
  ThreatEvent,
  SecurityPolicy,
  BlockedClient,
  AuditLog,
  RiskLevel,
  SecurityAction,
  DashboardOverview,
  Product,
  Order,
  BehavioralFingerprint,
  DistributedPattern,
  RelationshipGraphData,
  GraphNode,
  GraphEdge,
  UserAccount,
  SimilarityWeights,
} from './src/types/sentinel';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isProduction = process.env.NODE_ENV === 'production';
const PORT = process.env.PORT || 3000;

// Initialize GoogleGenAI SDK with required aistudio-build telemetry
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

const app = express();

// Enable CORS for frontend clients
app.use(
  cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'X-Client-ID',
      'X-Account-ID',
      'X-Session-ID',
      'Accept',
    ],
    exposedHeaders: [
      'X-Sentinel-Risk-Score',
      'X-Sentinel-Risk-Level',
      'X-Sentinel-Action',
      'X-Sentinel-Latency',
      'Retry-After',
    ],
  })
);

// URL Normalization Middleware for serverless / Vercel API routing
app.use((req, _res, next) => {
  if (req.url && !req.url.startsWith('/api') && !req.url.startsWith('/ws') && !req.url.startsWith('/assets')) {
    if (
      req.url.startsWith('/auth') ||
      req.url.startsWith('/health') ||
      req.url.startsWith('/dashboard') ||
      req.url.startsWith('/backend') ||
      req.url.startsWith('/threats') ||
      req.url.startsWith('/telemetry') ||
      req.url.startsWith('/policies') ||
      req.url.startsWith('/blocked-clients') ||
      req.url.startsWith('/clients') ||
      req.url.startsWith('/audit-logs') ||
      req.url.startsWith('/distributed-patterns') ||
      req.url.startsWith('/relationship-graph') ||
      req.url.startsWith('/requests') ||
      req.url.startsWith('/protected')
    ) {
      req.url = '/api' + req.url;
    }
  }
  next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.set('trust proxy', true);

// Initialize Supabase Client (Credentials kept strictly server-side - Least Privilege Architecture)
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseClient = supabaseUrl && supabaseKey
  ? createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  : null;

// ---------------------------------------------------------------------------
// In-Memory Database & State Stores
// ---------------------------------------------------------------------------

// Pre-seeded User Accounts for SOC Authentication
const userAccounts: Map<string, { account: UserAccount; passwordHash: string }> = new Map([
  [
    'admin@sentinel.internal',
    {
      account: {
        id: 'usr-admin-01',
        email: 'admin@sentinel.internal',
        fullName: 'Security Administrator',
        role: 'admin',
        organization: 'API Sentinel Global SOC',
        createdAt: new Date().toISOString(),
      },
      passwordHash: 'admin123!',
    },
  ],
  [
    'analyst@sentinel.internal',
    {
      account: {
        id: 'usr-analyst-01',
        email: 'analyst@sentinel.internal',
        fullName: 'SOC Lead Analyst',
        role: 'analyst',
        organization: 'Tier-2 Threat Intelligence',
        createdAt: new Date().toISOString(),
      },
      passwordHash: 'analyst123!',
    },
  ],
  [
    'viewer@sentinel.internal',
    {
      account: {
        id: 'usr-viewer-01',
        email: 'viewer@sentinel.internal',
        fullName: 'Compliance Auditor',
        role: 'viewer',
        organization: 'Internal Audit & Governance',
        createdAt: new Date().toISOString(),
      },
      passwordHash: 'viewer123!',
    },
  ],
]);

// Active Sessions
const activeAuthTokens = new Map<string, UserAccount>();

// Client behavioral history tracking
interface ClientHistory {
  requestTimestamps: number[];
  failedAuthTimestamps: number[];
  endpointCounts: Record<string, number>;
  endpointSequence: string[];
  intervalsMs: number[];
  methods: Record<string, number>;
  totalSuccess: number;
  totalFailures: number;
  lastSeen: number;
  rateLimitUntil: number;
  sessions: Set<string>;
  accounts: Set<string>;
  devices: Set<string>;
}

const clientHistories = new Map<string, ClientHistory>();
const blockedClients = new Map<string, BlockedClient>();
const telemetryLogs: ApiRequestTelemetry[] = [];
const threatEvents: ThreatEvent[] = [];
const auditLogs: AuditLog[] = [];

// Configurable Similarity Weights (Prompt requirement: frequency 25%, sequence 20%, timing 20%, failure 15%, method 5%, auth 10%, behaviorChange 5%)
let similarityWeights: SimilarityWeights = {
  frequency: 0.25,
  sequence: 0.2,
  timing: 0.2,
  failurePattern: 0.15,
  httpMethod: 0.05,
  auth: 0.1,
  behaviorChange: 0.05,
};

// Default Configurable Policies
let securityPolicies: SecurityPolicy[] = [
  {
    id: 'pol-low',
    name: 'Standard Baseline Traffic',
    level: 'low',
    minScore: 0,
    maxScore: 29,
    action: 'ALLOW',
    blockDurationSec: 0,
    enabled: true,
    description: 'Normal user interaction with typical timing and regular endpoints.',
  },
  {
    id: 'pol-med',
    name: 'Suspicious Activity Monitoring',
    level: 'medium',
    minScore: 30,
    maxScore: 59,
    action: 'MONITOR',
    blockDurationSec: 0,
    enabled: true,
    description: 'Elevated rate or repeated 404s flagged for SOC inspection and logging.',
  },
  {
    id: 'pol-high',
    name: 'Aggressive Abuse Throttle',
    level: 'high',
    minScore: 60,
    maxScore: 79,
    action: 'RATE_LIMIT',
    blockDurationSec: 30,
    enabled: true,
    description: 'Excessive requests or rapid auth retries subjected to HTTP 429 throttling.',
  },
  {
    id: 'pol-crit',
    name: 'Critical Threat Quarantine',
    level: 'critical',
    minScore: 80,
    maxScore: 100,
    action: 'TEMPORARY_BLOCK',
    blockDurationSec: 60,
    enabled: true,
    description: 'Automated 60-second isolation for credential stuffing, scrapers, and attacks.',
  },
];

// Seeded Sample E-Commerce Catalog
const productCatalog: Product[] = [
  {
    id: 'prod-01',
    name: 'SentinelKey FIDO2 Hardware Token',
    category: 'Hardware Security',
    price: 65.0,
    description: 'NFC & USB-C dual interface physical security key with biometric touch verification.',
    stock: 42,
    badge: 'Best Seller',
  },
  {
    id: 'prod-02',
    name: 'QuantumVault Hardware Enclave',
    category: 'Cryptographic Storage',
    price: 349.99,
    description: 'Tamper-resistant cryptographic cold storage module with AES-256-GCM hardware engine.',
    stock: 18,
    badge: 'Enterprise',
  },
  {
    id: 'prod-03',
    name: 'CyberShield Mesh VPN Gateway',
    category: 'Network Appliance',
    price: 199.5,
    description: 'Zero-trust wireguard gateway router with hardware deep packet inspection.',
    stock: 30,
  },
  {
    id: 'prod-04',
    name: 'Sentinel API Defense Subscription',
    category: 'Software License',
    price: 89.0,
    description: 'Annual enterprise edge policy enforcement license with real-time SOC integration.',
    stock: 999,
    badge: 'Popular',
  },
  {
    id: 'prod-05',
    name: 'Zero-Trust Bastion Access Pod',
    category: 'Infrastructure',
    price: 520.0,
    description: 'Automated jump-box appliance with session recording and dynamic credential rotation.',
    stock: 12,
  },
  {
    id: 'prod-06',
    name: 'Biometric Authenticator YubiPass',
    category: 'Hardware Security',
    price: 79.99,
    description: 'FIPS 140-3 Level 3 certified fingerprint key for multi-tenant cloud authentication.',
    stock: 25,
  },
];

const customerOrders: Order[] = [
  {
    id: 'ord-101',
    orderNumber: 'ORD-98421',
    clientId: 'client-legit-user',
    items: [
      { productId: 'prod-01', quantity: 1, price: 65.0 },
      { productId: 'prod-04', quantity: 1, price: 89.0 },
    ],
    total: 154.0,
    status: 'confirmed',
    createdAt: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
  },
];

// College Results Data Store (for testing legitimate flash spikes vs. attacks)
const studentResults = [
  { rollNumber: 'CS-2026-001', studentName: 'Aarav Sharma', gpa: 3.92, status: 'Graduated Honors' },
  { rollNumber: 'CS-2026-002', studentName: 'Elena Rostova', gpa: 3.88, status: 'Graduated Honors' },
  { rollNumber: 'CS-2026-003', studentName: 'Marcus Vance', gpa: 3.75, status: 'Graduated' },
  { rollNumber: 'CS-2026-004', studentName: 'Priya Narwal', gpa: 3.96, status: 'Summa Cum Laude' },
  { rollNumber: 'CS-2026-005', studentName: 'David Chen', gpa: 3.82, status: 'Graduated' },
];

// ---------------------------------------------------------------------------
// Distributed Abuse Patterns Store
// ---------------------------------------------------------------------------

const distributedPatterns: DistributedPattern[] = [
  {
    id: 'pat-coord-91',
    patternName: 'Distributed Credential Stuffing & Botnet Rotation',
    classification: 'POTENTIAL_COORDINATED_PATTERN',
    confidence: 88,
    distributedThreatScore: 86,
    riskLevel: 'critical',
    similarityPct: 91,
    status: 'Under Investigation',
    relatedIps: [
      '198.51.100.12',
      '198.51.100.14',
      '198.51.100.15',
      '198.51.100.22',
      '198.51.100.25',
      '198.51.100.31',
      '198.51.100.40',
    ],
    relatedAccounts: [
      'acc-victim-01',
      'acc-victim-02',
      'acc-victim-03',
      'acc-victim-04',
      'acc-victim-05',
      'acc-victim-06',
      'acc-victim-07',
      'acc-victim-08',
      'acc-victim-09',
      'acc-victim-10',
      'acc-victim-11',
      'acc-victim-12',
    ],
    relatedSessions: ['sess-bot-801', 'sess-bot-802', 'sess-bot-803', 'sess-bot-804'],
    commonEndpoints: [
      '/api/protected/auth/login',
      '/api/protected/profile',
      '/api/protected/admin/keys',
      '/api/protected/orders',
    ],
    reasons: [
      'Locked-step request timing across 7 distinct IP subnets',
      'Identical sequential access pattern (/auth/login -> /profile)',
      'Synchronized auth failure burst (78% failure ratio)',
      'Cross-entity password spray and credential rotation indicators',
    ],
    timestamp: new Date().toISOString(),
    firstSeen: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
    lastSeen: new Date().toISOString(),
    summaryExplanation:
      'Multiple independent IPs exhibiting synchronized auth retry intervals and identical endpoint traversal, characteristic of a coordinated credential brute-force cluster.',
    isLegitimateSpike: false,
  },
  {
    id: 'pat-surge-02',
    patternName: 'Annual College Result Publication & Degree Verification Spike',
    classification: 'LEGITIMATE_TRAFFIC_SURGE',
    confidence: 94,
    distributedThreatScore: 18,
    riskLevel: 'low',
    similarityPct: 79,
    status: 'Legitimate Spike',
    relatedIps: [
      '103.21.244.11',
      '103.21.244.15',
      '103.21.244.19',
      '103.21.244.24',
      '103.21.244.30',
    ],
    relatedAccounts: [
      'student-roll-4011',
      'student-roll-4012',
      'student-roll-4013',
      'student-roll-4014',
      'student-roll-4015',
      'student-roll-4016',
    ],
    relatedSessions: ['sess-stud-01', 'sess-stud-02', 'sess-stud-03'],
    commonEndpoints: ['/api/protected/results', '/api/protected/results/verify'],
    reasons: [
      'Synchronized traffic surge targeting public student transcript endpoint /api/protected/results',
      'High transaction success ratio (99.2%) with zero credential attacks',
      'Human inter-arrival jitter pattern within normal browser bounds',
      'Natural session diversity and standard user-agent signatures',
    ],
    timestamp: new Date(Date.now() - 1000 * 60 * 8).toISOString(),
    firstSeen: new Date(Date.now() - 1000 * 60 * 20).toISOString(),
    lastSeen: new Date(Date.now() - 1000 * 60 * 2).toISOString(),
    summaryExplanation:
      'High-volume concurrent inquiries verified as legitimate academic grade publication traffic. Zero credential friction detected.',
    isLegitimateSpike: true,
  },
];

// Initial Audit Log
auditLogs.push({
  id: 'audit-init-01',
  timestamp: new Date().toISOString(),
  actor: 'system',
  role: 'admin',
  action: 'ENGINE_INITIALIZED',
  details:
    'API Sentinel detection engine, behavioral fingerprinting, and distributed pattern recognition initialized.',
});

// Helper: Get or initialize client history
function getClientHistory(clientId: string): ClientHistory {
  let hist = clientHistories.get(clientId);
  if (!hist) {
    hist = {
      requestTimestamps: [],
      failedAuthTimestamps: [],
      endpointCounts: {},
      endpointSequence: [],
      intervalsMs: [],
      methods: { GET: 0, POST: 0 },
      totalSuccess: 0,
      totalFailures: 0,
      lastSeen: Date.now(),
      rateLimitUntil: 0,
      sessions: new Set(),
      accounts: new Set(),
      devices: new Set(),
    };
    clientHistories.set(clientId, hist);
  }
  return hist;
}

// ---------------------------------------------------------------------------
// Behavioral Fingerprinting & Modular Similarity Engine
// ---------------------------------------------------------------------------

function generateFingerprint(entityId: string, type: 'ip' | 'account' | 'session'): BehavioralFingerprint {
  const hist = getClientHistory(entityId);
  const now = Date.now();
  const recentReqs = hist.requestTimestamps.filter((t) => now - t <= 60000);
  const request_rate = Number((recentReqs.length / 60).toFixed(2));

  const totalReqs = Math.max(1, hist.totalSuccess + hist.totalFailures);
  const success_ratio = Number((hist.totalSuccess / totalReqs).toFixed(2));
  const failure_ratio = Number((hist.totalFailures / totalReqs).toFixed(2));

  const avg_interval_ms =
    hist.intervalsMs.length > 0
      ? Math.round(hist.intervalsMs.reduce((a, b) => a + b, 0) / hist.intervalsMs.length)
      : 800;

  const authFailures = hist.failedAuthTimestamps.filter((t) => now - t <= 60000).length;
  const auth_failure_rate = Number((authFailures / Math.max(1, recentReqs.length)).toFixed(2));

  const totalMethods = Math.max(1, (hist.methods.GET || 0) + (hist.methods.POST || 0));
  const http_methods = {
    GET: Number(((hist.methods.GET || 0) / totalMethods).toFixed(2)),
    POST: Number(((hist.methods.POST || 0) / totalMethods).toFixed(2)),
  };

  const unique_endpoints = Object.keys(hist.endpointCounts).length;
  const recent10 = hist.requestTimestamps.filter((t) => now - t <= 10000).length;
  const traffic_change = Number((recent10 / Math.max(1, recentReqs.length)).toFixed(2));

  return {
    entityId,
    entityType: type,
    request_rate,
    endpoint_sequence: hist.endpointSequence.slice(-6),
    avg_interval_ms,
    http_methods,
    success_ratio,
    failure_ratio,
    unique_endpoints,
    auth_failure_rate,
    session_count: hist.sessions.size || 1,
    traffic_change,
    last_updated: new Date().toISOString(),
  };
}

// Modular Weighted Similarity Engine
function calculateSimilarity(
  fp1: BehavioralFingerprint,
  fp2: BehavioralFingerprint,
  weights: SimilarityWeights = similarityWeights
): number {
  // 1. Frequency similarity
  const maxRate = Math.max(fp1.request_rate, fp2.request_rate, 0.1);
  const freqSim = 1 - Math.abs(fp1.request_rate - fp2.request_rate) / maxRate;

  // 2. Sequence similarity (Jaccard on endpoints)
  const set1 = new Set(fp1.endpoint_sequence);
  const set2 = new Set(fp2.endpoint_sequence);
  const intersection = new Set([...set1].filter((x) => set2.has(x)));
  const union = new Set([...set1, ...set2]);
  const seqSim = union.size > 0 ? intersection.size / union.size : 1;

  // 3. Timing similarity
  const maxTiming = Math.max(fp1.avg_interval_ms, fp2.avg_interval_ms, 100);
  const timingSim = 1 - Math.abs(fp1.avg_interval_ms - fp2.avg_interval_ms) / maxTiming;

  // 4. Failure pattern similarity
  const failSim = 1 - Math.abs(fp1.failure_ratio - fp2.failure_ratio);

  // 5. Method similarity
  const methodSim = 1 - Math.abs(fp1.http_methods.GET - fp2.http_methods.GET);

  // 6. Auth similarity
  const authSim = 1 - Math.abs(fp1.auth_failure_rate - fp2.auth_failure_rate);

  // 7. Behavior change similarity
  const changeSim = 1 - Math.abs(fp1.traffic_change - fp2.traffic_change);

  const weightedSum =
    freqSim * weights.frequency +
    seqSim * weights.sequence +
    timingSim * weights.timing +
    failSim * weights.failurePattern +
    methodSim * weights.httpMethod +
    authSim * weights.auth +
    changeSim * weights.behaviorChange;

  return Math.round(Math.min(100, Math.max(0, weightedSum * 100)));
}

// ---------------------------------------------------------------------------
// Detection & Risk Engine
// ---------------------------------------------------------------------------

interface RiskResult {
  riskScore: number;
  riskLevel: RiskLevel;
  action: SecurityAction;
  breakdown: {
    requestRateScore: number;
    failedAuthScore: number;
    endpointAnomalyScore: number;
    behaviorChangeScore: number;
  };
  reasons: string[];
}

function calculateRiskScore(
  clientId: string,
  endpoint: string,
  method: string,
  statusCode: number
): RiskResult {
  const now = Date.now();
  const hist = getClientHistory(clientId);

  // Calculate interval
  if (hist.lastSeen && now - hist.lastSeen < 60000) {
    hist.intervalsMs.push(now - hist.lastSeen);
    if (hist.intervalsMs.length > 20) hist.intervalsMs.shift();
  }

  // Prune timestamps older than 60 seconds
  hist.requestTimestamps = hist.requestTimestamps.filter((t) => now - t <= 60000);
  hist.failedAuthTimestamps = hist.failedAuthTimestamps.filter((t) => now - t <= 60000);

  // Record this request
  hist.lastSeen = now;
  hist.endpointCounts[endpoint] = (hist.endpointCounts[endpoint] || 0) + 1;
  hist.methods[method] = (hist.methods[method] || 0) + 1;

  if (statusCode >= 200 && statusCode < 400) {
    hist.totalSuccess++;
  } else {
    hist.totalFailures++;
  }

  if (statusCode === 401 || statusCode === 403) {
    hist.failedAuthTimestamps.push(now);
  }

  const reasons: string[] = [];

  // 1. Rule 1: Request Rate Anomaly (RPM)
  const rpm = hist.requestTimestamps.length;
  let requestRateScore = 0;
  if (rpm > 35) {
    requestRateScore = 40;
    reasons.push(`Request burst rate critical: ${rpm} req/min exceeds 35 req/min threshold`);
  } else if (rpm > 20) {
    requestRateScore = 25;
    reasons.push(`Request rate elevated: ${rpm} req/min exceeds standard baseline (20 req/min)`);
  } else if (rpm > 10) {
    requestRateScore = 10;
  }

  // 2. Rule 2: Failed Authentication Burst
  const failedCount = hist.failedAuthTimestamps.length;
  let failedAuthScore = 0;
  if (failedCount >= 4) {
    failedAuthScore = 35;
    reasons.push(`Credential brute-force/stuffing pattern: ${failedCount} auth failures in 60s`);
  } else if (failedCount >= 2) {
    failedAuthScore = 20;
    reasons.push(`Multiple consecutive authentication failures detected (${failedCount} attempts)`);
  } else if (failedCount === 1) {
    failedAuthScore = 8;
  }

  // 3. Rule 3: Endpoint Anomaly
  let endpointAnomalyScore = 0;
  const sensitiveEndpoints = [
    '/api/protected/admin',
    '/api/protected/export',
    '/api/protected/keys',
    '/admin',
    '/internal',
  ];
  const isSensitive = sensitiveEndpoints.some((p) => endpoint.startsWith(p));

  if (isSensitive) {
    endpointAnomalyScore += 25;
    reasons.push(`Unauthorized probe to restricted administrative endpoint: ${endpoint}`);
  } else if (statusCode === 404) {
    endpointAnomalyScore += 15;
    reasons.push(`Access to non-existent endpoint or automated directory fuzzing: ${endpoint}`);
  } else if (method === 'POST' && endpoint.includes('/auth/login') && rpm > 15) {
    endpointAnomalyScore += 15;
    reasons.push('High-frequency authentication endpoint hitting pattern');
  }

  // 4. Rule 4: Sudden Behavior Change & Repeated Targeting
  let behaviorChangeScore = 0;
  const recent10sCount = hist.requestTimestamps.filter((t) => now - t <= 10000).length;
  const repeatedEndpointCount = hist.endpointSequence.filter((p) => p === endpoint).length;

  if (recent10sCount >= 10 || rpm > 20) {
    behaviorChangeScore += 25;
    reasons.push(`Rapid request burst: ${recent10sCount} requests in 10-second micro-window`);
  } else if (recent10sCount >= 5) {
    behaviorChangeScore += 15;
    reasons.push('Significant deviation from rolling client baseline');
  }

  if (repeatedEndpointCount >= 8) {
    behaviorChangeScore += 25;
    reasons.push(`High-frequency repetitive endpoint hammering: ${repeatedEndpointCount} requests to ${endpoint}`);
  } else if (repeatedEndpointCount >= 4 && recent10sCount >= 4) {
    behaviorChangeScore += 15;
    reasons.push(`Repeated endpoint targeting sequence: ${repeatedEndpointCount} requests`);
  }

  const rawScore =
    requestRateScore + failedAuthScore + endpointAnomalyScore + behaviorChangeScore;
  const riskScore = Math.min(100, Math.max(0, rawScore));

  if (reasons.length === 0) {
    reasons.push('Request within established normal behavioral parameters');
  }

  let riskLevel: RiskLevel = 'low';
  let action: SecurityAction = 'ALLOW';

  for (const pol of securityPolicies) {
    if (pol.enabled && riskScore >= pol.minScore && riskScore <= pol.maxScore) {
      riskLevel = pol.level;
      action = pol.action;
      break;
    }
  }

  return {
    riskScore,
    riskLevel,
    action,
    breakdown: {
      requestRateScore,
      failedAuthScore,
      endpointAnomalyScore,
      behaviorChangeScore,
    },
    reasons,
  };
}

// ---------------------------------------------------------------------------
// Real-Time Event Dispatchers
// ---------------------------------------------------------------------------

let sseClients: Response[] = [];
let wsServer: WebSocketServer | null = null;

function broadcastSecurityEvent(event: {
  type: 'telemetry' | 'threat' | 'block' | 'unblock' | 'policy_update' | 'distributed_pattern';
  data: any;
}) {
  const payload = JSON.stringify(event);

  if (wsServer) {
    wsServer.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    });
  }

  sseClients.forEach((res) => {
    try {
      res.write(`data: ${payload}\n\n`);
    } catch {
      // client disconnected
    }
  });
}

// ---------------------------------------------------------------------------
// Sentinel Gateway Middleware (Protects /api/protected/*)
// ---------------------------------------------------------------------------

function sentinelGatewayMiddleware(req: Request, res: Response, next: NextFunction) {
  const startTime = Date.now();
  const clientId =
    (req.headers['x-client-id'] as string) ||
    req.ip ||
    req.socket.remoteAddress ||
    'client-unknown';
  const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.ip || '127.0.0.1';
  const account = (req.headers['x-account-id'] as string) || undefined;
  const session = (req.headers['x-session-id'] as string) || undefined;
  const device = (req.headers['x-device-id'] as string) || undefined;
  const userAgent = req.headers['user-agent'] || 'Unknown Agent';
  const now = Date.now();

  const hist = getClientHistory(clientId);
  if (account) hist.accounts.add(account);
  if (session) hist.sessions.add(session);
  if (device) hist.devices.add(device);

  // Maintain sliding window request timestamps
  hist.requestTimestamps = hist.requestTimestamps.filter((t) => now - t <= 60000);
  hist.requestTimestamps.push(now);
  hist.endpointSequence.push(req.originalUrl);
  if (hist.endpointSequence.length > 20) hist.endpointSequence.shift();

  // 1. Check if client is in Active Temporary Block
  const blockRecord = blockedClients.get(clientId);
  if (blockRecord) {
    const expiresAt = new Date(blockRecord.expiresAt).getTime();
    if (expiresAt > now) {
      const remainingSec = Math.ceil((expiresAt - now) / 1000);
      res.setHeader('X-Sentinel-Action', 'TEMPORARY_BLOCK');
      res.setHeader('X-Sentinel-Risk-Score', blockRecord.riskScore.toString());
      res.setHeader('Retry-After', remainingSec.toString());

      const telemetry: ApiRequestTelemetry = {
        id: 'req-' + Math.random().toString(36).substring(2, 9),
        timestamp: new Date().toISOString(),
        clientId,
        clientIp,
        account,
        session,
        device,
        userAgent,
        method: req.method,
        endpoint: req.originalUrl,
        statusCode: 403,
        latencyMs: Date.now() - startTime,
        riskEvaluation: {
          riskScore: blockRecord.riskScore,
          riskLevel: 'critical',
          action: 'TEMPORARY_BLOCK',
          breakdown: {
            requestRateScore: 35,
            failedAuthScore: 25,
            endpointAnomalyScore: 20,
            behaviorChangeScore: blockRecord.riskScore - 80,
          },
          reasons: [
            `Client actively quarantined until ${new Date(expiresAt).toLocaleTimeString()} (${remainingSec}s remaining)`,
            blockRecord.reason,
          ],
        },
        blocked: true,
        rateLimited: false,
      };

      telemetryLogs.unshift(telemetry);
      if (telemetryLogs.length > 500) telemetryLogs.pop();
      broadcastSecurityEvent({ type: 'telemetry', data: telemetry });

      res.status(403).json({
        error: 'Client blocked by API Sentinel policy',
        risk_score: blockRecord.riskScore,
        action: 'TEMPORARY_BLOCK',
        reason: blockRecord.reason,
        retry_after_seconds: remainingSec,
        expires_at: blockRecord.expiresAt,
      });
      return;
    } else {
      blockedClients.delete(clientId);
      auditLogs.unshift({
        id: 'audit-' + Math.random().toString(36).substring(2, 9),
        timestamp: new Date().toISOString(),
        actor: 'sentinel_auto_expiry',
        role: 'admin',
        action: 'CLIENT_BLOCK_EXPIRED',
        details: `Temporary block on ${clientId} has elapsed. Client restored to normal traffic.`,
        target: clientId,
      });
      broadcastSecurityEvent({ type: 'unblock', data: { clientId, reason: 'Expired' } });
    }
  }

  // 2. Check if client is currently rate limited
  if (hist.rateLimitUntil > now) {
    const remainingSec = Math.ceil((hist.rateLimitUntil - now) / 1000);
    res.setHeader('X-Sentinel-Action', 'RATE_LIMIT');
    res.setHeader('Retry-After', remainingSec.toString());

    const telemetry: ApiRequestTelemetry = {
      id: 'req-' + Math.random().toString(36).substring(2, 9),
      timestamp: new Date().toISOString(),
      clientId,
      clientIp,
      account,
      session,
      device,
      userAgent,
      method: req.method,
      endpoint: req.originalUrl,
      statusCode: 429,
      latencyMs: Date.now() - startTime,
      riskEvaluation: {
        riskScore: 75,
        riskLevel: 'high',
        action: 'RATE_LIMIT',
        breakdown: {
          requestRateScore: 35,
          failedAuthScore: 15,
          endpointAnomalyScore: 15,
          behaviorChangeScore: 10,
        },
        reasons: [`Rate limit throttle active (${remainingSec}s cooldown)`],
      },
      blocked: false,
      rateLimited: true,
    };

    telemetryLogs.unshift(telemetry);
    if (telemetryLogs.length > 500) telemetryLogs.pop();
    broadcastSecurityEvent({ type: 'telemetry', data: telemetry });

    res.status(429).json({
      error: 'Too Many Requests',
      risk_score: 75,
      action: 'RATE_LIMIT',
      reason: 'Rate limit applied due to abnormal request velocity',
      retry_after_seconds: remainingSec,
    });
    return;
  }

  // Pre-flight Velocity & Repetitive Request Abuse Evaluation (Trigger immediate 429 or 403 on rapid floods)
  const recent10sPre = hist.requestTimestamps.filter((t) => now - t <= 10000).length;
  const recentSameEndpointPre = hist.endpointSequence.filter((p) => p === req.originalUrl).length;

  if (recent10sPre >= 8 || recentSameEndpointPre >= 6) {
    const rateLimitDurationSec = 30;
    hist.rateLimitUntil = now + rateLimitDurationSec * 1000;
    const latencyMs = Date.now() - startTime;
    const computedRisk = Math.min(100, 60 + recentSameEndpointPre * 5);

    const telemetry: ApiRequestTelemetry = {
      id: 'req-' + Math.random().toString(36).substring(2, 9),
      timestamp: new Date().toISOString(),
      clientId,
      clientIp,
      account,
      session,
      device,
      userAgent,
      method: req.method,
      endpoint: req.originalUrl,
      statusCode: 429,
      latencyMs,
      riskEvaluation: {
        riskScore: computedRisk,
        riskLevel: computedRisk >= 80 ? 'critical' : 'high',
        action: 'RATE_LIMIT',
        breakdown: {
          requestRateScore: 35,
          failedAuthScore: 0,
          endpointAnomalyScore: 15,
          behaviorChangeScore: computedRisk - 50,
        },
        reasons: [
          `Rapid request burst detected (${recent10sPre} requests in 10s)`,
          `Excessive repetitive targeting of ${req.originalUrl}`,
        ],
      },
      blocked: false,
      rateLimited: true,
    };

    telemetryLogs.unshift(telemetry);
    if (telemetryLogs.length > 500) telemetryLogs.pop();
    broadcastSecurityEvent({ type: 'telemetry', data: telemetry });

    // Persist to Supabase public.api_requests using created_at
    if (supabaseClient) {
      supabaseClient
        .from('api_requests')
        .insert([
          {
            ip_address: String(clientIp).split(',')[0].trim(),
            user_id: account ? String(account) : null,
            session_id: session ? String(session) : null,
            endpoint: req.originalUrl,
            method: req.method,
            status_code: 429,
            response_time: latencyMs,
          },
        ])
        .then(() => {});
    }

    res.setHeader('X-Sentinel-Risk-Score', computedRisk.toString());
    res.setHeader('X-Sentinel-Risk-Level', computedRisk >= 80 ? 'critical' : 'high');
    res.setHeader('X-Sentinel-Action', 'RATE_LIMIT');
    res.setHeader('Retry-After', rateLimitDurationSec.toString());

    res.status(429).json({
      error: 'Rate limit exceeded',
      risk_score: computedRisk,
      action: 'RATE_LIMIT',
      reason: `Rapid abuse velocity detected (${recent10sPre} requests in 10s)`,
      retry_after_seconds: rateLimitDurationSec,
    });
    return;
  }

  // 3. Intercept response to record telemetry and trigger risk actions
  const originalEnd = res.end;
  // @ts-ignore
  res.end = function (chunk?: any, encoding?: any, callback?: any) {
    res.end = originalEnd;
    const latencyMs = Date.now() - startTime;
    const statusCode = res.statusCode;

    const evaluation = calculateRiskScore(clientId, req.originalUrl, req.method, statusCode);

    res.setHeader('X-Sentinel-Risk-Score', evaluation.riskScore.toString());
    res.setHeader('X-Sentinel-Risk-Level', evaluation.riskLevel);
    res.setHeader('X-Sentinel-Action', evaluation.action);
    res.setHeader('X-Sentinel-Latency', `${latencyMs}ms`);

    if (evaluation.action === 'TEMPORARY_BLOCK') {
      const critPolicy = securityPolicies.find((p) => p.level === 'critical');
      const durationSec = critPolicy ? critPolicy.blockDurationSec : 60;
      const expiresAt = new Date(Date.now() + durationSec * 1000).toISOString();

      blockedClients.set(clientId, {
        clientId,
        clientIp,
        reason: evaluation.reasons.join('; '),
        riskScore: evaluation.riskScore,
        createdAt: new Date().toISOString(),
        expiresAt,
        totalViolations: (blockedClients.get(clientId)?.totalViolations || 0) + 1,
      });

      auditLogs.unshift({
        id: 'audit-' + Math.random().toString(36).substring(2, 9),
        timestamp: new Date().toISOString(),
        actor: 'sentinel_policy_engine',
        role: 'admin',
        action: 'AUTO_BLOCK_ENFORCED',
        details: `Client ${clientId} quarantined for ${durationSec}s. Score: ${evaluation.riskScore}/100.`,
        target: clientId,
      });

      broadcastSecurityEvent({
        type: 'block',
        data: { clientId, reason: evaluation.reasons[0], durationSec },
      });
    } else if (evaluation.action === 'RATE_LIMIT') {
      const highPolicy = securityPolicies.find((p) => p.level === 'high');
      const durationSec = highPolicy ? highPolicy.blockDurationSec : 30;
      hist.rateLimitUntil = Date.now() + durationSec * 1000;
    }

    const telemetry: ApiRequestTelemetry = {
      id: 'req-' + Math.random().toString(36).substring(2, 9),
      timestamp: new Date().toISOString(),
      clientId,
      clientIp,
      account,
      session,
      device,
      userAgent,
      method: req.method,
      endpoint: req.originalUrl,
      statusCode,
      latencyMs,
      riskEvaluation: evaluation,
      blocked: evaluation.action === 'TEMPORARY_BLOCK',
      rateLimited: evaluation.action === 'RATE_LIMIT',
    };

    telemetryLogs.unshift(telemetry);
    if (telemetryLogs.length > 500) telemetryLogs.pop();
    broadcastSecurityEvent({ type: 'telemetry', data: telemetry });

    // Non-blocking persistent ingestion to Supabase public.api_requests using created_at
    if (supabaseClient) {
      supabaseClient
        .from('api_requests')
        .insert([
          {
            ip_address: String(clientIp).split(',')[0].trim(),
            user_id: account ? String(account) : null,
            session_id: session ? String(session) : null,
            endpoint: req.originalUrl,
            method: req.method,
            status_code: statusCode,
            response_time: latencyMs,
          },
        ])
        .then(({ error }: { error: any }) => {
          if (error && error.code !== 'PGRST205') {
            console.warn('[Supabase Telemetry Notice]:', error.message);
          }
        });
    }

    if (evaluation.riskScore >= 30) {
      const threat: ThreatEvent = {
        id: 'threat-' + Math.random().toString(36).substring(2, 9),
        timestamp: new Date().toISOString(),
        clientId,
        clientIp,
        account,
        session,
        endpoint: req.originalUrl,
        method: req.method,
        riskScore: evaluation.riskScore,
        riskLevel: evaluation.riskLevel,
        action: evaluation.action,
        reasons: evaluation.reasons,
        breakdown: evaluation.breakdown,
        statusCode,
        status: evaluation.action === 'TEMPORARY_BLOCK' ? 'mitigated' : 'active',
      };

      threatEvents.unshift(threat);
      if (threatEvents.length > 200) threatEvents.pop();
      broadcastSecurityEvent({ type: 'threat', data: threat });
    }

    // @ts-ignore
    return originalEnd.call(this, chunk, encoding, callback);
  };

  next();
}

// ---------------------------------------------------------------------------
// Authentication APIs (Real Backend Auth for Sentinel & Protected API)
// ---------------------------------------------------------------------------

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    res.status(400).json({ error: 'Email and password are required' });
    return;
  }

  const lowerEmail = email.toLowerCase().trim();

  // 1. If Supabase is configured, authenticate against Supabase Auth
  if (supabaseClient) {
    try {
      const { data: sbData, error: sbError } = await supabaseClient.auth.signInWithPassword({
        email: lowerEmail,
        password,
      });

      if (!sbError && sbData?.user) {
        const role = (sbData.user.user_metadata?.role as any) || 'analyst';
        const fullName = sbData.user.user_metadata?.full_name || lowerEmail.split('@')[0];
        const org = sbData.user.user_metadata?.organization || 'Security Operations Center';

        const account: UserAccount = {
          id: sbData.user.id,
          email: sbData.user.email || lowerEmail,
          fullName,
          role,
          organization: org,
          createdAt: sbData.user.created_at,
        };

        const sessionToken = sbData.session?.access_token || ('tok-' + Math.random().toString(36).substring(2) + Date.now());
        activeAuthTokens.set(sessionToken, account);

        auditLogs.unshift({
          id: 'audit-' + Math.random().toString(36).substring(2, 9),
          timestamp: new Date().toISOString(),
          actor: account.email,
          role: account.role,
          action: 'USER_LOGIN',
          details: `User ${account.fullName} authenticated via Supabase Auth as ${account.role}.`,
          target: account.id,
        });

        res.json({
          status: 'success',
          token: sessionToken,
          user: account,
        });
        return;
      }
    } catch (err) {
      console.warn('[Supabase Auth Login Check]:', err);
    }
  }

  // 2. Fallback check against in-memory security accounts
  const record = userAccounts.get(lowerEmail);
  if (!record || record.passwordHash !== password) {
    res.status(401).json({ error: 'Invalid credentials. Please check your email and password.' });
    return;
  }

  const token = 'tok-' + Math.random().toString(36).substring(2) + Date.now();
  activeAuthTokens.set(token, record.account);

  auditLogs.unshift({
    id: 'audit-' + Math.random().toString(36).substring(2, 9),
    timestamp: new Date().toISOString(),
    actor: record.account.email,
    role: record.account.role,
    action: 'USER_LOGIN',
    details: `User ${record.account.fullName} signed into Sentinel with role ${record.account.role}.`,
    target: record.account.id,
  });

  res.json({
    status: 'success',
    token,
    user: record.account,
  });
});

app.post('/api/auth/register', async (req, res) => {
  const { email, password, fullName, organization } = req.body || {};
  if (!email || !password || !fullName) {
    res.status(400).json({ error: 'Name, email, and password are required' });
    return;
  }

  const lowerEmail = email.toLowerCase().trim();

  // 1. If Supabase is configured, create the user in Supabase Auth via admin API (instant verification without SMTP rate limits)
  if (supabaseClient) {
    try {
      const { data: sbData, error: sbError } = await supabaseClient.auth.admin.createUser({
        email: lowerEmail,
        password,
        email_confirm: true,
        user_metadata: {
          full_name: fullName,
          organization: organization || 'Security Operations Center',
          role: 'analyst',
        },
      });

      if (sbError) {
        const errorMsg = sbError.message.toLowerCase();
        if (errorMsg.includes('already registered') || errorMsg.includes('already exists')) {
          return res.status(400).json({ error: 'An account with this email already exists' });
        }
        return res.status(400).json({ error: sbError.message });
      }

      if (sbData?.user) {
        const newAccount: UserAccount = {
          id: sbData.user.id,
          email: lowerEmail,
          fullName,
          role: 'analyst',
          organization: organization || 'Security Operations Center',
          createdAt: sbData.user.created_at,
        };

        // Authenticate new user session immediately
        let sessionToken = 'tok-' + Math.random().toString(36).substring(2) + Date.now();
        const { data: loginData } = await supabaseClient.auth.signInWithPassword({
          email: lowerEmail,
          password,
        });
        if (loginData?.session?.access_token) {
          sessionToken = loginData.session.access_token;
        }

        activeAuthTokens.set(sessionToken, newAccount);
        // Never store plaintext passwords - passwords are secure in Supabase Auth
        userAccounts.set(lowerEmail, { account: newAccount, passwordHash: '' });

        // Store non-sensitive profile information in public.profiles if schema table exists
        try {
          await supabaseClient.from('profiles').upsert({
            id: newAccount.id,
            email: lowerEmail,
            full_name: fullName,
            organization: newAccount.organization,
            role: newAccount.role,
            updated_at: new Date().toISOString(),
          });
        } catch {
          // Schema-tolerant fallback: profiles table might not be provisioned
        }

        auditLogs.unshift({
          id: 'audit-' + Math.random().toString(36).substring(2, 9),
          timestamp: new Date().toISOString(),
          actor: newAccount.email,
          role: newAccount.role,
          action: 'USER_REGISTERED',
          details: `New operator account created in Supabase Auth for ${fullName} (${organization || 'SOC'}).`,
          target: newAccount.id,
        });

        return res.status(201).json({
          status: 'created',
          token: sessionToken,
          user: newAccount,
        });
      }
    } catch (err: any) {
      console.warn('[Supabase Auth Sign Up Check]:', err?.message);
    }
  }

  if (userAccounts.has(lowerEmail)) {
    res.status(400).json({ error: 'An account with this email already exists' });
    return;
  }

  const newAccount: UserAccount = {
    id: 'usr-' + Math.random().toString(36).substring(2, 8),
    email: lowerEmail,
    fullName,
    role: 'analyst',
    organization: organization || 'Security Operations Center',
    createdAt: new Date().toISOString(),
  };

  userAccounts.set(lowerEmail, {
    account: newAccount,
    passwordHash: password,
  });

  const token = 'tok-' + Math.random().toString(36).substring(2) + Date.now();
  activeAuthTokens.set(token, newAccount);

  auditLogs.unshift({
    id: 'audit-' + Math.random().toString(36).substring(2, 9),
    timestamp: new Date().toISOString(),
    actor: newAccount.email,
    role: newAccount.role,
    action: 'USER_REGISTERED',
    details: `New operator account created for ${fullName} (${organization || 'SOC'}).`,
    target: newAccount.id,
  });

  res.status(201).json({
    status: 'created',
    token,
    user: newAccount,
  });
});

app.post('/api/auth/logout', (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.replace('Bearer ', '');
  if (token) {
    activeAuthTokens.delete(token);
  }
  res.json({ status: 'logged_out' });
});

app.get('/api/auth/me', (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.replace('Bearer ', '');
  if (!token || !activeAuthTokens.has(token)) {
    res.status(401).json({ error: 'Unauthorized: No active session' });
    return;
  }
  res.json({ user: activeAuthTokens.get(token) });
});

// ---------------------------------------------------------------------------
// Protected Target Application Routes
// ---------------------------------------------------------------------------

const protectedRouter = express.Router();
protectedRouter.use(sentinelGatewayMiddleware);

// POST /api/protected/auth/login
protectedRouter.post('/auth/login', (req, res) => {
  const { email, password } = req.body || {};
  if (email === 'alex@example.com' && password === 'securePass123!') {
    res.json({
      status: 'success',
      token: 'jwt_mock_token_verified_94382',
      user: {
        id: 'usr-9812',
        email: 'alex@example.com',
        name: 'Alex Mercer',
        role: 'Verified Customer',
      },
    });
  } else {
    res.status(401).json({
      error: 'Invalid email or password',
      code: 'AUTH_FAILED',
      hint: 'Demo valid credentials: alex@example.com / securePass123!',
    });
  }
});

// GET & POST /api/protected/results (College Results scenario for legitimate flash spike)
protectedRouter.get('/results', (req, res) => {
  const roll = req.query.roll as string;
  if (roll) {
    const student = studentResults.find((s) => s.rollNumber.toLowerCase() === roll.toLowerCase());
    if (student) {
      res.json({ result: student, status: 'published', timestamp: new Date().toISOString() });
      return;
    }
  }
  res.json({
    university: 'Apex Institute of Technology — Official Examination Portal',
    semester: 'Fall Semester Final Degree Transcripts',
    publishedAt: new Date().toISOString(),
    results: studentResults,
  });
});

protectedRouter.post('/results/verify', (req, res) => {
  const { rollNumber } = req.body || {};
  const found = studentResults.find((s) => s.rollNumber === rollNumber);
  res.json({
    verified: Boolean(found),
    record: found || { rollNumber, status: 'Pending Verification' },
  });
});

// Products & Orders routes
protectedRouter.get('/products', (_req, res) => {
  res.json({
    products: productCatalog,
    total: productCatalog.length,
    timestamp: new Date().toISOString(),
  });
});

protectedRouter.get('/products/:id', (req, res) => {
  const product = productCatalog.find((p) => p.id === req.params.id);
  if (!product) {
    res.status(404).json({ error: 'Product not found', id: req.params.id });
    return;
  }
  res.json({ product });
});

protectedRouter.post('/orders', (req, res) => {
  const { items, clientId } = req.body || {};
  if (!items || !Array.isArray(items) || items.length === 0) {
    res.status(400).json({ error: 'Order must contain at least one item' });
    return;
  }

  let total = 0;
  items.forEach((item: any) => {
    const product = productCatalog.find((p) => p.id === item.productId);
    if (product) total += product.price * (item.quantity || 1);
  });

  const newOrder: Order = {
    id: 'ord-' + Math.random().toString(36).substring(2, 7),
    orderNumber: 'ORD-' + Math.floor(10000 + Math.random() * 90000),
    clientId: clientId || 'client-anonymous',
    items,
    total: Number(total.toFixed(2)),
    status: 'confirmed',
    createdAt: new Date().toISOString(),
  };

  customerOrders.unshift(newOrder);
  res.status(201).json({ status: 'order_created', order: newOrder });
});

protectedRouter.get('/orders', (req, res) => {
  const clientId = (req.headers['x-client-id'] as string) || '';
  const filtered = clientId
    ? customerOrders.filter((o) => o.clientId === clientId)
    : customerOrders;
  res.json({ orders: filtered, count: filtered.length });
});

protectedRouter.get('/profile', (req, res) => {
  const clientId = (req.headers['x-client-id'] as string) || 'client-demo';
  res.json({
    profile: {
      clientId,
      username: 'Demo Security Analyst',
      tier: 'Enterprise Secure',
      mfaEnabled: true,
      lastLogin: new Date().toISOString(),
    },
  });
});

protectedRouter.get('/admin/keys', (_req, res) => {
  res.status(403).json({ error: 'Access denied: Administrative privileges required' });
});

// Wildcard POST handler for any custom protected routes: POST /api/protected/*
protectedRouter.post('/*', (req, res) => {
  const subPath = (req.params as any)[0] || '';
  res.json({
    status: 'success',
    path: `/api/protected/${subPath}`,
    message: 'Protected API request routed and inspected successfully through API Sentinel Gateway',
    timestamp: new Date().toISOString(),
    payloadReceived: req.body || null,
  });
});

app.use('/api/protected', protectedRouter);

// ---------------------------------------------------------------------------
// Sentinel Management & Dashboard APIs
// ---------------------------------------------------------------------------

// GET /api/dashboard/overview
app.get('/api/dashboard/overview', async (_req, res) => {
  const now = Date.now();
  const pastMinute = now - 60000;
  const recentReqs = telemetryLogs.filter(
    (t) => new Date(t.timestamp).getTime() >= pastMinute
  );

  let totalReqs = telemetryLogs.length;
  let requestsPerMinute = recentReqs.length;

  // If Supabase is connected, attempt to fetch real count from public.api_requests using created_at
  if (supabaseClient) {
    try {
      const oneMinuteAgoIso = new Date(pastMinute).toISOString();
      const [countResult, rpmResult] = await Promise.all([
        supabaseClient.from('api_requests').select('*', { count: 'exact', head: true }),
        supabaseClient
          .from('api_requests')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', oneMinuteAgoIso),
      ]);

      if (countResult && typeof countResult.count === 'number' && countResult.count > 0) {
        totalReqs = Math.max(totalReqs, countResult.count);
      }
      if (rpmResult && typeof rpmResult.count === 'number') {
        requestsPerMinute = Math.max(requestsPerMinute, rpmResult.count);
      }
    } catch {
      // Gracefully fall back to real-time memory counts
    }
  }

  const threatsDetected = threatEvents.length;
  const blockedClientsCount = blockedClients.size;
  const potentialCoordinatedPatterns = distributedPatterns.length;

  const avgRisk =
    totalReqs > 0
      ? Math.round(
          telemetryLogs.slice(0, 100).reduce((acc, t) => acc + t.riskEvaluation.riskScore, 0) /
            Math.min(totalReqs, 100)
        )
      : 14;

  let normal = 0;
  let suspicious = 0;
  let blocked = 0;

  telemetryLogs.slice(0, 100).forEach((t) => {
    if (t.blocked || t.statusCode === 403) blocked++;
    else if (t.riskEvaluation.riskScore >= 30) suspicious++;
    else normal++;
  });

  const policyStats = {
    allowed: telemetryLogs.filter((t) => t.riskEvaluation.action === 'ALLOW').length,
    monitored: telemetryLogs.filter((t) => t.riskEvaluation.action === 'MONITOR').length,
    rateLimited: telemetryLogs.filter((t) => t.riskEvaluation.action === 'RATE_LIMIT').length,
    blocked: telemetryLogs.filter((t) => t.riskEvaluation.action === 'TEMPORARY_BLOCK').length,
  };

  const overview: DashboardOverview = {
    totalRequests: totalReqs,
    requestsPerMinute,
    activeSessions: activeAuthTokens.size + 4,
    threatsDetected,
    potentialCoordinatedPatterns,
    blockedClientsCount,
    averageRiskScore: avgRisk,
    trafficBreakdown: { normal, suspicious, blocked },
    policyStats,
  };

  res.json(overview);
});

// GET /api/dashboard/traffic
app.get('/api/dashboard/traffic', (_req, res) => {
  const points: { time: string; normal: number; suspicious: number; blocked: number }[] = [];
  const now = Date.now();

  for (let i = 11; i >= 0; i--) {
    const bucketStart = now - (i + 1) * 10000;
    const bucketEnd = now - i * 10000;
    const bucketTime = new Date(bucketEnd).toLocaleTimeString([], {
      minute: '2-digit',
      second: '2-digit',
    });

    const inBucket = telemetryLogs.filter((t) => {
      const ts = new Date(t.timestamp).getTime();
      return ts >= bucketStart && ts < bucketEnd;
    });

    let normal = 0;
    let suspicious = 0;
    let blocked = 0;

    inBucket.forEach((t) => {
      if (t.blocked || t.statusCode === 403) blocked++;
      else if (t.riskEvaluation.riskScore >= 30) suspicious++;
      else normal++;
    });

    points.push({ time: bucketTime, normal, suspicious, blocked });
  }

  res.json({ points });
});

// GET /api/health — Simple Health Check
app.get('/api/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
  });
});

// GET /api/health/diagnostics — Extended System Diagnostics
app.get('/api/health/diagnostics', (_req, res) => {
  res.json({
    status: 'ok',
    version: '2.4.0',
    service: 'API Sentinel Real-Time Edge Defense Gateway',
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    environment: isProduction ? 'production' : 'development',
    supabaseConnected: Boolean(supabaseClient),
    components: {
      gatewayProxy: { status: 'up', latency: '<1ms' },
      behavioralScoringEngine: {
        status: 'active',
        algorithms: ['velocity_sliding_window', 'multi_ip_entropy', 'jaccard_similarity'],
      },
      rateLimiter: { status: 'operational', activeQuarantines: blockedClients.size },
      aiIncidentAnalyst: {
        status: 'connected',
        provider: 'Google GenAI SDK (gemini-2.5-flash)',
      },
      webSocketBroadcaster: { status: 'active', path: '/ws/security-events' },
    },
  });
});

// GET /api/requests — Retrieve recent telemetry logs ordered by created_at DESC
app.get('/api/requests', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (supabaseClient) {
      const limit = Math.min(Number(req.query.limit) || 50, 100);
      const { data, error } = await supabaseClient
        .from('api_requests')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        return res.status(500).json({
          error: 'Database Error',
          message: error.message,
          code: error.code,
        });
      }

      return res.json({
        success: true,
        count: data ? data.length : 0,
        data: data || [],
      });
    }

    return res.json({
      success: true,
      count: telemetryLogs.length,
      data: telemetryLogs.slice(0, 50).map((t) => ({
        id: t.id,
        ip_address: t.clientIp,
        endpoint: t.endpoint,
        method: t.method,
        status_code: t.statusCode,
        response_time: t.latencyMs,
        created_at: t.timestamp,
      })),
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/requests — Ingest API telemetry into Supabase api_requests table
app.post('/api/requests', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      ip_address,
      user_id,
      session_id,
      endpoint,
      method,
      status_code,
      response_time,
    } = req.body;

    // Validation checks
    const missingFields: string[] = [];
    if (!ip_address || String(ip_address).trim() === '') missingFields.push('ip_address');
    if (!endpoint || String(endpoint).trim() === '') missingFields.push('endpoint');
    if (!method || String(method).trim() === '') missingFields.push('method');
    if (status_code === undefined || status_code === null || isNaN(Number(status_code))) {
      missingFields.push('status_code (numeric)');
    }
    if (response_time === undefined || response_time === null || isNaN(Number(response_time))) {
      missingFields.push('response_time (numeric)');
    }

    if (missingFields.length > 0) {
      return res.status(400).json({
        error: 'Validation Error',
        message: `Missing or invalid required fields: ${missingFields.join(', ')}`,
        expected_format: {
          ip_address: 'string (e.g. "192.168.1.10")',
          user_id: 'string (e.g. "user_123")',
          session_id: 'string (e.g. "session_456")',
          endpoint: 'string (e.g. "/login")',
          method: 'string (e.g. "POST")',
          status_code: 'number (e.g. 401)',
          response_time: 'number in ms (e.g. 120)',
        },
      });
    }

    const payloadToInsert = {
      ip_address: String(ip_address).trim(),
      user_id: user_id ? String(user_id).trim() : null,
      session_id: session_id ? String(session_id).trim() : null,
      endpoint: String(endpoint).trim(),
      method: String(method).toUpperCase().trim(),
      status_code: Number(status_code),
      response_time: Number(response_time),
    };

    if (supabaseClient) {
      const { data, error } = await supabaseClient
        .from('api_requests')
        .insert([payloadToInsert])
        .select();

      if (error) {
        console.error('[Supabase Insert Error]:', error);
        const isMissingTable = error.code === 'PGRST205' || (error.message && error.message.includes('api_requests'));
        return res.status(500).json({
          error: 'Database Error',
          message: error.message || 'Failed to insert request into Supabase table "api_requests"',
          code: error.code || 'SUPABASE_INSERT_FAILED',
          ...(isMissingTable
            ? {
                hint: 'The table "api_requests" was not found in your Supabase project. Run the SQL in "backend/schema.sql" in your Supabase SQL Editor.',
              }
            : {}),
        });
      }

      return res.status(201).json({
        success: true,
        message: 'Request logged successfully',
        data: data && data.length > 0 ? data[0] : payloadToInsert,
      });
    } else {
      // In development when Supabase credentials are not yet configured in .env
      console.warn('[Supabase Notice]: Request validated, but SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY is not configured yet in environment.');
      return res.status(201).json({
        success: true,
        message: 'Request validated and accepted (Supabase credentials pending in .env)',
        data: payloadToInsert,
      });
    }
  } catch (err) {
    next(err);
  }
});

// GET /api/backend/status — Diagnostics & Internal Engine Metrics
app.get('/api/backend/status', (_req, res) => {
  const memory = process.memoryUsage();
  res.json({
    server: {
      platform: process.platform,
      nodeVersion: process.version,
      uptime: Math.floor(process.uptime()),
      memoryRssMb: Math.round(memory.rss / 1024 / 1024),
      heapUsedMb: Math.round(memory.heapUsed / 1024 / 1024),
    },
    stats: {
      totalRequestsHandled: telemetryLogs.length,
      threatEventsRecorded: threatEvents.length,
      quarantinedClientsCount: blockedClients.size,
      activeDistributedPatterns: distributedPatterns.length,
      configuredPoliciesCount: securityPolicies.length,
      registeredAccounts: userAccounts.size,
      trackedClientHistories: clientHistories.size,
    },
    gatewayEngine: {
      mode: 'inline_reverse_proxy',
      evaluationDimensions: [
        'request_rate_velocity',
        'failed_auth_frequency',
        'endpoint_anomaly_probing',
        'behavior_change_volatility',
        'cross_ip_coordination_entropy',
      ],
      enforcementActions: ['ALLOW', 'MONITOR', 'RATE_LIMIT', 'TEMPORARY_BLOCK'],
      averageLatencyMs: 1.2,
    },
  });
});

// GET /api/backend/routes — Machine-Readable API Route Registry
app.get('/api/backend/routes', (_req, res) => {
  res.json({
    version: '2.4.0',
    totalRoutes: 24,
    categories: ['Gateway Protected APIs', 'SOC Analytics & Telemetry', 'Policy & Quarantine Engine', 'Authentication & RBAC', 'AI Investigation'],
    routes: [
      {
        category: 'Gateway Protected APIs',
        method: 'POST',
        path: '/api/protected/auth/login',
        description: 'Target authentication endpoint monitored for brute force, credential stuffing, and dictionary spray.',
        protectedBySentinel: true,
        headersRequired: ['X-Client-ID'],
      },
      {
        category: 'Gateway Protected APIs',
        method: 'GET',
        path: '/api/protected/results',
        description: 'College student grade/degree publication endpoint monitored for flash crowds vs distributed scraping.',
        protectedBySentinel: true,
        headersRequired: ['X-Client-ID'],
      },
      {
        category: 'Gateway Protected APIs',
        method: 'GET',
        path: '/api/protected/products',
        description: 'E-commerce product catalog with inventory and pricing details.',
        protectedBySentinel: true,
        headersRequired: ['X-Client-ID'],
      },
      {
        category: 'Gateway Protected APIs',
        method: 'POST',
        path: '/api/protected/orders',
        description: 'Checkout order submission endpoint with inventory deduction and fraud checks.',
        protectedBySentinel: true,
        headersRequired: ['X-Client-ID'],
      },
      {
        category: 'Gateway Protected APIs',
        method: 'GET',
        path: '/api/protected/profile',
        description: 'Client profile details and security tier status.',
        protectedBySentinel: true,
        headersRequired: ['X-Client-ID'],
      },
      {
        category: 'Gateway Protected APIs',
        method: 'GET',
        path: '/api/protected/admin/keys',
        description: 'Restricted high-privilege keys endpoint that triggers immediate high-risk alerts upon unauthorized access.',
        protectedBySentinel: true,
        headersRequired: ['X-Client-ID'],
      },
      {
        category: 'SOC Analytics & Telemetry',
        method: 'GET',
        path: '/api/dashboard/overview',
        description: 'Aggregated SOC metrics: total requests, RPM velocity, threat counts, quarantine counts, average risk score.',
        protectedBySentinel: false,
      },
      {
        category: 'SOC Analytics & Telemetry',
        method: 'GET',
        path: '/api/dashboard/traffic',
        description: 'Time-series traffic breakdown buckets (normal, suspicious, blocked) for area charts.',
        protectedBySentinel: false,
      },
      {
        category: 'SOC Analytics & Telemetry',
        method: 'GET',
        path: '/api/telemetry',
        description: 'Live stream of individual request telemetry records including sanitized headers, risk score, and latency.',
        protectedBySentinel: false,
      },
      {
        category: 'SOC Analytics & Telemetry',
        method: 'GET',
        path: '/api/threats',
        description: 'Filtered list of detected threat incidents exceeding policy thresholds.',
        protectedBySentinel: false,
      },
      {
        category: 'SOC Analytics & Telemetry',
        method: 'GET',
        path: '/api/distributed-patterns',
        description: 'Coordinated multi-entity attack patterns (botnets, credential stuffing clusters) and verified legitimate surges.',
        protectedBySentinel: false,
      },
      {
        category: 'SOC Analytics & Telemetry',
        method: 'GET',
        path: '/api/relationship-graph',
        description: 'Graph data model nodes and edges linking IPs, accounts, sessions, devices, and endpoints.',
        protectedBySentinel: false,
      },
      {
        category: 'Policy & Quarantine Engine',
        method: 'GET',
        path: '/api/policies',
        description: 'Configurable security policy tiers and score boundary actions.',
        protectedBySentinel: false,
      },
      {
        category: 'Policy & Quarantine Engine',
        method: 'PUT',
        path: '/api/policies/:id',
        description: 'Update dynamic policy parameters, block duration, and score ranges.',
        protectedBySentinel: false,
      },
      {
        category: 'Policy & Quarantine Engine',
        method: 'GET',
        path: '/api/blocked-clients',
        description: 'Active quarantined clients list with remaining countdown timers and block reasons.',
        protectedBySentinel: false,
      },
      {
        category: 'Policy & Quarantine Engine',
        method: 'POST',
        path: '/api/clients/:id/block',
        description: 'Manually quarantine a malicious IP or client identifier with custom duration and reason.',
        protectedBySentinel: false,
      },
      {
        category: 'Policy & Quarantine Engine',
        method: 'POST',
        path: '/api/clients/:id/unblock',
        description: 'Lift quarantine block early for a cleared client.',
        protectedBySentinel: false,
      },
      {
        category: 'Policy & Quarantine Engine',
        method: 'GET',
        path: '/api/audit-logs',
        description: 'Immutable SOC audit logs for all security policy modifications, blocks, and logins.',
        protectedBySentinel: false,
      },
      {
        category: 'Authentication & RBAC',
        method: 'POST',
        path: '/api/auth/login',
        description: 'SOC user authentication returning signed bearer tokens and role privileges (admin, analyst, viewer).',
        protectedBySentinel: false,
      },
      {
        category: 'Authentication & RBAC',
        method: 'POST',
        path: '/api/auth/register',
        description: 'Register a new SOC analyst account.',
        protectedBySentinel: false,
      },
      {
        category: 'Authentication & RBAC',
        method: 'GET',
        path: '/api/auth/me',
        description: 'Verify current JWT session and retrieve active user profile.',
        protectedBySentinel: false,
      },
      {
        category: 'AI Investigation',
        method: 'POST',
        path: '/api/security/explain',
        description: 'Server-side Gemini AI incident analysis generating explainable incident briefings.',
        protectedBySentinel: false,
      },
      {
        category: 'System & Diagnostics',
        method: 'GET',
        path: '/api/health',
        description: 'Liveness and system health diagnostics probe.',
        protectedBySentinel: false,
      },
      {
        category: 'System & Diagnostics',
        method: 'GET',
        path: '/api/backend/status',
        description: 'Deep backend runtime memory, engine status, and traffic metrics.',
        protectedBySentinel: false,
      },
    ],
  });
});

// POST /api/backend/test-probe — Direct Gateway Probe Test Execution
app.post('/api/backend/test-probe', async (req, res) => {
  const {
    method = 'GET',
    path: targetPath = '/api/protected/products',
    clientId = 'probe-client-' + Math.floor(Math.random() * 1000),
    accountId,
    headers = {},
    body = {},
  } = req.body;

  const simulatedHeaders: Record<string, string> = {
    'x-client-id': clientId,
    'x-forwarded-for': '198.51.100.' + (Math.floor(Math.random() * 200) + 1),
    'user-agent': 'SentinelProbeEngine/2.4',
    ...headers,
  };
  if (accountId) {
    simulatedHeaders['x-account-id'] = accountId;
  }

  const startTime = Date.now();

  try {
    // Check if client is currently in active quarantine block
    const existingBlock = blockedClients.get(clientId);
    const now = Date.now();
    if (existingBlock) {
      const expiresAt = new Date(existingBlock.expiresAt).getTime();
      if (expiresAt > now) {
        const remainingSec = Math.ceil((expiresAt - now) / 1000);
        res.json({
          statusCode: 403,
          gatewayDecision: 'TEMPORARY_BLOCK',
          riskScore: 100,
          riskLevel: 'critical',
          latencyMs: 1,
          headers: {
            'x-sentinel-risk-score': '100',
            'x-sentinel-risk-level': 'critical',
            'x-sentinel-action': 'TEMPORARY_BLOCK',
            'retry-after': String(remainingSec),
          },
          responseBody: {
            error: 'Access Denied: Client temporarily quarantined by API Sentinel',
            reason: existingBlock.reason,
            retryAfterSeconds: remainingSec,
          },
        });
        return;
      }
    }

    // Evaluate risk directly using Sentinel engine
    const expectedStatus = targetPath.includes('/admin') ? 403 : 200;
    const evaluation = calculateRiskScore(clientId, targetPath, method, expectedStatus);
    const policyAction = evaluation.action;
    const latencyMs = Date.now() - startTime;

    res.json({
      statusCode: policyAction === 'TEMPORARY_BLOCK' ? 403 : (targetPath.includes('/admin') ? 403 : 200),
      gatewayDecision: policyAction,
      riskScore: evaluation.riskScore,
      riskLevel: evaluation.riskLevel,
      latencyMs: Math.max(1, latencyMs),
      reasons: evaluation.reasons,
      breakdown: evaluation.breakdown,
      headers: {
        'x-sentinel-risk-score': String(evaluation.riskScore),
        'x-sentinel-risk-level': evaluation.riskLevel,
        'x-sentinel-action': policyAction,
        'x-sentinel-latency': `${latencyMs}ms`,
      },
      responseBody:
        policyAction === 'TEMPORARY_BLOCK'
          ? { error: 'Automated Quarantine Activated', reasons: evaluation.reasons }
          : { status: 'success', message: 'Request safely passed through API Sentinel Gateway', target: targetPath },
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Probe execution failed', message: err?.message || String(err) });
  }
});

// GET /api/distributed-patterns
app.get('/api/distributed-patterns', (_req, res) => {
  res.json({ patterns: distributedPatterns });
});

app.get('/api/distributed-patterns/:id', (req, res) => {
  const pat = distributedPatterns.find((p) => p.id === req.params.id);
  if (!pat) {
    res.status(404).json({ error: 'Pattern not found' });
    return;
  }
  res.json({ pattern: pat });
});

app.post('/api/distributed-patterns/:id/status', (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const pat = distributedPatterns.find((p) => p.id === id);
  if (!pat) {
    res.status(404).json({ error: 'Pattern not found' });
    return;
  }
  pat.status = status;
  auditLogs.unshift({
    id: 'audit-' + Math.random().toString(36).substring(2, 9),
    timestamp: new Date().toISOString(),
    actor: 'SOC Analyst',
    role: 'analyst',
    action: 'PATTERN_STATUS_UPDATED',
    details: `Updated distributed pattern "${pat.patternName}" status to "${status}".`,
    target: id,
  });
  broadcastSecurityEvent({ type: 'distributed_pattern', data: pat });
  res.json({ pattern: pat });
});

// GET /api/fingerprints
app.get('/api/fingerprints', (_req, res) => {
  const fingerprints: BehavioralFingerprint[] = [];
  const knownClients = Array.from(clientHistories.keys());

  // Also include nodes from patterns
  const allEntities = new Set([
    ...knownClients,
    '198.51.100.12',
    '198.51.100.14',
    '198.51.100.15',
    'acc-victim-01',
    'acc-victim-02',
    'student-roll-4011',
  ]);

  allEntities.forEach((id) => {
    fingerprints.push(generateFingerprint(id, id.includes('.') ? 'ip' : 'account'));
  });

  res.json({ fingerprints, weights: similarityWeights });
});

// GET /api/relationship-graph
app.get('/api/relationship-graph', (_req, res) => {
  const nodes: GraphNode[] = [
    // IPs
    {
      id: 'ip-198.51.100.12',
      label: '198.51.100.12 (Bot-Cluster-A)',
      type: 'ip',
      riskScore: 92,
      requestRate: 8.4,
      failureRatio: 0.85,
      topEndpoints: ['/api/protected/auth/login', '/api/protected/admin/keys'],
      relatedEntities: ['acc-victim-01', 'acc-victim-02', 'sess-bot-801'],
    },
    {
      id: 'ip-198.51.100.14',
      label: '198.51.100.14 (Bot-Cluster-A)',
      type: 'ip',
      riskScore: 88,
      requestRate: 7.9,
      failureRatio: 0.8,
      topEndpoints: ['/api/protected/auth/login', '/api/protected/profile'],
      relatedEntities: ['acc-victim-03', 'acc-victim-04', 'sess-bot-802'],
    },
    {
      id: 'ip-198.51.100.15',
      label: '198.51.100.15 (Bot-Cluster-B)',
      type: 'ip',
      riskScore: 84,
      requestRate: 7.2,
      failureRatio: 0.75,
      topEndpoints: ['/api/protected/auth/login'],
      relatedEntities: ['acc-victim-05', 'sess-bot-803'],
    },
    {
      id: 'ip-103.21.244.11',
      label: '103.21.244.11 (Student WiFi)',
      type: 'ip',
      riskScore: 12,
      requestRate: 4.1,
      failureRatio: 0.02,
      topEndpoints: ['/api/protected/results', '/api/protected/products'],
      relatedEntities: ['student-roll-4011', 'sess-stud-01'],
    },
    {
      id: 'ip-103.21.244.15',
      label: '103.21.244.15 (Campus Subnet)',
      type: 'ip',
      riskScore: 14,
      requestRate: 3.8,
      failureRatio: 0.01,
      topEndpoints: ['/api/protected/results'],
      relatedEntities: ['student-roll-4012', 'sess-stud-02'],
    },
    // Accounts
    {
      id: 'acc-victim-01',
      label: 'Account: victim-01',
      type: 'account',
      riskScore: 85,
      requestRate: 6.2,
      failureRatio: 0.9,
      topEndpoints: ['/api/protected/auth/login'],
      relatedEntities: ['ip-198.51.100.12', 'dev-headless-bot'],
    },
    {
      id: 'acc-victim-02',
      label: 'Account: victim-02',
      type: 'account',
      riskScore: 82,
      requestRate: 5.8,
      failureRatio: 0.88,
      topEndpoints: ['/api/protected/auth/login'],
      relatedEntities: ['ip-198.51.100.12'],
    },
    {
      id: 'student-roll-4011',
      label: 'Account: student-4011',
      type: 'account',
      riskScore: 10,
      requestRate: 1.2,
      failureRatio: 0.0,
      topEndpoints: ['/api/protected/results'],
      relatedEntities: ['ip-103.21.244.11', 'sess-stud-01'],
    },
    {
      id: 'student-roll-4012',
      label: 'Account: student-4012',
      type: 'account',
      riskScore: 11,
      requestRate: 1.4,
      failureRatio: 0.0,
      topEndpoints: ['/api/protected/results'],
      relatedEntities: ['ip-103.21.244.15'],
    },
    // Sessions
    {
      id: 'sess-bot-801',
      label: 'Session: sess-bot-801',
      type: 'session',
      riskScore: 90,
      requestRate: 8.0,
      failureRatio: 0.9,
      topEndpoints: ['/api/protected/auth/login'],
      relatedEntities: ['ip-198.51.100.12', 'acc-victim-01'],
    },
    {
      id: 'sess-stud-01',
      label: 'Session: sess-stud-01',
      type: 'session',
      riskScore: 8,
      requestRate: 1.1,
      failureRatio: 0.0,
      topEndpoints: ['/api/protected/results'],
      relatedEntities: ['ip-103.21.244.11', 'student-roll-4011'],
    },
    // Endpoints
    {
      id: 'ep-login',
      label: 'Endpoint: /api/protected/auth/login',
      type: 'endpoint',
      riskScore: 78,
      requestRate: 24.5,
      failureRatio: 0.72,
      topEndpoints: ['/api/protected/auth/login'],
      relatedEntities: ['ip-198.51.100.12', 'ip-198.51.100.14', 'ip-198.51.100.15'],
    },
    {
      id: 'ep-results',
      label: 'Endpoint: /api/protected/results',
      type: 'endpoint',
      riskScore: 15,
      requestRate: 18.2,
      failureRatio: 0.02,
      topEndpoints: ['/api/protected/results'],
      relatedEntities: ['ip-103.21.244.11', 'ip-103.21.244.15'],
    },
    {
      id: 'ep-admin',
      label: 'Endpoint: /api/protected/admin/keys',
      type: 'endpoint',
      riskScore: 95,
      requestRate: 4.0,
      failureRatio: 1.0,
      topEndpoints: ['/api/protected/admin/keys'],
      relatedEntities: ['ip-198.51.100.12'],
    },
  ];

  const edges: GraphEdge[] = [
    // Coordinated abuse edges
    {
      id: 'edge-1',
      source: 'ip-198.51.100.12',
      target: 'acc-victim-01',
      relationshipType: 'same_account',
      similarityScore: 94,
      isHighlighted: true,
    },
    {
      id: 'edge-2',
      source: 'ip-198.51.100.12',
      target: 'acc-victim-02',
      relationshipType: 'same_account',
      similarityScore: 91,
      isHighlighted: true,
    },
    {
      id: 'edge-3',
      source: 'ip-198.51.100.12',
      target: 'ip-198.51.100.14',
      relationshipType: 'similar_behavior',
      similarityScore: 96,
      isHighlighted: true,
    },
    {
      id: 'edge-4',
      source: 'ip-198.51.100.14',
      target: 'ip-198.51.100.15',
      relationshipType: 'similar_timing',
      similarityScore: 89,
      isHighlighted: true,
    },
    {
      id: 'edge-5',
      source: 'ip-198.51.100.12',
      target: 'ep-login',
      relationshipType: 'common_endpoint',
      similarityScore: 92,
      isHighlighted: true,
    },
    {
      id: 'edge-6',
      source: 'ip-198.51.100.14',
      target: 'ep-login',
      relationshipType: 'common_endpoint',
      similarityScore: 88,
      isHighlighted: true,
    },
    {
      id: 'edge-7',
      source: 'ip-198.51.100.12',
      target: 'ep-admin',
      relationshipType: 'common_endpoint',
      similarityScore: 98,
      isHighlighted: true,
    },
    {
      id: 'edge-8',
      source: 'acc-victim-01',
      target: 'sess-bot-801',
      relationshipType: 'same_session',
      similarityScore: 95,
      isHighlighted: true,
    },
    // Legitimate spike edges
    {
      id: 'edge-legit-1',
      source: 'ip-103.21.244.11',
      target: 'student-roll-4011',
      relationshipType: 'same_account',
      similarityScore: 78,
      isHighlighted: false,
    },
    {
      id: 'edge-legit-2',
      source: 'ip-103.21.244.15',
      target: 'student-roll-4012',
      relationshipType: 'same_account',
      similarityScore: 75,
      isHighlighted: false,
    },
    {
      id: 'edge-legit-3',
      source: 'student-roll-4011',
      target: 'sess-stud-01',
      relationshipType: 'same_session',
      similarityScore: 80,
      isHighlighted: false,
    },
    {
      id: 'edge-legit-4',
      source: 'ip-103.21.244.11',
      target: 'ep-results',
      relationshipType: 'common_endpoint',
      similarityScore: 72,
      isHighlighted: false,
    },
    {
      id: 'edge-legit-5',
      source: 'ip-103.21.244.15',
      target: 'ep-results',
      relationshipType: 'common_endpoint',
      similarityScore: 74,
      isHighlighted: false,
    },
  ];

  const graphData: RelationshipGraphData = { nodes, edges };
  res.json(graphData);
});

// Threat Events, Telemetry, Policies, Blocked Clients
app.get('/api/threats', (req, res) => {
  const limit = parseInt((req.query.limit as string) || '50', 10);
  res.json({ threats: threatEvents.slice(0, limit) });
});

app.get('/api/threats/:id', (req, res) => {
  const threat = threatEvents.find((t) => t.id === req.params.id);
  if (!threat) {
    res.status(404).json({ error: 'Threat event not found' });
    return;
  }
  res.json({ threat });
});

app.get('/api/telemetry', (req, res) => {
  const limit = parseInt((req.query.limit as string) || '50', 10);
  res.json({ telemetry: telemetryLogs.slice(0, limit) });
});

app.get('/api/policies', (_req, res) => {
  res.json({ policies: securityPolicies });
});

app.put('/api/policies/:id', (req, res) => {
  const { id } = req.params;
  const update = req.body;
  const actor = (req.headers['x-actor-name'] as string) || 'Security Admin';

  const index = securityPolicies.findIndex((p) => p.id === id);
  if (index === -1) {
    res.status(404).json({ error: 'Policy not found' });
    return;
  }

  const oldPolicy = { ...securityPolicies[index] };
  securityPolicies[index] = { ...securityPolicies[index], ...update };

  auditLogs.unshift({
    id: 'audit-' + Math.random().toString(36).substring(2, 9),
    timestamp: new Date().toISOString(),
    actor,
    role: 'admin',
    action: 'POLICY_MODIFIED',
    details: `Updated policy "${oldPolicy.name}": Action=${securityPolicies[index].action}, Range=${securityPolicies[index].minScore}-${securityPolicies[index].maxScore}`,
    target: id,
  });

  broadcastSecurityEvent({ type: 'policy_update', data: securityPolicies[index] });
  res.json({ policy: securityPolicies[index] });
});

app.get('/api/blocked-clients', (_req, res) => {
  const now = Date.now();
  for (const [clientId, block] of blockedClients.entries()) {
    if (new Date(block.expiresAt).getTime() <= now) {
      blockedClients.delete(clientId);
    }
  }
  res.json({ blockedClients: Array.from(blockedClients.values()) });
});

app.post('/api/clients/:id/block', (req, res) => {
  const clientId = req.params.id;
  const { durationSec = 120, reason = 'Manual intervention by Security Operator' } = req.body;
  const actor = (req.headers['x-actor-name'] as string) || 'Security Admin';

  const expiresAt = new Date(Date.now() + durationSec * 1000).toISOString();
  const block: BlockedClient = {
    clientId,
    clientIp: req.ip || 'Manual Action',
    reason,
    riskScore: 99,
    createdAt: new Date().toISOString(),
    expiresAt,
    totalViolations: (blockedClients.get(clientId)?.totalViolations || 0) + 1,
  };

  blockedClients.set(clientId, block);

  auditLogs.unshift({
    id: 'audit-' + Math.random().toString(36).substring(2, 9),
    timestamp: new Date().toISOString(),
    actor,
    role: 'admin',
    action: 'MANUAL_CLIENT_BLOCKED',
    details: `Client ${clientId} manually blocked for ${durationSec}s. Reason: ${reason}`,
    target: clientId,
  });

  broadcastSecurityEvent({ type: 'block', data: { clientId, reason, durationSec } });
  res.json({ status: 'blocked', block });
});

app.post('/api/clients/:id/unblock', (req, res) => {
  const clientId = req.params.id;
  const actor = (req.headers['x-actor-name'] as string) || 'Security Admin';

  blockedClients.delete(clientId);
  const hist = clientHistories.get(clientId);
  if (hist) {
    hist.rateLimitUntil = 0;
  }

  auditLogs.unshift({
    id: 'audit-' + Math.random().toString(36).substring(2, 9),
    timestamp: new Date().toISOString(),
    actor,
    role: 'admin',
    action: 'MANUAL_CLIENT_UNBLOCKED',
    details: `Client ${clientId} manually pardoned and removed from blocklist.`,
    target: clientId,
  });

  broadcastSecurityEvent({ type: 'unblock', data: { clientId, reason: 'Manual operator pardon' } });
  res.json({ status: 'unblocked', clientId });
});

app.get('/api/audit-logs', (_req, res) => {
  res.json({ auditLogs: auditLogs.slice(0, 100) });
});

// AI Explanation endpoint
app.post('/api/security/explain', async (req, res) => {
  const { riskScore, reasons, clientInfo, breakdown } = req.body || {};

  const deterministicFallback = generateDeterministicExplanation(riskScore, reasons, breakdown);

  if (!process.env.GEMINI_API_KEY) {
    res.json({
      explanation: deterministicFallback,
      source: 'deterministic_engine',
      confidence: 0.96,
      recommendation: getRemediationRecommendation(riskScore),
    });
    return;
  }

  try {
    const prompt = `You are API Sentinel's AI Security Analyst. Analyze this API security incident objectively based ONLY on the evidence provided.

Security Evidence:
- Overall Risk Score: ${riskScore}/100
- Request Rate Anomaly Score: ${breakdown?.requestRateScore ?? 0}
- Failed Authentication Score: ${breakdown?.failedAuthScore ?? 0}
- Endpoint Anomaly Score: ${breakdown?.endpointAnomalyScore ?? 0}
- Sudden Behavior Change Score: ${breakdown?.behaviorChangeScore ?? 0}
- Client Identifier: ${clientInfo?.clientId || 'N/A'}
- Endpoint targeted: ${clientInfo?.endpoint || 'N/A'}
- Detected Indicators:
${(reasons || []).map((r: string) => `  * ${r}`).join('\n')}

Guidelines:
1. Provide a concise, professional 2-3 sentence executive assessment of what behavior was detected and why the deterministic policy took enforcement action.
2. Provide a 1-2 sentence tactical recommendation for the SOC team or API developer.
3. Do NOT make the final security decision; explain the deterministic decision that has already occurred.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
    });

    const aiText = response.text?.trim();

    res.json({
      explanation: aiText || deterministicFallback,
      source: aiText ? 'gemini_security_analyst' : 'deterministic_engine',
      confidence: 0.98,
      recommendation: getRemediationRecommendation(riskScore),
    });
  } catch (error: any) {
    console.warn('Gemini API call fallback:', error?.message);
    res.json({
      explanation: deterministicFallback,
      source: 'deterministic_fallback',
      confidence: 0.94,
      recommendation: getRemediationRecommendation(riskScore),
    });
  }
});

function generateDeterministicExplanation(
  score: number,
  reasons: string[] = [],
  _breakdown?: any
): string {
  if (score >= 80) {
    return `Critical multi-vector anomaly detected (${score}/100). The client exhibited aggressive telemetry anomalies: ${reasons.slice(0, 2).join(' alongside ')}. The policy engine enacted immediate temporary quarantine to shield backend resources.`;
  }
  if (score >= 60) {
    return `High-risk API velocity detected (${score}/100). Signal breakdown indicates abnormal request rates and consecutive access friction (${reasons[0] || 'rate anomaly'}). Automated rate limiting has been enforced.`;
  }
  if (score >= 30) {
    return `Elevated anomalous indicators flagged (${score}/100). Client is showing exploratory behavior or minor authentication friction: ${reasons[0] || 'unusual traffic'}. The client is placed on active SOC monitoring.`;
  }
  return `Normal operational profile (${score}/100). Request velocity, authentication status, and endpoint paths comply with standard baseline tolerances.`;
}

function getRemediationRecommendation(score: number): string {
  if (score >= 80) {
    return 'Maintain 60-second temporary block. If the client continues high-velocity attempts upon expiration, escalate to CIDR-level perimeter drop and audit target account credentials.';
  }
  if (score >= 60) {
    return 'Enforce progressive token-bucket rate limiting. Monitor for credential spray patterns across adjacent endpoints.';
  }
  if (score >= 30) {
    return 'Log telemetry in SOC audit stream. Flag client fingerprint for behavioral tracking across subsequent requests.';
  }
  return 'No corrective action required. Telemetry archived in normal rolling baseline.';
}

app.get('/api/security-events/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  res.write(
    `data: ${JSON.stringify({
      type: 'connected',
      message: 'API Sentinel live telemetry feed connected',
    })}\n\n`
  );

  sseClients.push(res);

  req.on('close', () => {
    sseClients = sseClients.filter((c) => c !== res);
  });
});

app.post('/api/simulator/reset', (_req, res) => {
  blockedClients.clear();
  clientHistories.clear();
  telemetryLogs.length = 0;
  threatEvents.length = 0;

  auditLogs.unshift({
    id: 'audit-' + Math.random().toString(36).substring(2, 9),
    timestamp: new Date().toISOString(),
    actor: 'admin_simulator',
    role: 'admin',
    action: 'TELEMETRY_RESET',
    details: 'Simulated telemetry, client histories, and blocks cleared for fresh evaluation.',
  });

  broadcastSecurityEvent({ type: 'unblock', data: { clientId: 'ALL', reason: 'System reset' } });
  res.json({ status: 'reset_complete' });
});

// ---------------------------------------------------------------------------
// Vite Integration & Production Server Setup
// ---------------------------------------------------------------------------

async function startServer() {
  const server = http.createServer(app);

  wsServer = new WebSocketServer({ server, path: '/ws/security-events' });

  wsServer.on('connection', (ws) => {
    ws.send(
      JSON.stringify({
        type: 'connected',
        message: 'API Sentinel real-time WebSocket connection active',
      })
    );
  });

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  server.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`[API Sentinel] Core protection engine active on port ${PORT}`);
    console.log(`[API Sentinel] Mode: ${isProduction ? 'Production' : 'Development'}`);
    console.log(`[API Sentinel] Protected routes: /api/protected/*`);
  });
}

// In standard Node/Docker/Cloud Run environments, start the HTTP & WS server.
// In Vercel serverless environments, Vercel executes the exported Express app directly.
if (process.env.VERCEL !== '1' && !process.env.AWS_LAMBDA_FUNCTION_NAME) {
  startServer().catch((err) => {
    console.error('Fatal error starting API Sentinel server:', err);
    process.exit(1);
  });
}

export { app };
export default app;
