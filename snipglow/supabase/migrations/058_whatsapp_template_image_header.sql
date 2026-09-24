-- 058_whatsapp_template_image_header.sql
-- Let a marketing template carry an IMAGE header (a banner shown above the body).
--
-- WhatsApp templates can have a media header. For an image header:
--   • at CREATE time Meta needs a sample image uploaded via the resumable upload
--     API (we pass its example.header_handle), and
--   • at SEND time the header image is supplied as a public https link.
--
-- We store that public link here so the campaign sender can attach the same
-- banner to every send without another upload. The image itself lives in the
-- public `marketing` Supabase Storage bucket (created on first upload, mirroring
-- the `logos` / `invoices` buckets); this column holds its permanent public URL.
--
-- Backward compatible & idempotent: additive nullable column only. Text-only
-- templates simply leave it NULL and behave exactly as before.
-- =============================================================================

ALTER TABLE whatsapp_templates
  ADD COLUMN IF NOT EXISTS header_image_url TEXT;

COMMENT ON COLUMN whatsapp_templates.header_image_url IS
  'Public https URL of the IMAGE-header banner (Supabase `marketing` bucket). NULL for text-only templates. Sent as the template header link at broadcast time.';
