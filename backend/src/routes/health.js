import { Router } from 'express';
import { supabase } from '../config/supabase.js';

const router = Router();

// GET /api/health — Full service & database connectivity health check
router.get('/', async (_req, res) => {
  let dbStatus = 'unconfigured';
  let dbDetails = null;

  if (supabase) {
    try {
      const { data, error } = await supabase.from('api_requests').select('id').limit(1);
      if (error) {
        dbStatus = 'degraded';
        dbDetails = {
          code: error.code,
          message: error.message,
        };
      } else {
        dbStatus = 'connected';
        dbDetails = {
          accessible: true,
          rowsReachable: Array.isArray(data),
        };
      }
    } catch (err) {
      dbStatus = 'error';
      dbDetails = { message: err.message };
    }
  }

  res.status(200).json({
    status: 'ok',
    service: 'p25-api-sentinel-backend',
    timestamp: new Date().toISOString(),
    database: {
      provider: 'supabase',
      status: dbStatus,
      targetTable: 'api_requests',
      details: dbDetails,
    },
  });
});

export default router;
