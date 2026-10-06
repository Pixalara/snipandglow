-- =============================================================================
-- 060_whatsapp_campaigns.sql
-- Resumable WhatsApp marketing campaigns with a per-recipient ledger.
--
-- WHY THIS EXISTS:
--   The old "send marketing broadcast" flow sent synchronously to at most 200
--   customers in a single request (a serverless-timeout guard-rail) and kept NO
--   record of who was contacted. A salon with 1000 customers had to hand-pick
--   200 at a time and *remember* who already got the message.
--
--   This replaces that with a durable job model:
--     • whatsapp_campaigns            — one row per campaign (content + totals + status)
--     • whatsapp_campaign_recipients  — one row per customer (status/message_id/error)
--
--   A campaign is drained in small batches by (a) the owner's progress screen
--   nudging it and (b) a background cron (/api/cron/campaign-drip). Both share a
--   race-safe claim so a recipient is never messaged twice.
--
-- OWNERSHIP / RLS: tenant members may READ their own campaigns + recipients (for
-- the dashboard). All writes go through the service-role admin client (server
-- actions + cron), which bypasses RLS, so there are no write policies — mirrors
-- whatsapp_templates / the loyalty tables. Idempotent & additive.
-- =============================================================================

-- ─── whatsapp_campaigns ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS whatsapp_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- The approved template this campaign sends. Kept as a soft reference (the
  -- template could be deleted later) plus a name snapshot for display/history.
  template_id UUID REFERENCES whatsapp_templates(id) ON DELETE SET NULL,
  template_name TEXT NOT NULL,

  -- Lifecycle. 'sending' is the active state the drainers act on. 'paused' halts
  -- draining (resumable). 'completed' when every recipient is sent/failed/skipped.
  -- 'cancelled' when the owner stops it early. 'failed' for a fatal setup error
  -- (number disconnected / template no longer approved).
  status TEXT NOT NULL DEFAULT 'sending'
    CHECK (status IN ('draft', 'sending', 'paused', 'completed', 'cancelled', 'failed')),

  -- Per-send message content. variable_values holds one value per {{n}} body
  -- placeholder; personalize_indexes lists the 0-based indexes replaced with each
  -- customer's own name instead of the fixed value.
  variable_values JSONB NOT NULL DEFAULT '[]'::jsonb,
  personalize_indexes JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Human-readable audience note shown in history (e.g. "All customers").
  audience_label TEXT,

  total_count INT NOT NULL DEFAULT 0,
  sent_count INT NOT NULL DEFAULT 0,
  failed_count INT NOT NULL DEFAULT 0,

  -- Fatal setup error (status='failed'); never contains a token.
  error TEXT,

  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_wa_campaigns_tenant_created
  ON whatsapp_campaigns(tenant_id, created_at DESC);
-- The cron scans for campaigns still being sent.
CREATE INDEX IF NOT EXISTS idx_wa_campaigns_status
  ON whatsapp_campaigns(status) WHERE status = 'sending';

-- ─── whatsapp_campaign_recipients ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS whatsapp_campaign_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES whatsapp_campaigns(id) ON DELETE CASCADE,
  -- Denormalised for RLS + "contacted recently?" lookups across campaigns.
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,

  -- Snapshot of the customer at enqueue time (survives later edits/deletes).
  name TEXT,
  phone TEXT NOT NULL,

  -- 'pending' → 'processing' (claimed by a worker) → 'sent' | 'failed'.
  -- 'skipped' marks recipients dropped when a campaign is cancelled mid-flight.
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'sent', 'failed', 'skipped')),

  message_id TEXT,
  error TEXT,
  claimed_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- One row per customer per campaign (dedup within a campaign).
  CONSTRAINT wa_campaign_recipient_unique UNIQUE (campaign_id, customer_id)
);

-- The claim query filters by (campaign_id, status) and orders by created_at.
CREATE INDEX IF NOT EXISTS idx_wa_campaign_recipients_claim
  ON whatsapp_campaign_recipients(campaign_id, status, created_at);
-- "Was this customer messaged in the last N days?" across all campaigns.
CREATE INDEX IF NOT EXISTS idx_wa_campaign_recipients_contacted
  ON whatsapp_campaign_recipients(tenant_id, customer_id, sent_at)
  WHERE status = 'sent';

-- ─── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE whatsapp_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_campaign_recipients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "whatsapp_campaigns_select" ON whatsapp_campaigns;
CREATE POLICY "whatsapp_campaigns_select" ON whatsapp_campaigns FOR SELECT
  USING (tenant_id = auth_tenant_id());

DROP POLICY IF EXISTS "whatsapp_campaign_recipients_select" ON whatsapp_campaign_recipients;
CREATE POLICY "whatsapp_campaign_recipients_select" ON whatsapp_campaign_recipients FOR SELECT
  USING (tenant_id = auth_tenant_id());

-- ─── Race-safe claim ─────────────────────────────────────────────────────────
-- Atomically grabs up to p_limit pending recipients for one campaign and flips
-- them to 'processing', so overlapping drainers (owner progress screen + cron)
-- never pick the same rows. FOR UPDATE SKIP LOCKED is the standard queue claim.
--
-- SECURITY DEFINER (runs as the table owner, bypassing RLS) + EXECUTE restricted
-- to the service role so a tenant user can never claim another tenant's rows.
CREATE OR REPLACE FUNCTION claim_campaign_recipients(p_campaign_id UUID, p_limit INT)
RETURNS TABLE (id UUID, customer_id UUID, name TEXT, phone TEXT)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE whatsapp_campaign_recipients r
  SET status = 'processing', claimed_at = now()
  WHERE r.id IN (
    SELECT r2.id
    FROM whatsapp_campaign_recipients r2
    WHERE r2.campaign_id = p_campaign_id
      AND r2.status = 'pending'
    ORDER BY r2.created_at
    LIMIT GREATEST(p_limit, 0)
    FOR UPDATE SKIP LOCKED
  )
  RETURNING r.id, r.customer_id, r.name, r.phone;
$$;

REVOKE ALL ON FUNCTION claim_campaign_recipients(UUID, INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION claim_campaign_recipients(UUID, INT) FROM anon;
REVOKE ALL ON FUNCTION claim_campaign_recipients(UUID, INT) FROM authenticated;
GRANT EXECUTE ON FUNCTION claim_campaign_recipients(UUID, INT) TO service_role;
