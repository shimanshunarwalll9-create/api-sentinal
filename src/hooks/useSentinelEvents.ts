import { useEffect, useRef, useState, useCallback } from 'react';
import type {
  ApiRequestTelemetry,
  ThreatEvent,
  SecurityPolicy,
  BlockedClient,
  DashboardOverview,
  TrafficDataPoint,
  DistributedPattern,
} from '../types/sentinel';

export interface SentinelState {
  overview: DashboardOverview | null;
  trafficPoints: TrafficDataPoint[];
  telemetry: ApiRequestTelemetry[];
  threats: ThreatEvent[];
  blockedClients: BlockedClient[];
  policies: SecurityPolicy[];
  distributedPatterns: DistributedPattern[];
  isConnected: boolean;
  activeRole: 'admin' | 'analyst' | 'viewer';
  lastUpdated: string;
}

export function useSentinelEvents() {
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [trafficPoints, setTrafficPoints] = useState<TrafficDataPoint[]>([]);
  const [telemetry, setTelemetry] = useState<ApiRequestTelemetry[]>([]);
  const [threats, setThreats] = useState<ThreatEvent[]>([]);
  const [blockedClients, setBlockedClients] = useState<BlockedClient[]>([]);
  const [policies, setPolicies] = useState<SecurityPolicy[]>([]);
  const [distributedPatterns, setDistributedPatterns] = useState<DistributedPattern[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [activeRole, setActiveRole] = useState<'admin' | 'analyst' | 'viewer'>('admin');
  const [lastUpdated, setLastUpdated] = useState<string>(new Date().toLocaleTimeString());

  const wsRef = useRef<WebSocket | null>(null);
  const sseRef = useRef<EventSource | null>(null);

  // Initial data fetch
  const fetchAllData = useCallback(async () => {
    try {
      const [overviewRes, trafficRes, threatsRes, telemetryRes, policiesRes, blockedRes, patternsRes] =
        await Promise.all([
          fetch('/api/dashboard/overview'),
          fetch('/api/dashboard/traffic'),
          fetch('/api/threats?limit=50'),
          fetch('/api/telemetry?limit=50'),
          fetch('/api/policies'),
          fetch('/api/blocked-clients'),
          fetch('/api/distributed-patterns'),
        ]);

      if (overviewRes.ok) setOverview(await overviewRes.json());
      if (trafficRes.ok) {
        const data = await trafficRes.json();
        setTrafficPoints(data.points || []);
      }
      if (threatsRes.ok) {
        const data = await threatsRes.json();
        setThreats(data.threats || []);
      }
      if (telemetryRes.ok) {
        const data = await telemetryRes.json();
        setTelemetry(data.telemetry || []);
      }
      if (policiesRes.ok) {
        const data = await policiesRes.json();
        setPolicies(data.policies || []);
      }
      if (blockedRes.ok) {
        const data = await blockedRes.json();
        setBlockedClients(data.blockedClients || []);
      }
      if (patternsRes.ok) {
        const data = await patternsRes.json();
        setDistributedPatterns(data.patterns || []);
      }

      setLastUpdated(new Date().toLocaleTimeString());
    } catch (err) {
      console.error('Error fetching Sentinel state:', err);
    }
  }, []);

  // Handle incoming real-time payload
  const handleEventPayload = useCallback(
    (parsed: any) => {
      setLastUpdated(new Date().toLocaleTimeString());

      if (parsed.type === 'telemetry') {
        const newTel: ApiRequestTelemetry = parsed.data;
        setTelemetry((prev) => [newTel, ...prev.slice(0, 79)]);

        // Refresh overview and traffic
        setOverview((prev) => {
          if (!prev) return null;
          const isBlocked = newTel.blocked || newTel.statusCode === 403;
          const isSuspicious = !isBlocked && newTel.riskEvaluation.riskScore >= 30;
          return {
            ...prev,
            totalRequests: prev.totalRequests + 1,
            trafficBreakdown: {
              normal: prev.trafficBreakdown.normal + (!isBlocked && !isSuspicious ? 1 : 0),
              suspicious: prev.trafficBreakdown.suspicious + (isSuspicious ? 1 : 0),
              blocked: prev.trafficBreakdown.blocked + (isBlocked ? 1 : 0),
            },
          };
        });
      } else if (parsed.type === 'threat') {
        const newThreat: ThreatEvent = parsed.data;
        setThreats((prev) => [newThreat, ...prev.slice(0, 49)]);
        setOverview((prev) =>
          prev ? { ...prev, threatsDetected: prev.threatsDetected + 1 } : null
        );
      } else if (parsed.type === 'block' || parsed.type === 'unblock') {
        // Refetch blocked clients & overview
        fetch('/api/blocked-clients')
          .then((r) => r.json())
          .then((data) => {
            if (data.blockedClients) {
              setBlockedClients(data.blockedClients);
              setOverview((prev) =>
                prev ? { ...prev, blockedClientsCount: data.blockedClients.length } : null
              );
            }
          })
          .catch(() => {});
      } else if (parsed.type === 'policy_update') {
        fetch('/api/policies')
          .then((r) => r.json())
          .then((data) => {
            if (data.policies) setPolicies(data.policies);
          })
          .catch(() => {});
      } else if (parsed.type === 'distributed_pattern') {
        const newPattern: DistributedPattern = parsed.data;
        setDistributedPatterns((prev) => {
          const idx = prev.findIndex((p) => p.id === newPattern.id);
          if (idx >= 0) {
            const next = [...prev];
            next[idx] = newPattern;
            return next;
          }
          return [newPattern, ...prev];
        });
      }
    },
    []
  );

  useEffect(() => {
    fetchAllData();

    // 1. Attempt WebSocket connection
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/security-events`;

    let socket: WebSocket | null = null;
    let sse: EventSource | null = null;

    try {
      socket = new WebSocket(wsUrl);
      wsRef.current = socket;

      socket.onopen = () => {
        setIsConnected(true);
      };

      socket.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data);
          handleEventPayload(parsed);
        } catch (e) {
          console.error('WS parse error:', e);
        }
      };

      socket.onerror = () => {
        // Fallback to SSE
        fallbackToSSE();
      };

      socket.onclose = () => {
        fallbackToSSE();
      };
    } catch {
      fallbackToSSE();
    }

    function fallbackToSSE() {
      if (sseRef.current) return;
      try {
        sse = new EventSource('/api/security-events/stream');
        sseRef.current = sse;

        sse.onopen = () => {
          setIsConnected(true);
        };

        sse.onmessage = (event) => {
          try {
            const parsed = JSON.parse(event.data);
            handleEventPayload(parsed);
          } catch (e) {
            console.error('SSE parse error:', e);
          }
        };

        sse.onerror = () => {
          setIsConnected(false);
        };
      } catch {
        setIsConnected(false);
      }
    }

    // Polling interval every 6 seconds as a reliable heartbeat
    const pollInterval = setInterval(() => {
      fetch('/api/dashboard/overview')
        .then((r) => r.json())
        .then((data) => setOverview(data))
        .catch(() => {});

      fetch('/api/dashboard/traffic')
        .then((r) => r.json())
        .then((data) => setTrafficPoints(data.points || []))
        .catch(() => {});

      fetch('/api/blocked-clients')
        .then((r) => r.json())
        .then((data) => setBlockedClients(data.blockedClients || []))
        .catch(() => {});

      fetch('/api/distributed-patterns')
        .then((r) => r.json())
        .then((data) => setDistributedPatterns(data.patterns || []))
        .catch(() => {});
    }, 6000);

    return () => {
      clearInterval(pollInterval);
      if (socket) socket.close();
      if (sse) sse.close();
    };
  }, [fetchAllData, handleEventPayload]);

  return {
    overview,
    trafficPoints,
    telemetry,
    threats,
    blockedClients,
    policies,
    distributedPatterns,
    isConnected,
    activeRole,
    setActiveRole,
    lastUpdated,
    refreshAll: fetchAllData,
  };
}
