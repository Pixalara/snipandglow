-- =============================================================================
-- Migration 038: Recover product line items billed via the Appointment dashboard
--
-- Bug: completeAndGenerateBill() inserted service + product line items in one
-- mixed array. PostgREST derives the column set of a bulk insert from the FIRST
-- object, and the service rows (listed first) lacked the product_id / item_type
-- keys — so those columns were dropped for the product rows too. The product
-- line items therefore landed with product_id = NULL and item_type = 'service'
-- (the column default), making them invisible to Revenue analytics, which
-- filters on item_type = 'product'.
--
-- The code is now fixed (every line-item object carries identical keys). This
-- migration repairs the rows already written incorrectly.
--
-- Identification heuristic: an orphaned product row has
--   • service_id IS NULL   (services always carry a service_id)
--   • product_id IS NULL
--   • item_type = 'service'
--   • service_name matches an existing product name in the SAME tenant
--
-- Service rows always have a service_id, so genuine service line items are
-- never touched. Only rows whose name resolves to exactly one product in the
-- owning tenant are updated (ambiguous matches are skipped).
-- =============================================================================

UPDATE invoice_items ii
SET
  product_id = p.id,
  item_type  = 'product'
FROM invoices inv, products p
WHERE ii.invoice_id = inv.id
  AND p.tenant_id = inv.tenant_id
  AND lower(p.name) = lower(ii.service_name)
  AND ii.service_id IS NULL
  AND ii.product_id IS NULL
  AND ii.item_type = 'service'
  -- Only resolve when the name maps to exactly one product in the tenant
  -- (skip ambiguous duplicate-name products to avoid mis-attribution).
  AND (
    SELECT COUNT(*) FROM products pr2
    WHERE pr2.tenant_id = inv.tenant_id
      AND lower(pr2.name) = lower(ii.service_name)
  ) = 1;
