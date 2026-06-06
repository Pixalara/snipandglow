-- =============================================================================
-- Migration 025: WhatsApp Dedicated Onboarding Status
-- Adds onboarding status + error tracking to the existing tenant_whatsapp_settings
-- table and an append-only event log for onboarding status transitions.
--
-- No existing column is altered (additive only, ADD COLUMN IF NOT EXISTS).
-- Supports the Pro Plan WhatsApp Onboarding feature: onboarding_status is the
-- single gate for dedicated outbound delivery, and whatsapp_onboarding_events
-- provides an audit trail of lifecycle transitions.
-- =============================================================================

-- Onboarding status + last error on the existing settings table
ALTER TABLE tenant_whatsapp_settings
  ADD COLUMN IF NOT EXISTS onboarding_status TEXT NOT NULL DEFAULT 'not_started'
    CHECK (onboarding_status IN ('not_started', 'in_progress', 'connected', 'failed', 'disconnected')),
  ADD COLUMN IF NOT EXISTS onboarding_error TEXT,                 -- descriptive reason, never a token
  ADD COLUMN IF NOT EXISTS onboarding_updated_at TIMESTAMPTZ;

-- Append-only onboarding event log (records each status transition)
CREATE TABLE IF NOT EXISTS whatsapp_onboarding_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  status TEXT NOT NULL,        -- new onboarding_status after the transition
  reason TEXT,                 -- optional descriptive reason (never a token)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast per-tenant event history lookup (most recent first)
CREATE INDEX IF NOT EXISTS idx_wa_onboarding_events_tenant
  ON whatsapp_onboarding_events(tenant_id, created_at DESC);
