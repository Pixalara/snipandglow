-- =============================================================================
-- Update booking slugs to include tenant_code for uniqueness
-- Format: sng001_royal_saloon (lowercase, no dashes in code)
-- QR text: BOOK_SNG001_ROYAL_SALOON
-- =============================================================================

UPDATE tenant_whatsapp_settings tws
SET 
  booking_slug = LOWER(REPLACE(t.tenant_code, '-', '')) || '_' || LOWER(REPLACE(t.name, ' ', '_')),
  qr_text = 'BOOK_' || UPPER(REPLACE(t.tenant_code, '-', '')) || '_' || UPPER(REPLACE(t.name, ' ', '_')),
  qr_url = 'https://wa.me/919448895147?text=BOOK_' || UPPER(REPLACE(t.tenant_code, '-', '')) || '_' || UPPER(REPLACE(t.name, ' ', '_'))
FROM tenants t
WHERE tws.tenant_id = t.id
AND t.tenant_code IS NOT NULL;
