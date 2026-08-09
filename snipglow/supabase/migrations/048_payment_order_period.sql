-- =============================================================================
-- 048_payment_order_period.sql
-- Record exactly which subscription period each payment bought.
--
-- Activation now follows three rules (see lib/razorpay/subscription-window.ts):
--   • first payment, or renewing after expiry → term starts on the payment date
--   • renewing while a paid plan is still live → term starts the day AFTER the
--     current expiry, so no paid day is lost
--
-- Persisting the resolved window makes billing questions answerable from data
-- ("what did this ₹999 buy?") instead of having to re-derive it, and lets the
-- payment history show the period alongside the amount.
--
-- Purely additive: three nullable columns, no backfill, no behaviour change for
-- existing rows.
-- =============================================================================

ALTER TABLE payment_orders
  ADD COLUMN IF NOT EXISTS period_start TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS period_end   TIMESTAMPTZ,
  /** Which rule produced the window: 'payment_date' | 'day_after_current_end'. */
  ADD COLUMN IF NOT EXISTS activation_basis TEXT;

COMMENT ON COLUMN payment_orders.period_start IS
  'Start of the subscription term this payment bought.';
COMMENT ON COLUMN payment_orders.period_end IS
  'End of the subscription term this payment bought.';
COMMENT ON COLUMN payment_orders.activation_basis IS
  'payment_date = started on the payment date; day_after_current_end = chained onto a live paid plan.';
