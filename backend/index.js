import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Load environment variables strictly server-side
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS for cross-origin requests from frontend applications
app.use(
  cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Client-ID', 'X-Requested-With'],
  })
);

// Body parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Connect to Supabase using server-side service_role key only (Never exposed to frontend)
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.warn(
    '[Supabase Server Warning]: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not defined in environment variables.'
  );
}

const supabase =
  supabaseUrl && supabaseKey
    ? createClient(supabaseUrl, supabaseKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      })
    : null;

// ---------------------------------------------------------------------------
// Real-Time Abuse Detection & Velocity Engine (In-Memory sliding window)
// ---------------------------------------------------------------------------
const clientHistoryMap = new Map();
const blockedClientsList = new Map();

function getClientHistory(clientId) {
  let hist = clientHistoryMap.get(clientId);
  if (!hist) {
    hist = {
      requestTimestamps: [],
      failedAuthTimestamps: [],
      blockedUntil: 0,
      rateLimitUntil: 0,
      lastPaths: [],
    };
    clientHistoryMap.set(clientId, hist);
  }
  return hist;
}

/**
 * Calculates risk score (0-100) based on velocity, repeated requests, and suspicious endpoints.
 */
function evaluateRisk(clientId, clientIp, method, path, body) {
  const now = Date.now();
  const hist = getClientHistory(clientId);

  // Prune older than 60s
  hist.requestTimestamps = hist.requestTimestamps.filter((t) => now - t <= 60000);
  hist.requestTimestamps.push(now);

  hist.lastPaths.push(path);
  if (hist.lastPaths.length > 20) hist.lastPaths.shift();

  const reasons = [];
  let score = 0;

  // 1. Request rate / velocity (RPM)
  const rpm = hist.requestTimestamps.length;
  if (rpm > 60) {
    score += 45;
    reasons.push(`High request rate velocity: ${rpm} req/min exceeds critical threshold`);
  } else if (rpm > 30) {
    score += 25;
    reasons.push(`Elevated velocity: ${rpm} req/min detected`);
  } else if (rpm > 15) {
    score += 10;
    reasons.push(`Moderate request frequency: ${rpm} req/min`);
  }

  // 2. Micro-burst velocity (past 5 seconds)
  const last5sCount = hist.requestTimestamps.filter((t) => now - t <= 5000).length;
  if (last5sCount >= 10) {
    score += 30;
    reasons.push(`Velocity burst: ${last5sCount} requests in 5-second micro-window`);
  }

  // 3. Repeated requests to exact same endpoint
  const recentSamePathCount = hist.lastPaths.filter((p) => p === path).length;
  if (recentSamePathCount >= 8) {
    score += 20;
    reasons.push(`Rapid repetitive targeting of ${path} (${recentSamePathCount} recent requests)`);
  }

  // 4. Suspicious patterns (Admin probes, SQLi tokens, script fuzzing)
  const suspiciousKeywords = ['admin', 'keys', 'export', 'dump', 'config', 'env', 'root', 'internal'];
  const hasSuspiciousPath = suspiciousKeywords.some((kw) => path.toLowerCase().includes(kw));
  if (hasSuspiciousPath) {
    score += 30;
    reasons.push(`Probe to sensitive restricted path: ${path}`);
  }

  const rawBody = JSON.stringify(body || {});
  if (
    rawBody.includes("' OR '1'='1") ||
    rawBody.includes('--') ||
    rawBody.includes('<script>') ||
    rawBody.includes('UNION SELECT')
  ) {
    score += 45;
    reasons.push('Malicious payload pattern detected in request body');
  }

  const riskScore = Math.min(100, Math.max(0, score));

  let action = 'ALLOW';
  if (riskScore >= 80) {
    action = 'TEMPORARY_BLOCK';
  } else if (riskScore >= 60) {
    action = 'RATE_LIMIT';
  } else if (riskScore >= 30) {
    action = 'MONITOR';
  }

  if (reasons.length === 0) {
    reasons.push('Normal operational baseline behavior');
  }

  return { riskScore, action, reasons };
}

// ---------------------------------------------------------------------------
// Telemetry Ingestion Helper (Writes directly to Supabase api_requests using created_at)
// ---------------------------------------------------------------------------
async function recordTelemetryToSupabase(payload) {
  if (!supabase) return null;

  try {
    // Only operational columns are sent. created_at is automatically defaulted by PostgreSQL.
    // ZERO references to "timestamp".
    const { data, error } = await supabase
      .from('api_requests')
      .insert([payload])
      .select();

    if (error) {
      return null;
    }
    return data && data[0] ? data[0] : null;
  } catch (err) {
    return null;
  }
}

