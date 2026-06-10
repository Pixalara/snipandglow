-- =============================================================================
-- Migration 033: Enable Row-Level Security on remaining public tables
--
-- Supabase flagged these public tables as having RLS disabled
-- (lint: rls_disabled_in_public), which means the anon/authenticated API roles
-- could read/write them directly via the project URL.
--
-- Affected tables:
--   • support_tickets
--   • tenant_whatsapp_settings        (holds ENCRYPTED access tokens — highest risk)
--   • whatsapp_customer_sessions
--   • whatsapp_onboarding_events
--   • whatsapp_setup_requests
--
-- All of these are accessed exclusively from the server using the SERVICE-ROLE
-- admin client, which BYPASSES RLS. So enabling RLS does not break any app flow.
-- We additionally:
--   • REVOKE all grants from the anon/authenticated API roles, and
--   • add tenant-scoped SELECT policies (defense-in-depth) so that even if a
--     user-scoped client is ever used, a tenant can only see its own rows and
--     never a stored access token (token reads stay server-only via service role).
--
-- Idempotent: safe to run more than once.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- support_tickets
-- ---------------------------------------------------------------------------
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON support_tickets FROM anon, authenticated;

DROP POLICY IF EXISTS "support_tickets_select_own" ON support_tickets;
CREATE POLICY "support_tickets_select_own" ON support_tickets
  FOR SELECT USING (tenant_id = auth_tenant_id());

-- ---------------------------------------------------------------------------
-- tenant_whatsapp_settings  (contains access_token_encrypted — never user-readable)
-- RLS enabled with NO permissive user policy: only the service-role admin client
-- (which bypasses RLS) may read/write. This keeps encrypted tokens server-only.
-- ---------------------------------------------------------------------------
ALTER TABLE tenant_whatsapp_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON tenant_whatsapp_settings FROM anon, authenticated;

-- ---------------------------------------------------------------------------
-- whatsapp_customer_sessions
-- ---------------------------------------------------------------------------
ALTER TABLE whatsapp_customer_sessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON whatsapp_customer_sessions FROM anon, authenticated;

DROP POLICY IF EXISTS "wa_customer_sessions_select_own" ON whatsapp_customer_sessions;
CREATE POLICY "wa_customer_sessions_select_own" ON whatsapp_customer_sessions
  FOR SELECT USING (tenant_id = auth_tenant_id());

-- ---------------------------------------------------------------------------
-- whatsapp_onboarding_events
-- ---------------------------------------------------------------------------
ALTER TABLE whatsapp_onboarding_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON whatsapp_onboarding_events FROM anon, authenticated;

DROP POLICY IF EXISTS "wa_onboarding_events_select_own" ON whatsapp_onboarding_events;
CREATE POLICY "wa_onboarding_events_select_own" ON whatsapp_onboarding_events
  FOR SELECT USING (tenant_id = auth_tenant_id());

-- ---------------------------------------------------------------------------
-- whatsapp_setup_requests
-- ---------------------------------------------------------------------------
ALTER TABLE whatsapp_setup_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON whatsapp_setup_requests FROM anon, authenticated;

DROP POLICY IF EXISTS "wa_setup_requests_select_own" ON whatsapp_setup_requests;
CREATE POLICY "wa_setup_requests_select_own" ON whatsapp_setup_requests
  FOR SELECT USING (tenant_id = auth_tenant_id());
