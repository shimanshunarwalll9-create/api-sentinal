import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import healthRouter from './routes/health.js';
import requestsRouter from './routes/requests.js';
import protectedRouter from './routes/protected.js';

// Load environment variables from .env file
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS for cross-origin requests from frontend applications
app.use(
  cors({
    origin: '*', // Allow all origins for development, can be restricted to frontend origin in production
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Client-ID'],
  })
);

// Body parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging in development
app.use((req, _res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.originalUrl}`);
  next();
});

// Mount API routes
app.use('/api/health', healthRouter);
app.use('/api/requests', requestsRouter);
app.use('/api/protected', protectedRouter);

// Root greeting route
app.get('/', (_req, res) => {
  res.json({
    name: 'P25 API Sentinel Backend',
    version: '1.0.0',
    status: 'online',
    endpoints: {
      health: 'GET /api/health',
      requests: 'POST /api/requests',
      protected: 'POST /api/protected/*',
    },
  });
});

// 404 Route Not Found Handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Cannot ${req.method} ${req.originalUrl}`,
  });
});

// Centralized Error Handling Middleware
app.use((err, _req, res, _next) => {
  console.error('[Unhandled Server Error]:', err);

  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  res.status(statusCode).json({
    error: err.name || 'InternalServerError',
    message,
    ...(process.env.NODE_ENV === 'development' ? { stack: err.stack } : {}),
  });
});

// Start the Express HTTP server
app.listen(PORT, () => {
  console.log(`===============================================`);
  console.log(`  P25 Backend Server running on port ${PORT}`);
  console.log(`  Health Check: http://localhost:${PORT}/api/health`);
  console.log(`  Requests API: http://localhost:${PORT}/api/requests`);
  console.log(`===============================================`);
});

export default app;
