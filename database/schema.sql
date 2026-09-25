-- =============================================================================
-- API SENTINEL — POSTGRESQL PRODUCTION DATABASE SCHEMA
-- Real-time API Security and Abuse Detection Platform
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Users Table (Authentication & RBAC)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    hashed_password VARCHAR(255) NOT NULL,
    full_name VARCHAR(100),
    role VARCHAR(50) NOT NULL DEFAULT 'analyst' CHECK (role IN ('admin', 'analyst', 'viewer')),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);

-- 2. API Projects Table (Multi-tenant Protection Targets)
CREATE TABLE IF NOT EXISTS api_projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    target_base_url VARCHAR(255) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_api_projects_slug ON api_projects(slug);

-- 3. API Requests Telemetry Table (Sanitized Telemetry - No Sensitive Tokens)
CREATE TABLE IF NOT EXISTS api_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES api_projects(id) ON DELETE CASCADE,
    client_id VARCHAR(128) NOT NULL,
    client_ip INET NOT NULL,
    user_agent TEXT,
    method VARCHAR(10) NOT NULL,
    endpoint VARCHAR(255) NOT NULL,
    status_code INTEGER NOT NULL,
    latency_ms INTEGER NOT NULL,
    risk_score INTEGER NOT NULL CHECK (risk_score >= 0 AND risk_score <= 100),
    action_enforced VARCHAR(30) NOT NULL CHECK (action_enforced IN ('ALLOW', 'MONITOR', 'RATE_LIMIT', 'TEMPORARY_BLOCK')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_api_requests_created_at ON api_requests(created_at DESC);
CREATE INDEX idx_api_requests_client_id ON api_requests(client_id);
CREATE INDEX idx_api_requests_risk_score ON api_requests(risk_score);
CREATE INDEX idx_api_requests_composite ON api_requests(client_id, created_at DESC);

-- 4. Threat Events Table (Security Incidents & Detections)
CREATE TABLE IF NOT EXISTS threat_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES api_projects(id) ON DELETE CASCADE,
    client_id VARCHAR(128) NOT NULL,
    client_ip INET NOT NULL,
    endpoint VARCHAR(255) NOT NULL,
    method VARCHAR(10) NOT NULL,
    status_code INTEGER NOT NULL,
    risk_score INTEGER NOT NULL CHECK (risk_score >= 0 AND risk_score <= 100),
    risk_level VARCHAR(20) NOT NULL CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
    action_enforced VARCHAR(30) NOT NULL,
    reasons JSONB NOT NULL DEFAULT '[]'::jsonb,
    score_breakdown JSONB NOT NULL DEFAULT '{}'::jsonb,
    ai_explanation TEXT,
    ai_recommendation TEXT,
    status VARCHAR(30) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'mitigated', 'resolved', 'false_positive')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_threat_events_created_at ON threat_events(created_at DESC);
CREATE INDEX idx_threat_events_client_id ON threat_events(client_id);
CREATE INDEX idx_threat_events_risk_score ON threat_events(risk_score DESC);
CREATE INDEX idx_threat_events_status ON threat_events(status);

-- 5. Security Rules & Configurable Policies Table
CREATE TABLE IF NOT EXISTS security_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES api_projects(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    risk_level VARCHAR(20) NOT NULL,
    min_score INTEGER NOT NULL,
    max_score INTEGER NOT NULL,
    action VARCHAR(30) NOT NULL CHECK (action IN ('ALLOW', 'MONITOR', 'RATE_LIMIT', 'TEMPORARY_BLOCK')),
    block_duration_sec INTEGER NOT NULL DEFAULT 60,
    is_enabled BOOLEAN NOT NULL DEFAULT true,
    description TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_security_rules_scores ON security_rules(min_score, max_score);

-- 6. Blocked Clients Table (Active Quarantines)
CREATE TABLE IF NOT EXISTS blocked_clients (
    client_id VARCHAR(128) PRIMARY KEY,
    client_ip INET NOT NULL,
    reason TEXT NOT NULL,
    risk_score INTEGER NOT NULL,
    total_violations INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX idx_blocked_clients_expires_at ON blocked_clients(expires_at);

-- 7. Audit Logs Table (Tamper-evident Administrative Audit Trail)
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    actor VARCHAR(100) NOT NULL,
    actor_role VARCHAR(50) NOT NULL,
    action VARCHAR(100) NOT NULL,
    target VARCHAR(128),
    details TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_actor ON audit_logs(actor);

-- Initial Seed Data
INSERT INTO users (email, hashed_password, full_name, role) VALUES
('admin@sentinel.internal', '$2b$12$e7/U4P4/WJbYvC6YyXJzI.W4aD8k5L4Z6R.L0O8H2K5Q9W3S8B1C2', 'Security Administrator', 'admin'),
('analyst@sentinel.internal', '$2b$12$e7/U4P4/WJbYvC6YyXJzI.W4aD8k5L4Z6R.L0O8H2K5Q9W3S8B1C2', 'SOC Analyst', 'analyst')
ON CONFLICT (email) DO NOTHING;

INSERT INTO security_rules (name, risk_level, min_score, max_score, action, block_duration_sec, is_enabled, description) VALUES
('Standard Baseline Traffic', 'low', 0, 29, 'ALLOW', 0, true, 'Nominal API behavior with expected request rates.'),
('Suspicious Activity Monitoring', 'medium', 30, 59, 'MONITOR', 0, true, 'Flagged telemetry for SOC investigation.'),
('Aggressive Abuse Throttle', 'high', 60, 79, 'RATE_LIMIT', 30, true, 'HTTP 429 rate limiting applied to rapid request bursts.'),
('Critical Threat Quarantine', 'critical', 80, 100, 'TEMPORARY_BLOCK', 60, true, 'Automated 60-second isolation for credential stuffing and attacks.')
ON CONFLICT DO NOTHING;

-- =============================================================================
-- 8. Row Level Security & Least-Privilege Role Hardening
-- =============================================================================
ALTER TABLE api_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE threat_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE blocked_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Deny public/anonymous/unauthenticated access to all telemetry tables
REVOKE ALL ON TABLE api_requests FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE threat_events FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE blocked_clients FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE audit_logs FROM PUBLIC, anon, authenticated;

-- Minimum required grants for backend service_role only
GRANT SELECT, INSERT ON TABLE api_requests TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE threat_events TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE security_rules TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE blocked_clients TO service_role;
GRANT SELECT, INSERT ON TABLE audit_logs TO service_role;

-- Enforce strict service_role policies
DROP POLICY IF EXISTS "Service role access on api_requests" ON api_requests;
CREATE POLICY "Service role access on api_requests"
    ON api_requests FOR ALL TO service_role
    USING (true) WITH CHECK (true);

