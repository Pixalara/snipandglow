-- =============================================================================
-- Feedback Table — Stores customer feedback received via WhatsApp
-- =============================================================================

CREATE TABLE IF NOT EXISTS feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL DEFAULT '',
  customer_phone TEXT NOT NULL DEFAULT '',
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  source TEXT NOT NULL DEFAULT 'whatsapp', -- 'whatsapp' | 'manual' | 'google'
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast tenant+branch queries
CREATE INDEX IF NOT EXISTS idx_feedback_tenant_branch ON feedback(tenant_id, branch_id, created_at DESC);

-- RLS
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY feedback_select ON feedback FOR SELECT
  USING (tenant_id = (current_setting('request.jwt.claims', true)::json->>'tenant_id')::uuid);

CREATE POLICY feedback_insert ON feedback FOR INSERT
  WITH CHECK (tenant_id = (current_setting('request.jwt.claims', true)::json->>'tenant_id')::uuid);