// ---------------------------------------------------------------------------
// 1. Health Check Endpoint: GET /api/health
// ---------------------------------------------------------------------------
app.get('/api/health', async (_req, res) => {
  let dbStatus = 'unconfigured';
  let dbDetails = null;

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('api_requests')
        .select('id, created_at')
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) {
        dbStatus = 'degraded';
        dbDetails = { code: error.code, message: error.message };
      } else {
        dbStatus = 'connected';
        dbDetails = {
          accessible: true,
          rowsFound: Array.isArray(data) ? data.length : 0,
        };
      }
    } catch (err) {
      dbStatus = 'error';
      dbDetails = { message: err.message };
    }
  }

  res.status(200).json({
    status: 'ok',
    service: 'api-sentinel-backend',
    engine: 'Express 4 + Supabase PostgreSQL',
    database: {
      provider: 'supabase',
      status: dbStatus,
      targetTable: 'public.api_requests',
      details: dbDetails,
    },
  });
});

// ---------------------------------------------------------------------------
// 2. Protected API Proxy: POST /api/protected/*
// ---------------------------------------------------------------------------
app.post('/api/protected/*', async (req, res) => {
  const startTime = Date.now();
  const subPath = req.params[0] || '';
  const fullPath = `/api/protected/${subPath}`;
  const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
  const clientId = req.headers['x-client-id'] || `client-${String(clientIp).replace(/[^a-zA-Z0-9]/g, '_')}`;
  const userId = req.headers['x-user-id'] || req.body?.user_id || null;
  const sessionId = req.headers['x-session-id'] || req.body?.session_id || null;

  const hist = getClientHistory(clientId);
  const now = Date.now();

  // Step A: Check if client is currently in active quarantine block
  if (hist.blockedUntil > now) {
    const remainingSec = Math.ceil((hist.blockedUntil - now) / 1000);
    const latency = Date.now() - startTime;

    // Record blocked telemetry log
    await recordTelemetryToSupabase({
      ip_address: String(clientIp).split(',')[0].trim(),
      user_id: userId,
      session_id: sessionId,
      endpoint: fullPath,
      method: req.method,
      status_code: 403,
      response_time: latency,
    });

    return res.status(403).json({
      error: 'Client blocked by API Sentinel policy',
      action: 'TEMPORARY_BLOCK',
      risk_score: 95,
      reason: `Client is currently quarantined. Retry after ${remainingSec}s`,
      retry_after_seconds: remainingSec,
    });
  }

  // Step B: Check if client is currently rate limited
  if (hist.rateLimitUntil > now) {
    const remainingSec = Math.ceil((hist.rateLimitUntil - now) / 1000);
    const latency = Date.now() - startTime;

    await recordTelemetryToSupabase({
      ip_address: String(clientIp).split(',')[0].trim(),
      user_id: userId,
      session_id: sessionId,
      endpoint: fullPath,
      method: req.method,
      status_code: 429,
      response_time: latency,
    });

    return res.status(429).json({
      error: 'Rate limit exceeded',
      action: 'RATE_LIMIT',
      reason: 'Request rate exceeded allowable threshold',
      retry_after_seconds: remainingSec,
    });
  }

  // Step C: Run real-time abuse detection & scoring
  const evaluation = evaluateRisk(clientId, clientIp, req.method, fullPath, req.body);

  // Step D: Apply enforcement actions
  if (evaluation.action === 'TEMPORARY_BLOCK') {
    const blockDurationSec = 60;
    hist.blockedUntil = now + blockDurationSec * 1000;
    const expiresAt = new Date(hist.blockedUntil).toISOString();

    blockedClientsList.set(clientId, {
      clientId,
      clientIp,
      reason: evaluation.reasons.join('; '),
      riskScore: evaluation.riskScore,
      expiresAt,
    });

    const latency = Date.now() - startTime;
    await recordTelemetryToSupabase({
      ip_address: String(clientIp).split(',')[0].trim(),
      user_id: userId,
      session_id: sessionId,
      endpoint: fullPath,
      method: req.method,
      status_code: 403,
      response_time: latency,
    });

    return res.status(403).json({
      error: 'Client blocked by API Sentinel policy',
      action: 'TEMPORARY_BLOCK',
      risk_score: evaluation.riskScore,
      reason: evaluation.reasons[0],
      retry_after_seconds: blockDurationSec,
      expires_at: expiresAt,
    });
  }

  if (evaluation.action === 'RATE_LIMIT') {
    const rateLimitDurationSec = 30;
    hist.rateLimitUntil = now + rateLimitDurationSec * 1000;

    const latency = Date.now() - startTime;
    await recordTelemetryToSupabase({
      ip_address: String(clientIp).split(',')[0].trim(),
      user_id: userId,
      session_id: sessionId,
      endpoint: fullPath,
      method: req.method,
      status_code: 429,
      response_time: latency,
    });

    return res.status(429).json({
      error: 'Rate limit triggered',
      action: 'RATE_LIMIT',
      risk_score: evaluation.riskScore,
      reason: evaluation.reasons[0],
      retry_after_seconds: rateLimitDurationSec,
    });
  }

  // Step E: Target endpoint fulfillment
  let responseData = {};
  let statusCode = 200;

  if (subPath === 'auth/login' || subPath === 'login') {
    const { email, password } = req.body || {};
    if (email === 'admin@sentinel.internal' && password === 'admin123!') {
      responseData = {
        status: 'success',
        token: 'sentinel_tok_' + Math.random().toString(36).substring(2),
        user: { id: 'usr-admin', email, role: 'admin' },
      };
    } else {
      statusCode = 401;
      responseData = { error: 'Invalid credentials', code: 'AUTH_FAILED' };
    }
  } else if (subPath.startsWith('admin')) {
    statusCode = 403;
    responseData = { error: 'Administrative privileges required', code: 'FORBIDDEN' };
  } else if (subPath === 'orders' || subPath === 'checkout') {
    responseData = {
      status: 'order_processed',
      orderId: 'ORD-' + Math.floor(10000 + Math.random() * 90000),
      timestamp: new Date().toISOString(),
    };
  } else {
    // Standard protected proxy echo
    responseData = {
      success: true,
      path: fullPath,
      message: 'Protected API request routed successfully',
      data: req.body || null,
    };
  }

  const responseTime = Date.now() - startTime;

  // Step F: Record telemetry in Supabase public.api_requests using created_at
  await recordTelemetryToSupabase({
    ip_address: String(clientIp).split(',')[0].trim(),
    user_id: userId,
    session_id: sessionId,
    endpoint: fullPath,
    method: req.method,
    status_code: statusCode,
    response_time: responseTime,
  });

  return res.status(statusCode).json({
    ...responseData,
    _sentinel: {
      inspected: true,
      action: evaluation.action,
      risk_score: evaluation.riskScore,
      response_time_ms: responseTime,
    },
  });
});

