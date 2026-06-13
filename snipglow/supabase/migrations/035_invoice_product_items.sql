-- =============================================================================
-- Migration 035: Sell retail products on invoices
--
-- Lets a bill contain service line items, product line items, or both. Builds
-- on migration 034 (products / inventory_movements).
--
-- invoice_items already has a NULLABLE service_id, so this is additive only:
--   • product_id — links a line item to a product (NULL for service items)
--   • item_type  — 'service' (default) or 'product'
--
-- All existing rows become item_type='service' automatically. Downstream
-- rendering (invoice document, PDF, WhatsApp receipt) reads `service_name`,
-- so product line items simply store the product name there — no other change.
-- =============================================================================

ALTER TABLE invoice_items
  ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES products(id),
  ADD COLUMN IF NOT EXISTS item_type TEXT NOT NULL DEFAULT 'service'
    CHECK (item_type IN ('service', 'product'));

-- Fast lookups of which invoices sold a given product.
CREATE INDEX IF NOT EXISTS idx_invoice_items_product
  ON invoice_items(product_id) WHERE product_id IS NOT NULL;
