import { Router } from 'express';
import { getSupabaseClient } from '../config/supabase.js';

const router = Router();

// GET /api/requests — Fetch latest telemetry records ordered by created_at
router.get('/', async (req, res, next) => {
  try {
    let supabase;
    try {
      supabase = getSupabaseClient();
    } catch (configErr) {
      return res.status(500).json({
        error: 'Configuration Error',
        message: configErr.message || 'Supabase credentials are not configured.',
      });
    }

    const limit = Math.min(Number(req.query.limit) || 50, 100);
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

// POST /api/requests
router.post('/', async (req, res, next) => {
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
    if (ip_address === undefined || ip_address === null || String(ip_address).trim() === '') {
      missingFields.push('ip_address');
    }
    if (endpoint === undefined || endpoint === null || String(endpoint).trim() === '') {
      missingFields.push('endpoint');
    }
    if (method === undefined || method === null || String(method).trim() === '') {
      missingFields.push('method');
    }
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

    // Obtain initialized Supabase client
    let supabase;
    try {
      supabase = getSupabaseClient();
    } catch (configErr) {
      return res.status(500).json({
        error: 'Configuration Error',
        message: configErr.message || 'Supabase credentials are not configured in environment variables.',
      });
    }

    // Insert into existing "api_requests" table
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
              hint: 'The table "api_requests" was not found in your Supabase project. Please execute the SQL in "backend/schema.sql" in your Supabase SQL Editor.',
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

export default router;
