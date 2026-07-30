-- =============================================================================
-- 047_payment_orders.sql
-- Razorpay subscription payments (one-time order per billing period).
--
-- Every checkout creates a row here BEFORE the customer pays, so we can:
--   • verify the amount server-side (never trust the browser),
--   • make activation idempotent (the browser callback AND the webhook can both
--     report the same payment — whichever lands first wins, the other no-ops),
--   • keep an auditable payment history per tenant.
--
-- Admin-only via service role: RLS is enabled and tenants get read-only access
-- to their own rows so the dashboard can show billing history.
-- =============================================================================

CREATE TABLE IF NOT EXISTS payment_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  razorpay_order_id TEXT NOT NULL UNIQUE,
  razorpay_payment_id TEXT,
  /** Amount in paise, exactly as sent to Razorpay. */
  amount INT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'INR',
  plan_tier TEXT NOT NULL,
  billing_cycle TEXT NOT NULL CHECK (billing_cycle IN ('monthly', 'yearly')),
  /** Months of access this payment buys (1 or 12). */
  months INT NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'created'
    CHECK (status IN ('created', 'paid', 'failed')),
  /** Set once the subscription has actually been extended (idempotency latch). */
  activated_at TIMESTAMPTZ,
  created_by TEXT,
  notes JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payment_orders_tenant ON payment_orders(tenant_id);
CREATE INDEX IF NOT EXISTS idx_payment_orders_created ON payment_orders(created_at DESC);

ALTER TABLE payment_orders ENABLE ROW LEVEL SECURITY;

-- Tenants may READ their own payment history. All writes happen server-side
-- with the service-role key (which bypasses RLS).
DROP POLICY IF EXISTS "payment_orders_select" ON payment_orders;
CREATE POLICY "payment_orders_select" ON payment_orders FOR SELECT
  USING (tenant_id = auth_tenant_id());
