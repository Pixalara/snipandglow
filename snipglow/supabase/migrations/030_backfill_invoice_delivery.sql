-- =============================================================================
-- 030_backfill_invoice_delivery.sql
--
-- Historic invoices were created with delivery_status = 'pending' and never
-- updated, even though the bill was sent to the customer over WhatsApp at
-- creation time. Going forward the bill-send flow sets 'delivered'/'failed'
-- correctly; this backfills existing rows so the customer billing history no
-- longer shows a misleading "Pending".
--
-- We only promote the stale 'pending'/'sent' states to 'delivered'. Any row
-- explicitly marked 'failed' is left untouched.
-- =============================================================================

UPDATE invoices
  SET delivery_status = 'delivered'
  WHERE delivery_status IN ('pending', 'sent');
