-- =============================================================================
-- Migration 018: Admin Audit Logs
-- Tracks all platform-owner actions in the admin dashboard for compliance.
-- =============================================================================

CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID,
  admin_email TEXT NOT NULL,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_created ON admin_audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_admin ON admin_audit_logs(admin_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_target ON admin_audit_logs(target_type, target_id);

-- RLS: only service_role (admin client) should write/read
ALTER TABLE admin_audit_logs ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON admin_audit_logs FROM PUBLIC;
REVOKE ALL ON admin_audit_logs FROM anon;
REVOKE ALL ON admin_audit_logs FROM authenticated;
GRANT ALL ON admin_audit_logs TO service_role;
