# API Sentinel — Real-Time API Security & Abuse Detection Platform

> **College Hackathon Production MVP**  
> An intelligent, behavior-based security proxy that observes API traffic, calculates explainable 0–100 risk scores, and automatically executes adaptive defense policies (Allow, Monitor, Rate Limit, Temporary Block) with an AI Security Analyst briefing layer.

---

## 1. What is API Sentinel?

**API Sentinel** is an active security gateway deployed between external clients and backend APIs:

$$\text{User} \longrightarrow \mathbf{\text{API Sentinel Gateway}} \longrightarrow \text{Protected API}$$

Traditional fixed rate limits blindly treat all traffic identically—a burst of valid operations might be throttled while sophisticated distributed attacks or credential stuffing slip through unnoticed. API Sentinel continuously constructs a rolling behavioral baseline for every client, combining multiple signals to compute an **explainable 0–100 risk score** and enforcing deterministic security actions in real time.

---

## 2. The Main Problem

Modern web and mobile architectures are API-first. Attackers exploit traditional static thresholds using:
- **Velocity Spikes & Distributed Scrapers**: Flooding endpoints beyond capacity.
- **Credential Stuffing & Brute Force**: Repeated authentication failures against login endpoints.
- **Directory Traversal & Sensitive Probing**: Scanning for unadvertised admin paths, debug routes, or database dumps.
- **Behavioral Drift**: Rapid transitions from regular read patterns to high-velocity extraction.

Fixed request limiters do not discern context. API Sentinel solves this through multi-signal correlation.

---

## 3. The Solution & Key Innovations

### A. Behavior-Based Detection Engine
Tracks rolling metrics across sliding 60-second windows:
- **Rule 1 — Request Rate Velocity Anomaly**: Tracks requests per minute (RPM) against tolerance thresholds.
- **Rule 2 — Failed Authentication Spray**: Detects consecutive 401/403 responses on sensitive endpoints.
- **Rule 3 — Endpoint & Path Anomaly**: Detects probing of non-existent endpoints (404 fuzzing) and restricted admin namespaces (`/admin/keys`, `/internal/dump`).
- **Rule 4 — Sudden Baseline Behavior Deviation**: Compares micro-windows (last 10s) with historical baselines.

### B. Explainable Risk Score (0–100)
Every decision is completely transparent and mathematically auditable:
$$\text{Risk Score} = \text{RequestRateScore} + \text{FailedAuthScore} + \text{EndpointAnomalyScore} + \text{BehaviorChangeScore}$$
Clamped strictly between $0$ and $100$.

*Example Audit Breakdown:*
```text
Request rate anomaly          +35 pts
Failed login attempts         +25 pts
Unusual endpoint access       +20 pts
Sudden behavior change        +11 pts
-------------------------------------
Cumulative Risk Score          91 / 100 [CRITICAL]
```

### C. Adaptive Defense Policy Engine
Thresholds and actions are dynamic and configurable:
- **0 – 29 [LOW]**: `ALLOW`
- **30 – 59 [MEDIUM]**: `MONITOR` (Captured in SOC event stream)
- **60 – 79 [HIGH]**: `RATE_LIMIT` (HTTP 429 Too Many Requests throttle)
- **80 – 100 [CRITICAL]**: `TEMPORARY_BLOCK` (HTTP 403 Forbidden with `Retry-After` cooldown)

### D. AI Security Analyst (Google Gemini 3.8 Flash)
An LLM layer (`POST /api/security/explain`) generates structured incident briefings and tactical SOC remediation suggestions. **Crucially, the deterministic engine retains 100% authority over security actions; the AI serves exclusively as an interpretive analyst.** Resilient deterministic fallbacks ensure seamless operation even when offline.

---

## 4. Logical System Architecture

```text
                       INTERNET / CLIENTS
                               |
                               v
                     +--------------------+
                     |    API SENTINEL    |
                     |  Gateway Proxy     |
                     +--------------------+
                               |
               +---------------+---------------+
               |                               |
               v                               v
       Fast In-Memory Cache            Telemetry Engine
       (Active Quarantines)          (Sliding 60s Window)
               |                               |
               v                               v
         Risk Engine                   Detection Engine
       (4 Multi-Signal Rules)       (Burst / Auth / Probe)
               |                               |
               +---------------+---------------+
                               |
                               v
                         Policy Engine
                 (Configurable Thresholds)
                               |
         +---------------------+---------------------+
         |                     |                     |
         v                     v                     v
       ALLOW              RATE LIMIT           TEMPORARY BLOCK
    (Forwarded)           (HTTP 429)              (HTTP 403)
         |
         v
  PROTECTED BACKEND API (E-Commerce Catalog, Auth, Orders)
         |
         v
     DATABASE (PostgreSQL / In-Memory State)
```

---

## 5. Technology Stack

- **Frontend**: React 19, TypeScript, Tailwind CSS, Lucide Icons, Motion.
- **Backend**: Express + TypeScript (`server.ts`) full-stack runtime with optional standalone FastAPI (`backend/app/main.py`).
- **Real-Time Feed**: WebSockets (`/ws/security-events`) with automatic Server-Sent Events (`/api/security-events/stream`) fallback.
- **AI Integration**: `@google/genai` TypeScript SDK invoking `gemini-3.8-flash`.
- **Database**: PostgreSQL schema with B-Tree indexes on `timestamp`, `client_id`, and `risk_score`.
- **State & Rate Limiting**: In-memory sliding window cache with Redis architecture compatibility.

---

## 6. Directory Structure

