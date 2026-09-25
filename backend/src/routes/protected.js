import { Router } from 'express';
import { supabase } from '../config/supabase.js';

const router = Router();

// In-memory sliding window history for abuse detection
const clientHistoryMap = new Map();
const blockedClientsList = new Map();

function getClientHistory(clientId) {
  let hist = clientHistoryMap.get(clientId);
  if (!hist) {
    hist = {
      requestTimestamps: [],
      blockedUntil: 0,
      rateLimitUntil: 0,
      lastPaths: [],
    };
    clientHistoryMap.set(clientId, hist);
  }
  return hist;
}

function evaluateAbuse(clientId, clientIp, method, fullPath, body) {
  const now = Date.now();
  const hist = getClientHistory(clientId);

  hist.requestTimestamps = hist.requestTimestamps.filter((t) => now - t <= 60000);
  hist.requestTimestamps.push(now);

  hist.lastPaths.push(fullPath);
  if (hist.lastPaths.length > 20) hist.lastPaths.shift();

  let score = 0;
  const reasons = [];

  const rpm = hist.requestTimestamps.length;
  if (rpm > 60) {
    score += 45;
    reasons.push(`High velocity: ${rpm} req/min`);
  } else if (rpm > 30) {
    score += 25;
    reasons.push(`Elevated velocity: ${rpm} req/min`);
  } else if (rpm > 15) {
    score += 10;
  }

  const last5sCount = hist.requestTimestamps.filter((t) => now - t <= 5000).length;
  if (last5sCount >= 10) {
    score += 30;
    reasons.push(`Burst surge: ${last5sCount} requests in 5 seconds`);
  }

  const repeatedCount = hist.lastPaths.filter((p) => p === fullPath).length;
  if (repeatedCount >= 8) {
    score += 20;
    reasons.push(`Repetitive request targeting: ${repeatedCount} to ${fullPath}`);
  }

  const suspicious = ['admin', 'keys', 'export', 'dump', 'config', 'internal'];
  if (suspicious.some((kw) => fullPath.toLowerCase().includes(kw))) {
    score += 30;
    reasons.push(`Sensitive endpoint probing: ${fullPath}`);
  }

  const rawBody = JSON.stringify(body || {});
  if (
    rawBody.includes("' OR '1'='1") ||
    rawBody.includes('--') ||
    rawBody.includes('<script>') ||
    rawBody.includes('UNION SELECT')
  ) {
    score += 45;
    reasons.push('Abnormal payload pattern detected in body');
  }

  const riskScore = Math.min(100, Math.max(0, score));

  let action = 'ALLOW';
  if (riskScore >= 80) action = 'TEMPORARY_BLOCK';
  else if (riskScore >= 60) action = 'RATE_LIMIT';
  else if (riskScore >= 30) action = 'MONITOR';

  if (reasons.length === 0) reasons.push('Operational nominal baseline');

  return { riskScore, action, reasons };
}

async function recordTelemetry(payload) {
  if (!supabase) return;
  try {
    await supabase.from('api_requests').insert([payload]);
  } catch (err) {
    // Non-blocking telemetry
  }
}

// Wildcard POST handler: POST /api/protected/*
router.post('/*', async (req, res) => {
  const startTime = Date.now();
  const subPath = req.params[0] || '';
  const fullPath = `/api/protected/${subPath}`;

  const clientIp = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1').split(',')[0].trim();
  const clientId = (req.headers['x-client-id'] || `client-${clientIp.replace(/[^a-zA-Z0-9]/g, '_')}`).trim();
  const userId = req.headers['x-user-id'] || req.body?.user_id || null;
  const sessionId = req.headers['x-session-id'] || req.body?.session_id || null;

  const hist = getClientHistory(clientId);
  const now = Date.now();

  // Active quarantine check
  if (hist.blockedUntil > now) {
    const remainingSec = Math.ceil((hist.blockedUntil - now) / 1000);
    const latency = Date.now() - startTime;

    recordTelemetry({
      ip_address: clientIp,
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
      reason: `Client quarantined. Retry after ${remainingSec}s`,
      retry_after_seconds: remainingSec,
    });
  }

  // Active rate limit check
  if (hist.rateLimitUntil > now) {
    const remainingSec = Math.ceil((hist.rateLimitUntil - now) / 1000);
    const latency = Date.now() - startTime;

    recordTelemetry({
      ip_address: clientIp,
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
      reason: 'Request rate exceeded threshold',
      retry_after_seconds: remainingSec,
    });
  }

  // Abuse evaluation
  const evaluation = evaluateAbuse(clientId, clientIp, req.method, fullPath, req.body);

  if (evaluation.action === 'TEMPORARY_BLOCK') {
    const duration = 60;
    hist.blockedUntil = now + duration * 1000;
    const latency = Date.now() - startTime;

    recordTelemetry({
      ip_address: clientIp,
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
      retry_after_seconds: duration,
    });
  }

  if (evaluation.action === 'RATE_LIMIT') {
    const duration = 30;
    hist.rateLimitUntil = now + duration * 1000;
    const latency = Date.now() - startTime;

    recordTelemetry({
      ip_address: clientIp,
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
      retry_after_seconds: duration,
    });
  }

  // Successful routing
  let statusCode = 200;
  let responseBody = {};

  if (subPath.startsWith('admin')) {
    statusCode = 403;
    responseBody = { error: 'Administrative privileges required', code: 'FORBIDDEN' };
  } else if (subPath === 'auth/login' || subPath === 'login') {
    const { email, password } = req.body || {};
    if (email === 'admin@sentinel.internal' && password === 'admin123!') {
      responseBody = {
        status: 'success',
        token: 'tok_' + Math.random().toString(36).substring(2),
        user: { email, role: 'admin' },
      };
    } else {
      statusCode = 401;
      responseBody = { error: 'Invalid credentials', code: 'AUTH_FAILED' };
    }
  } else {
    responseBody = {
      success: true,
      path: fullPath,
      message: 'Protected API request routed and inspected successfully',
      data: req.body || null,
    };
  }

  const responseTime = Date.now() - startTime;

  recordTelemetry({
    ip_address: clientIp,
    user_id: userId,
    session_id: sessionId,
    endpoint: fullPath,
    method: req.method,
    status_code: statusCode,
    response_time: responseTime,
  });

  return res.status(statusCode).json({
    ...responseBody,
    _sentinel: {
      action: evaluation.action,
      risk_score: evaluation.riskScore,
      response_time_ms: responseTime,
    },
  });
});

export default router;
