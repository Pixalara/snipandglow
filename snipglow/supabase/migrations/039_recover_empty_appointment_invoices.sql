-- =============================================================================
-- Migration 039: Rebuild line items for appointment invoices that lost them
--
-- Root cause: completeAndGenerateBill() inserted service + product line items
-- in a single mixed array whose objects had DIFFERENT key sets (product rows
-- carried product_id/item_type, service rows did not). PostgREST rejects a bulk
-- insert when the objects' keys don't all match (PGRST102 "All object keys must
-- match"), so the ENTIRE invoice_items insert failed — the invoice was saved
-- with totals but ZERO line items (e.g. INV-SEE-0058 rendered empty).
--
-- The application code is now fixed (every line-item object has identical keys),
-- so new bills are correct. This migration repairs the invoices already written
-- empty. Both halves are fully recoverable:
--   • Products → inventory_movements logged every sale (reference_id = invoice
--     id, movement_type='sale') even though the invoice_items insert failed.
--   • Services → the appointment stores the billed service id(s) in
--     whatsapp_flow_ref (JSON array) or service_id.
--
-- Idempotent: item_type-scoped NOT EXISTS guards mean re-running adds nothing.
-- =============================================================================

-- ── 1. Rebuild PRODUCT line items from the inventory sale ledger ─────────────
BEGIN;

INSERT INTO invoice_items
  (invoice_id, service_id, product_id, item_type, service_name, unit_price, quantity, line_total)
SELECT
  inv.id,
  NULL::uuid,
  im.product_id,
  'product',
  pr.name,
  pr.selling_price,
  ABS(im.quantity),
  pr.selling_price * ABS(im.quantity)
FROM inventory_movements im
JOIN products pr ON pr.id = im.product_id
JOIN invoices  inv ON inv.id = im.reference_id
WHERE im.reference_type = 'invoice'
  AND im.movement_type  = 'sale'
  AND inv.appointment_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM invoice_items ii
    WHERE ii.invoice_id = inv.id AND ii.item_type = 'product'
  );

-- ── 2. Rebuild SERVICE line items from the linked appointment ────────────────
INSERT INTO invoice_items
  (invoice_id, service_id, product_id, item_type, service_name, unit_price, quantity, line_total)
SELECT DISTINCT
  inv.id,
  s.id,
  NULL::uuid,
  'service',
  s.name,
  s.price,
  1,
  s.price
FROM invoices inv
JOIN appointments a ON a.id = inv.appointment_id
CROSS JOIN LATERAL jsonb_array_elements_text(
  CASE
    WHEN a.whatsapp_flow_ref LIKE '[%' THEN a.whatsapp_flow_ref::jsonb
    ELSE to_jsonb(ARRAY[a.service_id::text])
  END
) AS sid(val)
JOIN services s ON s.id = sid.val::uuid
WHERE inv.appointment_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM invoice_items ii
    WHERE ii.invoice_id = inv.id AND ii.item_type = 'service'
  );

COMMIT;
