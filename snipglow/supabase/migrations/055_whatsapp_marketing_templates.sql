-- =============================================================================
-- 055_whatsapp_marketing_templates.sql
-- Local mirror of the WhatsApp message templates a Pro/Growth tenant creates on
-- THEIR OWN WhatsApp Business Account (WABA).
--
-- WHY A LOCAL MIRROR (and not just calling Meta every time):
--   • Meta approves templates asynchronously (minutes–24h) and pushes the
--     verdict to our webhook as `message_template_status_update`. That verdict
--     needs a row to land on.
--   • The composer UI must show the owner their templates + live status without
--     a Graph API round-trip on every page load (and without their token being
--     exposed to the browser).
--   • The future "send marketing broadcast" feature needs to know which
--     templates are APPROVED before it is allowed to send.
--
-- OWNERSHIP: every template here belongs to the tenant's own WABA. Essentials
-- tenants (shared platform number) never create templates, so in practice only
-- dedicated/connected Pro/Growth tenants ever get rows — but the table is not
-- plan-gated at the schema level (the server action enforces that).
--
-- Backward compatible & idempotent: new table + read-only RLS; nothing existing
-- is touched. All writes happen through the service-role admin client (the
-- submit server action and the webhook), so no INSERT/UPDATE policy is needed.
-- =============================================================================

CREATE TABLE IF NOT EXISTS whatsapp_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Meta template identity. `name` is lowercase snake_case ([a-z0-9_]); a WABA
  -- keys templates on (name, language), so we mirror that uniqueness per tenant.
  name TEXT NOT NULL,
  language TEXT NOT NULL DEFAULT 'en',

  -- Meta requires a category. We only ever create MARKETING here, but the column
  -- accepts the full set so utility/auth templates can be mirrored later.
  category TEXT NOT NULL DEFAULT 'MARKETING'
    CHECK (category IN ('MARKETING', 'UTILITY', 'AUTHENTICATION')),

  -- Review lifecycle. Starts PENDING on submit; the webhook flips it to
  -- APPROVED / REJECTED / PAUSED / DISABLED as Meta reports.
  status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'PAUSED', 'DISABLED')),

  -- The authored content. body_text keeps positional {{1}} placeholders exactly
  -- as submitted; example_params holds one sample value per placeholder (Meta
  -- requires examples for approval and we reuse them for the preview).
  body_text TEXT NOT NULL,
  header_text TEXT,
  footer_text TEXT,
  example_params JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Meta's returned template id, and the rejection reason when status=REJECTED.
  meta_template_id TEXT,
  rejection_reason TEXT,

  created_by UUID REFERENCES employees(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT whatsapp_templates_name_lang_unique UNIQUE (tenant_id, name, language)
);

CREATE INDEX IF NOT EXISTS idx_wa_templates_tenant ON whatsapp_templates(tenant_id);
CREATE INDEX IF NOT EXISTS idx_wa_templates_status ON whatsapp_templates(tenant_id, status);
-- The webhook resolves the row to update by Meta's template id first.
CREATE INDEX IF NOT EXISTS idx_wa_templates_meta_id
  ON whatsapp_templates(meta_template_id) WHERE meta_template_id IS NOT NULL;

-- RLS — tenant members may READ their own templates. Every write goes through the
-- service-role admin client (submit action + webhook), which bypasses RLS, so we
-- deliberately expose no INSERT/UPDATE/DELETE policy (mirrors the loyalty tables).
ALTER TABLE whatsapp_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "whatsapp_templates_select" ON whatsapp_templates;
CREATE POLICY "whatsapp_templates_select" ON whatsapp_templates FOR SELECT
  USING (tenant_id = auth_tenant_id());
