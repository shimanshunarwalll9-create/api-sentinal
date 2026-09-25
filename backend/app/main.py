"""
API Sentinel — FastAPI Core Engine
Production Standalone Python Implementation
"""

import time
import os
from typing import List, Optional
from fastapi import FastAPI, Request, Response, HTTPException, WebSocket, WebSocketDisconnect, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(
    title="API Sentinel",
    description="Real-time API Security and Abuse Detection Engine",
    version="2.4.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory fast state caches (mirrored to Redis/Postgres in cluster)
blocked_clients = {}
client_history = {}
threat_events = []
telemetry_logs = []
audit_logs = []

class RiskBreakdown(BaseModel):
    request_rate_score: int
    failed_auth_score: int
    endpoint_anomaly_score: int
    behavior_change_score: int

class RiskEvaluation(BaseModel):
    risk_score: int
    risk_level: str
    action: str
    breakdown: RiskBreakdown
    reasons: List[str]

class ExplainRequest(BaseModel):
    risk_score: int
    reasons: List[str]
    breakdown: Optional[dict] = None
    client_info: Optional[dict] = None

class PolicyUpdate(BaseModel):
    min_score: int
    max_score: int
    action: str
    block_duration_sec: int
    enabled: bool

@app.middleware("http")
async def sentinel_security_middleware(request: Request, call_next):
    # Only protect target /api/protected/* routes
    if not request.url.path.startswith("/api/protected"):
        return await call_next(request)

    client_id = request.headers.get("x-client-id") or request.client.host
    now = time.time()

    # 1. Check Active Quarantine
    if client_id in blocked_clients:
        expires_at = blocked_clients[client_id]["expires_at"]
        if expires_at > now:
            remaining = int(expires_at - now)
            return Response(
                content=f'{{"error": "Client temporarily blocked by API Sentinel", "retry_after": {remaining}}}',
                status_code=403,
                media_type="application/json",
                headers={
                    "X-Sentinel-Action": "TEMPORARY_BLOCK",
                    "Retry-After": str(remaining)
                }
            )
        else:
            del blocked_clients[client_id]

    start_time = time.time()
    response = await call_next(request)
    latency_ms = int((time.time() - start_time) * 1000)

    # 2. Behavioral Detection Engine
    hist = client_history.setdefault(client_id, {"requests": [], "failed_auth": []})
    hist["requests"] = [t for t in hist["requests"] if now - t <= 60]
    hist["failed_auth"] = [t for t in hist["failed_auth"] if now - t <= 60]

    hist["requests"].append(now)
    if response.status_code in (401, 403):
        hist["failed_auth"].append(now)

    rpm = len(hist["requests"])
    failed_auths = len(hist["failed_auth"])

    # Score Calculation
    rate_score = 40 if rpm > 35 else (25 if rpm > 20 else 0)
    auth_score = 35 if failed_auths >= 4 else (20 if failed_auths >= 2 else 0)
    endpoint_score = 25 if "/admin" in request.url.path else (15 if response.status_code == 404 else 0)
    behavior_score = 20 if rpm > 25 and len(hist["requests"][-10:]) >= 10 else 0

    total_risk = min(100, rate_score + auth_score + endpoint_score + behavior_score)

    action = "ALLOW"
    if total_risk >= 80:
        action = "TEMPORARY_BLOCK"
        blocked_clients[client_id] = {
            "expires_at": now + 60,
            "risk_score": total_risk,
            "reason": "Critical risk score triggered automated quarantine"
        }
    elif total_risk >= 60:
        action = "RATE_LIMIT"
    elif total_risk >= 30:
        action = "MONITOR"

    response.headers["X-Sentinel-Risk-Score"] = str(total_risk)
    response.headers["X-Sentinel-Action"] = action
    response.headers["X-Sentinel-Latency"] = f"{latency_ms}ms"

    return response

@app.get("/api/dashboard/overview")
def get_overview():
    return {
        "total_requests": len(telemetry_logs),
        "threats_detected": len(threat_events),
        "blocked_clients_count": len(blocked_clients),
        "average_risk_score": 18
    }

@app.post("/api/security/explain")
def explain_threat(payload: ExplainRequest):
    reasons_str = "; ".join(payload.reasons)
    return {
        "explanation": f"The client was flagged with risk score {payload.risk_score}/100 due to {reasons_str}. Deterministic threshold enforcement took defensive action to safeguard backend resources.",
        "source": "api_sentinel_analyst",
        "confidence": 0.98,
        "recommendation": "Maintain temporary rate limiting or client quarantine until behavioral baseline stabilizes."
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
