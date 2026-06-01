-- Migration 023: Add template_category to whatsapp_sessions for cost tracking
-- Meta India rates effective April 1, 2026:
--   Marketing:               ₹0.8631/msg
--   Utility:                 ₹0.1150/msg
--   Authentication:          ₹0.1150/msg
--   Authentication-Intl:     ₹2.4971/msg
-- =============================================================================

ALTER TABLE whatsapp_sessions
  ADD COLUMN IF NOT EXISTS template_category TEXT DEFAULT 'utility'
    CHECK (template_category IN ('marketing', 'utility', 'authentication', 'authentication_intl', 'service', 'unknown'));

-- Index for cost queries
CREATE INDEX IF NOT EXISTS idx_whatsapp_sessions_category
  ON whatsapp_sessions(tenant_id, template_category, direction, created_at);

-- Backfill existing records based on template name
UPDATE whatsapp_sessions
SET template_category = CASE
  -- Marketing templates
  WHEN template_name IN ('renewal_reminder', 'winback_60_day') THEN 'marketing'
  -- Authentication templates
  WHEN template_name IN ('otp_verification') THEN 'authentication'
  -- Utility templates (everything else outbound)
  WHEN direction = 'outbound' THEN 'utility'
  -- Inbound messages are free (service category)
  WHEN direction = 'inbound' THEN 'service'
  ELSE 'utility'
END
WHERE template_category IS NULL OR template_category = 'utility';
