# P25 API Sentinel - Express & Supabase Backend

A lightweight, robust Node.js + Express backend service designed to ingest API telemetry logs and persist them directly into your Supabase PostgreSQL `api_requests` table.

---

## 📁 Folder Structure

```
backend/
├── .env.example              # Template for environment variables
├── package.json              # Project dependencies and startup scripts
├── README.md                 # Setup and testing instructions
└── src/
    ├── config/
    │   └── supabase.js       # Server-side Supabase client initialization
    ├── routes/
    │   ├── health.js         # GET /api/health endpoint
    │   └── requests.js       # POST /api/requests ingestion endpoint
    └── server.js             # Express application entry point & middleware setup
```

---

## 📦 Required npm Packages

```bash
cd backend
npm install express cors dotenv @supabase/supabase-js
```

---

## 🔑 Environment Variables

Create a `.env` file inside the `backend/` folder:

```env
PORT=5000
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-secret-key
```

> **Security Note:** The `SUPABASE_SERVICE_ROLE_KEY` bypasses Row Level Security (RLS) on PostgreSQL and is kept strictly server-side. Never expose it in client-side code.

---

## 🚀 Starting the Server

```bash
# Production start
npm start

# Development mode (with auto-reload on Node 18+)
npm run dev
```

---

## 🧪 Testing the Endpoints

### 1. Health Check (`GET /api/health`)

```bash
curl -X GET http://localhost:5000/api/health
```

**Expected Response:**
```json
{
  "status": "ok"
}
```

---

### 2. Request Ingestion (`POST /api/requests`)

```bash
curl -X POST http://localhost:5000/api/requests \
  -H "Content-Type: application/json" \
  -d '{
    "ip_address": "192.168.1.10",
    "user_id": "user_123",
    "session_id": "session_456",
    "endpoint": "/login",
    "method": "POST",
    "status_code": 401,
    "response_time": 120
  }'
```

**Expected 201 Response:**
```json
{
  "success": true,
  "message": "Request logged successfully",
  "data": {
    "ip_address": "192.168.1.10",
    "user_id": "user_123",
    "session_id": "session_456",
    "endpoint": "/login",
    "method": "POST",
    "status_code": 401,
    "response_time": 120
  }
}
```
