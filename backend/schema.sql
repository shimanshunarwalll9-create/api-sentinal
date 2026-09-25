CREATE TABLE IF NOT EXISTS public.api_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ip_address VARCHAR(45) NOT NULL,
    user_id VARCHAR(255),
    session_id VARCHAR(255),
    endpoint VARCHAR(255) NOT NULL,
    method VARCHAR(10) NOT NULL,
    status_code INTEGER NOT NULL,
    response_time INTEGER NOT NULL
);

-- Index for common query performance
CREATE INDEX IF NOT EXISTS idx_api_requests_ip ON public.api_requests(ip_address);
CREATE INDEX IF NOT EXISTS idx_api_requests_created_at ON public.api_requests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_requests_endpoint ON public.api_requests(endpoint);

-- Enable Row Level Security (RLS)
ALTER TABLE public.api_requests ENABLE ROW LEVEL SECURITY;

-- Revoke all permissions from public/anonymous/authenticated roles (Least-Privilege Principle)
REVOKE ALL ON TABLE public.api_requests FROM PUBLIC, anon, authenticated;

-- Grant minimal necessary table privileges strictly to service_role (backend server only)
GRANT SELECT, INSERT ON TABLE public.api_requests TO service_role;

-- Row Level Security Policy: Accessible ONLY by service_role
DROP POLICY IF EXISTS "Service role access on api_requests" ON public.api_requests;
DROP POLICY IF EXISTS "Service role full access on api_requests" ON public.api_requests;

CREATE POLICY "Service role access on api_requests"
    ON public.api_requests
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);
