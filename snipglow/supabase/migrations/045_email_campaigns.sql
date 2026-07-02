-- =============================================================================
-- 045_email_campaigns.sql
-- Persistent history for admin feature-announcement emails.
--
--  • email_campaigns            — one row per bulk send (content snapshot + totals)
--  • email_campaign_recipients  — one row per recipient (delivered / failed + detail)
--
-- Admin-only: RLS is enabled with NO policies, so only the service-role client
-- (used by the admin server actions) can read/write. Regular tenant/staff users
-- can never see this data.
-- =============================================================================

CREATE TABLE IF NOT EXISTS email_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject TEXT NOT NULL,
  campaign JSONB NOT NULL DEFAULT '{}'::jsonb,   -- full content snapshot at send time
  mode TEXT NOT NULL DEFAULT 'bulk' CHECK (mode IN ('bulk', 'test')),
  sent_by TEXT,                                  -- admin email that triggered the send
  total_count INT NOT NULL DEFAULT 0,
  sent_count INT NOT NULL DEFAULT 0,
  failed_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS email_campaign_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES email_campaigns(id) ON DELETE CASCADE,
  tenant_id UUID,
  salon_name TEXT,
  email TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('sent', 'failed')),
  detail TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_campaigns_created ON email_campaigns(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_campaign_recipients_campaign ON email_campaign_recipients(campaign_id);

ALTER TABLE email_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_campaign_recipients ENABLE ROW LEVEL SECURITY;
-- Intentionally no policies → default-deny for anon/authenticated; service role bypasses RLS.
