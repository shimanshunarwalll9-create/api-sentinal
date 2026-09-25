export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type SecurityAction = 'ALLOW' | 'MONITOR' | 'RATE_LIMIT' | 'TEMPORARY_BLOCK';
export type UserRole = 'admin' | 'analyst' | 'viewer';
export type PatternClassification = 'POTENTIAL_COORDINATED_PATTERN' | 'LEGITIMATE_TRAFFIC_SURGE';

export interface ScoreBreakdown {
  requestRateScore: number;
  failedAuthScore: number;
  endpointAnomalyScore: number;
  behaviorChangeScore: number;
}

export interface RiskEvaluation {
  riskScore: number;
  riskLevel: RiskLevel;
  action: SecurityAction;
  breakdown: ScoreBreakdown;
  reasons: string[];
}

export interface ApiRequestTelemetry {
  id: string;
  timestamp: string;
  clientId: string;
  clientIp: string;
  account?: string;
  session?: string;
  device?: string;
  userAgent?: string;
  method: string;
  endpoint: string;
  statusCode: number;
  latencyMs: number;
  riskEvaluation: RiskEvaluation;
  blocked: boolean;
  rateLimited: boolean;
}

export interface ThreatEvent {
  id: string;
  timestamp: string;
  clientId: string;
  clientIp: string;
  account?: string;
  session?: string;
  endpoint: string;
  method: string;
  riskScore: number;
  riskLevel: RiskLevel;
  action: SecurityAction;
  reasons: string[];
  breakdown: ScoreBreakdown;
  statusCode: number;
  status: 'active' | 'mitigated' | 'resolved';
  aiAnalysis?: string;
}

export interface BehavioralFingerprint {
  entityId: string;
  entityType: 'ip' | 'account' | 'session' | 'device';
  request_rate: number;
  endpoint_sequence: string[];
  avg_interval_ms: number;
  http_methods: {
    GET: number;
    POST: number;
    PUT?: number;
    DELETE?: number;
  };
  success_ratio: number;
  failure_ratio: number;
  unique_endpoints: number;
  auth_failure_rate: number;
  session_count: number;
  traffic_change: number;
  last_updated: string;
}

export interface SimilarityWeights {
  frequency: number;       // 0.25
  sequence: number;        // 0.20
  timing: number;          // 0.20
  failurePattern: number;  // 0.15
  httpMethod: number;      // 0.05
  auth: number;            // 0.10
  behaviorChange: number;  // 0.05
}

export interface DistributedPattern {
  id: string;
  patternName: string;
  classification: PatternClassification;
  confidence: number; // 0 - 100%
  distributedThreatScore: number; // 0 - 100
  riskLevel: RiskLevel;
  similarityPct: number;
  status: 'Under Investigation' | 'Mitigated' | 'Monitoring' | 'Legitimate Spike';
  relatedIps: string[];
  relatedAccounts: string[];
  relatedSessions: string[];
  commonEndpoints: string[];
  reasons: string[];
  timestamp: string;
  firstSeen: string;
  lastSeen: string;
  summaryExplanation: string;
  isLegitimateSpike: boolean;
}

export interface GraphNode {
  id: string;
  label: string;
  type: 'ip' | 'account' | 'session' | 'device' | 'endpoint';
  riskScore: number;
  requestRate: number;
  failureRatio: number;
  topEndpoints: string[];
  relatedEntities: string[];
  x?: number;
  y?: number;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  relationshipType:
    | 'same_account'
    | 'same_session'
    | 'similar_behavior'
    | 'common_endpoint'
    | 'similar_timing'
    | 'similar_sequence';
  similarityScore: number;
  isHighlighted: boolean;
}

export interface RelationshipGraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface UserAccount {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  organization?: string;
  createdAt: string;
}

export interface SecurityPolicy {
  id: string;
  name: string;
  level: RiskLevel;
  minScore: number;
  maxScore: number;
  action: SecurityAction;
  blockDurationSec: number;
  enabled: boolean;
  description: string;
}

export interface BlockedClient {
  clientId: string;
  clientIp: string;
  reason: string;
  riskScore: number;
  createdAt: string;
  expiresAt: string;
  totalViolations: number;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  actor: string;
  role: UserRole;
  action: string;
  details: string;
  target?: string;
}

export interface DashboardOverview {
  totalRequests: number;
  requestsPerMinute: number;
  activeSessions: number;
  threatsDetected: number;
  potentialCoordinatedPatterns: number;
  blockedClientsCount: number;
  averageRiskScore: number;
  trafficBreakdown: {
    normal: number;
    suspicious: number;
    blocked: number;
  };
  policyStats: {
    allowed: number;
    monitored: number;
    rateLimited: number;
    blocked: number;
  };
}

export interface TrafficDataPoint {
  time: string;
  normal: number;
  suspicious: number;
  blocked: number;
}

export interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  description: string;
  stock: number;
  badge?: string;
}

export interface OrderItem {
  productId: string;
  quantity: number;
  price: number;
}

export interface Order {
  id: string;
  orderNumber: string;
  clientId: string;
  items: OrderItem[];
  total: number;
  status: 'confirmed' | 'processing' | 'shipped';
  createdAt: string;
}

