-- =============================================================================
-- 041_invoice_item_discount.sql
-- Per-item (line-level) discounts.
--
-- Previously discount was bill-level only (invoices.discount_pct/discount_amount).
-- This adds a discount to each invoice line so each service/product can be
-- discounted independently based on its margin.
--
--   line gross   = unit_price * quantity
--   discount_amt = round(gross * discount_pct / 100)
--   line_total   = gross - discount_amt   (NET — analytics reads line_total)
--
-- invoices.discount_amount remains the SUM of all line discounts and
-- invoices.discount_pct the blended % (kept for receipts / backward-compat).
-- Existing rows default to 0 discount, so nothing changes for historical data.
-- =============================================================================

ALTER TABLE invoice_items
  ADD COLUMN IF NOT EXISTS discount_pct NUMERIC(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(10,2) NOT NULL DEFAULT 0;
