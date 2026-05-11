-- Migration: 003_operational_tables
-- Description: Create operational tables (whatsapp_sessions, audit_logs, analytics_snapshots, otp_codes)
-- Requirements: 17.1, 9.6, 12.5

-- =============================================================================
-- WHATSAPP SESSIONS
-- =============================================================================
CREATE TABLE whatsapp_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  message_id TEXT,
  phone TEXT NOT NULL,
  template_name TEXT,
  direction TEXT NOT NULL DEFAULT 'outbound'
    CHECK (direction IN ('inbound', 'outbound')),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sent', 'delivered', 'read', 'failed')),
  error_details TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_whatsapp_sessions_tenant_id ON whatsapp_sessions(tenant_id);
CREATE INDEX idx_whatsapp_sessions_branch_id ON whatsapp_sessions(branch_id);
CREATE INDEX idx_whatsapp_sessions_phone ON whatsapp_sessions(phone);
CREATE INDEX idx_whatsapp_sessions_created_at ON whatsapp_sessions(created_at);
CREATE INDEX idx_whatsapp_sessions_tenant_phone ON whatsapp_sessions(tenant_id, phone);

-- =============================================================================
-- AUDIT LOGS
-- =============================================================================
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES employees(id),
  actor_name TEXT,
  action_type TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id UUID,
  description TEXT,
  old_data JSONB,
  new_data JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_audit_logs_tenant_id ON audit_logs(tenant_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX idx_audit_logs_tenant_created_at ON audit_logs(tenant_id, created_at);
CREATE INDEX idx_audit_logs_action_type ON audit_logs(action_type);
CREATE INDEX idx_audit_logs_resource_type ON audit_logs(resource_type);

-- =============================================================================
-- ANALYTICS SNAPSHOTS
-- =============================================================================
CREATE TABLE analytics_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL,
  revenue NUMERIC(10,2) DEFAULT 0,
  appointment_count INT DEFAULT 0,
  new_customers INT DEFAULT 0,
  retention_rate NUMERIC(5,2) DEFAULT 0,
  active_memberships INT DEFAULT 0,
  top_services JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(tenant_id, branch_id, snapshot_date)
);

CREATE INDEX idx_analytics_snapshots_tenant_id ON analytics_snapshots(tenant_id);
CREATE INDEX idx_analytics_snapshots_branch_id ON analytics_snapshots(branch_id);
CREATE INDEX idx_analytics_snapshots_snapshot_date ON analytics_snapshots(snapshot_date);
CREATE INDEX idx_analytics_snapshots_tenant_branch_date ON analytics_snapshots(tenant_id, branch_id, snapshot_date);

-- =============================================================================
-- OTP CODES (WhatsApp OTP verification)
-- =============================================================================
CREATE TABLE otp_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT NOT NULL,
  code TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_otp_codes_phone_code_expires ON otp_codes(phone, code, expires_at);
