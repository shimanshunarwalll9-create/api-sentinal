import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Load environment variables from .env file
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS for frontend clients
app.use(
  cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  })
);

// Middleware for parsing incoming JSON request bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Connect to Supabase using environment variables
// SUPABASE_SERVICE_ROLE_KEY is kept strictly server-side
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.warn(
    '[Supabase Warning]: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY / SUPABASE_ANON_KEY is not defined in environment.'
  );
}

const supabase = supabaseUrl && supabaseKey
  ? createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    })
  : null;

// ---------------------------------------------------------------------------
// 1. Health Check Endpoint: GET /api/health
// ---------------------------------------------------------------------------
app.get('/api/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
  });
});

// ---------------------------------------------------------------------------
// 2. Telemetry Ingestion Endpoint: POST /api/requests
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

    // Basic input validation
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

    if (!supabase) {
      return res.status(500).json({
        error: 'Configuration Error',
        message: 'Supabase client is not initialized. Please ensure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in your environment.',
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

    // Insert into existing "api_requests" table in Supabase
    const { data, error } = await supabase
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
  } catch (err) {
    next(err);
  }
});

// 404 Route Not Found Handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Cannot ${req.method} ${req.originalUrl}`,
  });
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

// Start Express server
app.listen(PORT, () => {
  console.log(`P25 Backend Server running on port ${PORT}`);
  console.log(`- Health Check: http://localhost:${PORT}/api/health`);
  console.log(`- Ingestion API: http://localhost:${PORT}/api/requests`);
});

export default app;