```text
.
├── backend/
│   ├── app/
│   │   └── main.py          # Standalone FastAPI engine
│   ├── Dockerfile
│   └── requirements.txt
├── database/
│   └── schema.sql           # Complete PostgreSQL DDL with indexes & seeds
├── src/
│   ├── components/
│   │   ├── Navbar.tsx             # SOC header & Role selector
│   │   ├── OverviewTab.tsx        # KPI metrics & traffic graphs
│   │   ├── TrafficChart.tsx       # Live responsive SVG traffic chart
│   │   ├── ThreatFeedTab.tsx      # Real-time incident & telemetry stream
│   │   ├── IncidentDetailModal.tsx# Explainable breakdown & AI Analyst
│   │   ├── PolicyEngineTab.tsx    # Configurable thresholds & action editor
│   │   ├── BlockedClientsTab.tsx  # Quarantines & countdown timers
│   │   ├── TrafficSimulatorTab.tsx# Controlled attack replay suite
│   │   ├── StorefrontTab.tsx      # Target e-commerce protected application
│   │   └── AuditLogsTab.tsx       # Cryptographic audit trail
│   ├── hooks/
│   │   └── useSentinelEvents.ts   # WebSocket & SSE real-time state hook
│   ├── types/
│   │   └── sentinel.ts            # Type contracts
│   ├── App.tsx                    # Root application
│   ├── main.tsx
│   └── index.css                  # Tailwind styles
├── server.ts                # Production full-stack Sentinel gateway server
├── docker-compose.yml       # Multi-container cluster orchestration
├── .env.example
├── metadata.json
└── package.json
```

---

## 7. Installation & Local Setup

### Prerequisites
- Node.js (v18 or higher)
- npm or pnpm

### Quickstart (Single Command)
```bash
# 1. Install dependencies
npm install

# 2. Run the application
npm run dev
```
The application will launch at `http://localhost:3000`.

---

## 8. Environment Variables

Configure your `.env` based on `.env.example`:

```env
# Optional Gemini API key for AI Security Analyst incident reports
GEMINI_API_KEY="your_api_key_here"

# Runtime Port
PORT=3000

# Base URL
APP_URL="http://localhost:3000"
```

---

## 9. Database Setup (PostgreSQL)

If running the standalone PostgreSQL container:
```bash
# Start Postgres & Redis containers
docker-compose up -d postgres redis

# Apply schema migrations
psql -h localhost -U sentinel -d sentinel_db -f database/schema.sql
```

---

## 10. How to Run the Security Demo (2–3 Minute Presentation)

Follow this exact workflow during hackathon judging:

### Step 1: Establish Normal Baseline
1. Open the **Protected Store** tab.
2. Browse products, click **Add to Cart**, and click **Place Protected Order**.
3. Note the live gateway ribbon: Status `HTTP 200`, Risk Score `~10/100`, Action `ALLOW`.

### Step 2: Launch Controlled Traffic Simulator
1. Switch to the **Traffic Simulator** tab.
2. Click **1. Normal Browsing Flow** — confirm 8 successful requests, risk stays under 15.

### Step 3: Trigger High Velocity Burst (Rate Limiting)
1. Click **2. Request Velocity Burst** (28 rapid requests in 40ms intervals).
2. Observe the gateway response code shift to **HTTP 429 Too Many Requests**.
3. Response headers display `X-Sentinel-Action: RATE_LIMIT` and `Retry-After: 30`.

### Step 4: Execute the Multi-Vector Attack (Quarantine Demo)
1. In the simulator, click **5. Mixed Multi-Vector Attack (Demo)**.
2. The attacker executes velocity spikes, repeated 401 login failures, and admin endpoint probes.
3. Observe the risk score rapidly escalate: **91 / 100 [CRITICAL]**.
4. Sentinel immediately applies **TEMPORARY BLOCK (HTTP 403 Forbidden)**.
5. All subsequent requests are rejected at the edge with remaining quarantine cooldown.

### Step 5: Incident Investigation & AI Security Analyst
1. Switch to the **Threat Feed** tab and click on the newly generated critical incident.
2. View the **Explainable Signal Breakdown**:
   - Request Rate Anomaly: `+35 pts`
   - Failed Authentication: `+25 pts`
   - Unusual Endpoint Probing: `+20 pts`
   - Sudden Behavior Change: `+11 pts`
3. Click **Generate AI Assessment** — watch Google Gemini provide an executive SOC evaluation and tactical mitigation advice.

### Step 6: Review Active Sanctions & Audit Trail
1. Switch to the **Blocked Clients** tab to observe the real-time countdown timer.
2. Click **Pardon / Unblock** to restore the client to normal traffic.
3. Switch to the **Audit Trail** tab to view the tamper-evident record of all automated and operator events.

---

## 11. Role-Based Access Control (RBAC)

Use the Role Switcher in the top navigation bar to test permissions:
- **Admin**: Full authority — edit policies, apply/remove quarantines, run simulator, view audit trail.
- **Analyst**: Investigation authority — explore threats, trigger AI explanations, inspect telemetry.
- **Viewer**: Read-only SOC observation.

---

## 12. Future Scope & Roadmap

1. **Distributed Token-Bucket Cluster**: Distributed Redis rate-limiting synchronized across multi-region edge nodes.
2. **eBPF Kernel-Level Drops**: Pushing critical IP quarantines directly to Linux network interface filters for zero-CPU drops.
3. **mTLS & Client Fingerprinting**: Hardware token binding and TLS fingerprint analysis (`JA4`).
4. **SIEM / Webhook Forwarding**: Native exporters for Splunk, Datadog, and AWS CloudWatch.
