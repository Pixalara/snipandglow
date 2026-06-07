-- =============================================================================
-- 027_session_source_bill_feedback.sql
--
-- The bill-receipt flow creates an `awaiting_feedback` customer session so that
-- when the customer taps "Rate Now" the webhook can deterministically route the
-- rating back to the salon that billed them.
--
-- That insert uses `source = 'bill_feedback'`, but the original CHECK constraint
-- on whatsapp_customer_sessions.source only allowed ('qr','direct','campaign').
-- The violating insert failed silently, so the session was never written and
-- "Rate Now" fell back to the generic booking handler.
--
-- This migration widens the allowed `source` values to include the ones the app
-- actually uses ('bill_feedback', 'template_reply'), fixing the Rate Now flow.
-- =============================================================================

ALTER TABLE whatsapp_customer_sessions
  DROP CONSTRAINT IF EXISTS whatsapp_customer_sessions_source_check;

ALTER TABLE whatsapp_customer_sessions
  ADD CONSTRAINT whatsapp_customer_sessions_source_check
  CHECK (source IN ('qr', 'direct', 'campaign', 'bill_feedback', 'template_reply'));
