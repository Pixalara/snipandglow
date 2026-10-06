-- =============================================================================
-- 059_whatsapp_carousel_templates.sql
-- Extend the whatsapp_templates mirror to support CAROUSEL marketing templates
-- (a message bubble + up to 10 image cards, each with offer text and shared
-- buttons) and local DRAFT templates the owner can edit before submitting.
--
-- WHY these columns live on the same table:
--   • A carousel is still a Meta message template on the tenant's own WABA; it
--     shares the whole lifecycle (PENDING -> APPROVED/REJECTED via the webhook)
--     and the same (tenant_id, name, language) identity as a standard template.
--   • The only extra data a carousel needs is its per-card content (image URL +
--     body text) and the shared button set — both naturally JSONB.
--   • `template_type` discriminates the two so each composer lists only its own.
--
-- DRAFT status: a carousel can be saved locally and re-edited before it is ever
-- sent to Meta. Drafts have no meta_template_id and never reach the webhook, so
-- adding DRAFT to the status check keeps the one-table model intact.
--
-- Backward compatible & idempotent: additive nullable columns + a widened CHECK.
-- Existing standard templates default to template_type='standard' and behave
-- exactly as before (cards/buttons stay NULL).
-- =============================================================================

-- 1) Discriminator: 'standard' (body/header/footer/buttons) vs 'carousel'.
ALTER TABLE whatsapp_templates
  ADD COLUMN IF NOT EXISTS template_type TEXT NOT NULL DEFAULT 'standard'
    CHECK (template_type IN ('standard', 'carousel'));

-- 2) Carousel cards: ordered JSONB array of { image_url, body_text }.
--    NULL for standard templates. Card order is the array order (Meta renders
--    cards in the order they are submitted).
ALTER TABLE whatsapp_templates
  ADD COLUMN IF NOT EXISTS cards JSONB;

-- 3) Shared button set applied to every carousel card (Meta requires identical
--    button types across all cards). JSONB array of
--    { type: QUICK_REPLY|URL|PHONE_NUMBER, text, url?, phone_number? }.
ALTER TABLE whatsapp_templates
  ADD COLUMN IF NOT EXISTS buttons JSONB;

-- 4) Allow a local DRAFT status (editable, not yet on Meta). Drop the inline
--    unnamed check and re-add a named, widened one.
ALTER TABLE whatsapp_templates
  DROP CONSTRAINT IF EXISTS whatsapp_templates_status_check;
ALTER TABLE whatsapp_templates
  ADD CONSTRAINT whatsapp_templates_status_check
    CHECK (status IN ('DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'PAUSED', 'DISABLED'));

CREATE INDEX IF NOT EXISTS idx_wa_templates_type
  ON whatsapp_templates(tenant_id, template_type);

COMMENT ON COLUMN whatsapp_templates.template_type IS
  'standard = body/header/footer/buttons template; carousel = message bubble + image cards.';
COMMENT ON COLUMN whatsapp_templates.cards IS
  'Carousel only: ordered JSONB array of { image_url, body_text } per card. NULL for standard.';
COMMENT ON COLUMN whatsapp_templates.buttons IS
  'Carousel only: shared button set { type, text, url?, phone_number? } applied to every card. NULL for standard.';