// ---------------------------------------------------------------------------
// 3. Telemetry Log Reader API: GET /api/requests
// ---------------------------------------------------------------------------
app.get('/api/requests', async (req, res, next) => {
  try {
    if (!supabase) {
      return res.status(500).json({
        error: 'Configuration Error',
        message: 'Supabase client is not initialized.',
      });
    }

    const limit = Math.min(Number(req.query.limit) || 50, 100);

    // Queries strictly use created_at (NEVER timestamp)
    const { data, error } = await supabase
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
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// 4. Telemetry Direct Ingestion: POST /api/requests
// ---------------------------------------------------------------------------
app.post('/api/requests', async (req, res, next) => {
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
    const missingFields = [];
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

    if (supabase) {
      const { data, error } = await supabase
        .from('api_requests')
        .insert([payloadToInsert])
        .select();

      if (error) {
        return res.status(500).json({
          error: 'Database Error',
          message: error.message,
          code: error.code,
        });
      }

      return res.status(201).json({
        success: true,
        message: 'Request logged successfully',
        data: data && data.length > 0 ? data[0] : payloadToInsert,
      });
    } else {
      return res.status(201).json({
        success: true,
        message: 'Request validated (Supabase credentials pending in .env)',
        data: payloadToInsert,
      });
    }
  } catch (err) {
    next(err);
  }
});

// Centralized error handler
app.use((err, _req, res, _next) => {
  console.error('[Unhandled Server Error]:', err);
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    error: err.name || 'InternalServerError',
    message: err.message || 'Internal Server Error',
  });
});

// Start Express server if run directly (e.g. node backend/index.js)
const isMain = process.argv[1] && process.argv[1].endsWith('backend/index.js');
if (isMain) {
  app.listen(PORT, () => {
    console.log(`P25 Sentinel Backend running on port ${PORT}`);
    console.log(`- Health Check: GET http://localhost:${PORT}/api/health`);
    console.log(`- Protected Proxy: POST http://localhost:${PORT}/api/protected/*`);
    console.log(`- Ingest Telemetry: POST http://localhost:${PORT}/api/requests`);
    console.log(`- Query Telemetry: GET http://localhost:${PORT}/api/requests`);
  });
}

export default app;
