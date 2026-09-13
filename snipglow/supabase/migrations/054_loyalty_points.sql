-- =============================================================================
-- 054_loyalty_points.sql
-- Customer loyalty POINTS feature (distinct from the visit-based loyalty TIER
-- in src/lib/loyalty.ts, which is unrelated and stays as-is).
--
-- MODEL (all rates configurable per tenant in tenants.settings JSONB — no schema
-- lock-in, mirrors how discount/GST settings are stored):
--   loyalty_enabled        BOOLEAN  master on/off
--   loyalty_earn_rate      NUMERIC  points earned per ₹100 of a service bill
--   loyalty_redeem_value   NUMERIC  ₹ value of 1 point when redeemed (e.g. 1)
--   loyalty_welcome_bonus  INT      points granted on a customer's FIRST bill
--   loyalty_min_redeem     INT      min points redeemable in one bill (app-side)
--   loyalty_max_redeem_pct INT      max % of a bill payable by points (app-side)
--
-- WHY EACH CHANGE (mirrors the wallet blueprint in 042):
--  1. invoices.loyalty_points_redeemed / loyalty_amount
--       — how many points were spent on this bill and their ₹ value. The bill
--         subtotal/total still show the TRUE value; these only record the split,
--         exactly like wallet_amount.
--  2. customer_loyalty       — single source of truth for the current balance
--                              (CHECK >= 0, one row per customer) plus
--                              lifetime_points (never decreases; drives the tier).
--  3. loyalty_transactions   — append-only, signed ledger (+earn/+bonus,
--                              -redeem/-expire) with balance_after for audit and
--                              a partial UNIQUE(invoice_id,type) so a bill can
--                              never be double-earned or double-redeemed.
--  4. award_loyalty_points() — AFTER INSERT trigger that earns points on every
--                              'service' invoice (covers the billing page AND the
--                              appointment-completion path in one place). Reads
--                              the tenant's loyalty config from settings.
--  5. reverse_loyalty_on_invoice_delete() — BEFORE DELETE trigger that undoes any
--                              earn/redeem tied to an invoice, so a rolled-back
--                              bill (wallet/redeem failure in createInvoice)
--                              leaves no orphaned points.
--  6. loyalty_redeem_for_invoice() — ATOMIC, row-locked redemption that rejects
--                              overdraw/over-total and prevents double-redeem.
--  7. loyalty_adjust()       — manual owner/manager credit or debit (bonuses,
--                              corrections), also atomic + row-locked.
--
-- Backward compatible & idempotent: existing invoices default the new columns to
-- 0; existing customers have no loyalty row (treated as 0 points); the feature is
-- inert until a tenant flips loyalty_enabled on.
-- =============================================================================

-- 1. Extend invoices ----------------------------------------------------------
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS loyalty_points_redeemed INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS loyalty_amount NUMERIC(10,2) NOT NULL DEFAULT 0;

-- 2. customer_loyalty ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS customer_loyalty (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  points_balance INT NOT NULL DEFAULT 0,
  lifetime_points INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT customer_loyalty_balance_nonneg CHECK (points_balance >= 0),
  CONSTRAINT customer_loyalty_lifetime_nonneg CHECK (lifetime_points >= 0),
  CONSTRAINT customer_loyalty_customer_unique UNIQUE (customer_id)
);

CREATE INDEX IF NOT EXISTS idx_customer_loyalty_tenant ON customer_loyalty(tenant_id);
CREATE INDEX IF NOT EXISTS idx_customer_loyalty_branch ON customer_loyalty(branch_id);
CREATE INDEX IF NOT EXISTS idx_customer_loyalty_customer ON customer_loyalty(customer_id);

