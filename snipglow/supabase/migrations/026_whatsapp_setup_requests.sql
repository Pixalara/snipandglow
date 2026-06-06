-- =============================================================================
-- Migration 026: WhatsApp Manual Setup Requests
-- Interim flow while WhatsApp Embedded Signup (Tech Provider approval) is pending.
--
-- A Pro/Growth tenant requests a manual WhatsApp API setup; the platform team
-- provisions the number via the Cloud API and activates the tenant from the
-- admin panel. This table tracks those requests. Additive only.
-- =============================================================================

CREATE TABLE IF NOT EXISTS whatsapp_setup_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  contact_phone TEXT NOT NULL,          -- the WhatsApp number the tenant wants to connect
  contact_name TEXT,                    -- optional contact / salon name
  notes TEXT,                           -- optional notes from the owner
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Fast per-tenant lookup of the most recent request.
CREATE INDEX IF NOT EXISTS idx_wa_setup_requests_tenant
  ON whatsapp_setup_requests(tenant_id, created_at DESC);

-- Admin queue: list open requests oldest-first.
CREATE INDEX IF NOT EXISTS idx_wa_setup_requests_status
  ON whatsapp_setup_requests(status, created_at);