-- 3. loyalty_transactions (signed ledger) -------------------------------------
CREATE TABLE IF NOT EXISTS loyalty_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN ('earn', 'redeem', 'bonus', 'adjustment', 'expire')),
  points INT NOT NULL CHECK (points <> 0),
  balance_after INT NOT NULL,
  description TEXT,
  created_by UUID REFERENCES employees(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_loyalty_tx_tenant ON loyalty_transactions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_tx_branch ON loyalty_transactions(branch_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_tx_customer ON loyalty_transactions(customer_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_tx_invoice ON loyalty_transactions(invoice_id) WHERE invoice_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_loyalty_tx_created ON loyalty_transactions(created_at);
-- One earn row and one redeem row max per invoice — blocks double processing.
CREATE UNIQUE INDEX IF NOT EXISTS idx_loyalty_tx_invoice_type_unique
  ON loyalty_transactions(invoice_id, type) WHERE invoice_id IS NOT NULL;

-- RLS — read-only for tenant members; ALL writes go through the trigger and the
-- SECURITY DEFINER RPCs below (which run as owner and bypass RLS).
ALTER TABLE customer_loyalty ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "customer_loyalty_select" ON customer_loyalty;
CREATE POLICY "customer_loyalty_select" ON customer_loyalty FOR SELECT
  USING (tenant_id = auth_tenant_id());

DROP POLICY IF EXISTS "loyalty_transactions_select" ON loyalty_transactions;
CREATE POLICY "loyalty_transactions_select" ON loyalty_transactions FOR SELECT
  USING (tenant_id = auth_tenant_id());

-- 4. award_loyalty_points() — earn on every service bill ----------------------
-- Fires for ALL invoices but only acts on 'service' bills when loyalty is on, so
-- it covers the billing page and the appointment-completion path without any
-- app-side duplication. Wallet top-ups and membership sales never earn.
CREATE OR REPLACE FUNCTION award_loyalty_points()
RETURNS TRIGGER AS $$
DECLARE
  v_settings JSONB;
  v_earn_rate NUMERIC;
  v_welcome INT;
  v_points INT := 0;
  v_is_first BOOLEAN;
  v_new_balance INT;
BEGIN
  IF NEW.invoice_type <> 'service' THEN
    RETURN NEW;
  END IF;

  SELECT settings INTO v_settings FROM tenants WHERE id = NEW.tenant_id;
  IF NOT COALESCE((v_settings->>'loyalty_enabled')::boolean, false) THEN
    RETURN NEW;
  END IF;

  v_earn_rate := COALESCE(NULLIF(v_settings->>'loyalty_earn_rate', '')::numeric, 0);
  v_welcome := COALESCE(NULLIF(v_settings->>'loyalty_welcome_bonus', '')::int, 0);

  -- Points from spend: earn_rate points per ₹100 of the bill total.
  v_points := floor(NEW.total / 100.0 * v_earn_rate)::int;

  -- Welcome bonus on the customer's very first service bill (order-independent:
  -- checks prior invoices, not the visit counter which another trigger updates).
  v_is_first := NOT EXISTS (
    SELECT 1 FROM invoices
    WHERE customer_id = NEW.customer_id AND invoice_type = 'service' AND id <> NEW.id
  );
  IF v_is_first THEN
    v_points := v_points + GREATEST(v_welcome, 0);
  END IF;

  IF v_points <= 0 THEN
    RETURN NEW;
  END IF;

  INSERT INTO customer_loyalty (tenant_id, branch_id, customer_id, points_balance, lifetime_points)
  VALUES (NEW.tenant_id, NEW.branch_id, NEW.customer_id, v_points, v_points)
  ON CONFLICT (customer_id)
  DO UPDATE SET points_balance = customer_loyalty.points_balance + EXCLUDED.points_balance,
                lifetime_points = customer_loyalty.lifetime_points + EXCLUDED.lifetime_points,
                updated_at = now()
  RETURNING points_balance INTO v_new_balance;

  INSERT INTO loyalty_transactions (
    tenant_id, branch_id, customer_id, invoice_id, type, points, balance_after, description
  ) VALUES (
    NEW.tenant_id, NEW.branch_id, NEW.customer_id, NEW.id, 'earn', v_points, v_new_balance,
    CASE WHEN v_is_first AND v_welcome > 0 THEN 'Points earned + welcome bonus' ELSE 'Points earned' END
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_award_loyalty_points ON invoices;
CREATE TRIGGER trg_award_loyalty_points
  AFTER INSERT ON invoices
  FOR EACH ROW EXECUTE FUNCTION award_loyalty_points();

-- 5. reverse_loyalty_on_invoice_delete() — undo points if a bill is rolled back
-- createInvoice deletes an invoice when a wallet/loyalty debit fails. This BEFORE
-- DELETE trigger reverses any earn/redeem tied to the invoice (the rows are still
-- linked at BEFORE DELETE, before the ON DELETE SET NULL fires), so no points are
-- left stranded. Reversing +earn subtracts; reversing -redeem adds back.
CREATE OR REPLACE FUNCTION reverse_loyalty_on_invoice_delete()
RETURNS TRIGGER AS $$
DECLARE
  v_tx RECORD;
BEGIN
  FOR v_tx IN SELECT * FROM loyalty_transactions WHERE invoice_id = OLD.id LOOP
    UPDATE customer_loyalty
      SET points_balance = GREATEST(points_balance - v_tx.points, 0),
          lifetime_points = CASE WHEN v_tx.points > 0
                                 THEN GREATEST(lifetime_points - v_tx.points, 0)
                                 ELSE lifetime_points END,
          updated_at = now()
      WHERE customer_id = OLD.customer_id;
    DELETE FROM loyalty_transactions WHERE id = v_tx.id;
  END LOOP;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_reverse_loyalty_on_invoice_delete ON invoices;
CREATE TRIGGER trg_reverse_loyalty_on_invoice_delete
  BEFORE DELETE ON invoices
  FOR EACH ROW EXECUTE FUNCTION reverse_loyalty_on_invoice_delete();

-- 6. loyalty_redeem_for_invoice() — atomic, row-locked redemption -------------
CREATE OR REPLACE FUNCTION loyalty_redeem_for_invoice(
  p_invoice_id UUID,
  p_points INT
) RETURNS JSONB AS $$
DECLARE
  v_tenant UUID := auth_tenant_id();
  v_role TEXT := auth_user_role();
  v_emp UUID;
  v_inv RECORD;
  v_settings JSONB;
  v_redeem_value NUMERIC;
  v_balance INT;
  v_new_balance INT;
  v_amount NUMERIC(10,2);
BEGIN
  IF v_tenant IS NULL THEN RAISE EXCEPTION 'NO_TENANT'; END IF;
  IF v_role IS NULL OR v_role NOT IN ('owner', 'manager') THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  IF p_points IS NULL OR p_points <= 0 THEN RAISE EXCEPTION 'INVALID_POINTS'; END IF;

  SELECT id, tenant_id, branch_id, customer_id, total INTO v_inv FROM invoices WHERE id = p_invoice_id;
  IF NOT FOUND OR v_inv.tenant_id <> v_tenant THEN RAISE EXCEPTION 'INVOICE_NOT_FOUND'; END IF;

  SELECT settings INTO v_settings FROM tenants WHERE id = v_tenant;
  v_redeem_value := COALESCE(NULLIF(v_settings->>'loyalty_redeem_value', '')::numeric, 1);
  IF v_redeem_value <= 0 THEN v_redeem_value := 1; END IF;

  v_amount := round((p_points * v_redeem_value)::numeric, 2);
  IF v_amount > v_inv.total THEN RAISE EXCEPTION 'AMOUNT_EXCEEDS_TOTAL'; END IF;

  SELECT id INTO v_emp FROM employees WHERE auth_user_id = auth.uid() LIMIT 1;

  -- Lock the loyalty row so concurrent bills can't both spend the same points.
  SELECT points_balance INTO v_balance FROM customer_loyalty WHERE customer_id = v_inv.customer_id FOR UPDATE;
  IF NOT FOUND THEN v_balance := 0; END IF;
  IF v_balance < p_points THEN RAISE EXCEPTION 'INSUFFICIENT_POINTS'; END IF;

  v_new_balance := v_balance - p_points;
  UPDATE customer_loyalty SET points_balance = v_new_balance, updated_at = now() WHERE customer_id = v_inv.customer_id;

  -- UNIQUE(invoice_id,type) makes a duplicate redeem for the same invoice fail here.
  INSERT INTO loyalty_transactions (
    tenant_id, branch_id, customer_id, invoice_id, type, points, balance_after, description, created_by
  ) VALUES (
    v_tenant, v_inv.branch_id, v_inv.customer_id, v_inv.id, 'redeem', -p_points, v_new_balance,
    'Points redeemed on invoice', v_emp
  );

  UPDATE invoices SET loyalty_points_redeemed = p_points, loyalty_amount = v_amount WHERE id = v_inv.id;

  RETURN jsonb_build_object('balance', v_new_balance, 'points_redeemed', p_points, 'loyalty_amount', v_amount);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. loyalty_adjust() — manual credit/debit by owner/manager ------------------
CREATE OR REPLACE FUNCTION loyalty_adjust(
  p_customer_id UUID,
  p_points INT,
  p_reason TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_tenant UUID := auth_tenant_id();
  v_role TEXT := auth_user_role();
  v_branch UUID := auth_branch_id();
  v_emp UUID;
  v_cust RECORD;
  v_balance INT;
  v_new_balance INT;
BEGIN
  IF v_tenant IS NULL THEN RAISE EXCEPTION 'NO_TENANT'; END IF;
  IF v_role IS NULL OR v_role NOT IN ('owner', 'manager') THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  IF p_points IS NULL OR p_points = 0 THEN RAISE EXCEPTION 'INVALID_POINTS'; END IF;

  SELECT id, tenant_id, branch_id INTO v_cust FROM customers WHERE id = p_customer_id;
  IF NOT FOUND OR v_cust.tenant_id <> v_tenant THEN RAISE EXCEPTION 'CUSTOMER_NOT_FOUND'; END IF;

  SELECT id INTO v_emp FROM employees WHERE auth_user_id = auth.uid() LIMIT 1;

  SELECT points_balance INTO v_balance FROM customer_loyalty WHERE customer_id = p_customer_id FOR UPDATE;
  IF NOT FOUND THEN v_balance := 0; END IF;

  v_new_balance := v_balance + p_points;
  IF v_new_balance < 0 THEN RAISE EXCEPTION 'INSUFFICIENT_POINTS'; END IF;

  INSERT INTO customer_loyalty (tenant_id, branch_id, customer_id, points_balance, lifetime_points)
  VALUES (v_tenant, COALESCE(v_branch, v_cust.branch_id), p_customer_id, GREATEST(p_points, 0), GREATEST(p_points, 0))
  ON CONFLICT (customer_id)
  DO UPDATE SET points_balance = v_new_balance,
                lifetime_points = customer_loyalty.lifetime_points + GREATEST(p_points, 0),
                updated_at = now();

  INSERT INTO loyalty_transactions (
    tenant_id, branch_id, customer_id, invoice_id, type, points, balance_after, description, created_by
  ) VALUES (
    v_tenant, COALESCE(v_branch, v_cust.branch_id), p_customer_id, NULL,
    CASE WHEN p_points > 0 THEN 'bonus' ELSE 'adjustment' END,
    p_points, v_new_balance, COALESCE(NULLIF(p_reason, ''), 'Manual adjustment'), v_emp
  );

  RETURN jsonb_build_object('balance', v_new_balance);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION loyalty_redeem_for_invoice(UUID, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION loyalty_adjust(UUID, INT, TEXT) TO authenticated;
