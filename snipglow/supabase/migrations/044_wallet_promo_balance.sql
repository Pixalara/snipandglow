-- =============================================================================
-- 044_wallet_promo_balance.sql
-- Promotional (bonus) wallet balance on top-ups.
--
-- WHY: Some tenants reward customers who load a large advance by adding extra
-- bonus balance (e.g. customer pays ₹10,000, tenant gifts ₹2,000 → ₹12,000 in
-- the wallet). The bonus is NOT real money received by the tenant, so it must
-- be handled carefully:
--   • Wallet balance increases by (paid amount + promo amount).
--   • Only the PAID amount is real revenue-relevant money → it alone becomes
--     the recharge invoice total and the only thing that counts toward the
--     ₹50,000/FY top-up cap. The promo is a marketing gift and is unlimited.
--   • The promo is written to the ledger as a separate `promo` transaction so
--     the FY cap (which sums `type='credit'`) never counts it, and the audit
--     trail clearly shows the bonus.
--
-- When the customer later spends that balance on a service, it counts as
-- service revenue as usual — the ₹2,000 gift is the tenant's promotional cost.
-- Fully backward compatible: p_promo defaults to 0 (behaves exactly as before).
-- =============================================================================

-- Allow a dedicated 'promo' ledger entry type.
ALTER TABLE wallet_transactions DROP CONSTRAINT IF EXISTS wallet_transactions_type_check;
ALTER TABLE wallet_transactions
  ADD CONSTRAINT wallet_transactions_type_check
  CHECK (type IN ('credit', 'debit', 'refund', 'adjustment', 'promo'));

-- Replace the recharge RPC with a promo-aware version.
-- Drop the old 4-arg signature first (adding a parameter changes the signature).
DROP FUNCTION IF EXISTS wallet_recharge(UUID, NUMERIC, TEXT, TEXT);

CREATE OR REPLACE FUNCTION wallet_recharge(
  p_customer_id UUID,
  p_amount NUMERIC,
  p_payment_method TEXT,
  p_note TEXT DEFAULT NULL,
  p_promo NUMERIC DEFAULT 0
) RETURNS JSONB AS $$
DECLARE
  v_tenant UUID := auth_tenant_id();
  v_role TEXT := auth_user_role();
  v_branch UUID := auth_branch_id();
  v_emp UUID;
  v_cust RECORD;
  v_invoice RECORD;
  v_new_balance NUMERIC(10,2);
  v_promo NUMERIC(10,2) := COALESCE(p_promo, 0);
  v_annual_limit NUMERIC := 50000;     -- ₹50,000 per FY (paid money only)
  v_fy_start DATE;
  v_fy_loaded NUMERIC(12,2);
  v_ist_now TIMESTAMP := (now() AT TIME ZONE 'Asia/Kolkata');
BEGIN
  IF v_tenant IS NULL THEN RAISE EXCEPTION 'NO_TENANT'; END IF;
  IF v_role IS NULL OR v_role NOT IN ('owner', 'manager') THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION 'INVALID_AMOUNT'; END IF;
  IF v_promo < 0 THEN RAISE EXCEPTION 'INVALID_PROMO'; END IF;
  IF p_payment_method NOT IN ('cash', 'upi', 'card') THEN RAISE EXCEPTION 'INVALID_PAYMENT_METHOD'; END IF;

  SELECT id, tenant_id, branch_id INTO v_cust FROM customers WHERE id = p_customer_id;
  IF NOT FOUND OR v_cust.tenant_id <> v_tenant THEN RAISE EXCEPTION 'CUSTOMER_NOT_FOUND'; END IF;

  SELECT id INTO v_emp FROM employees WHERE auth_user_id = auth.uid() LIMIT 1;

  -- Lock the wallet row up front so concurrent top-ups serialise against the cap.
  PERFORM 1 FROM customer_wallets WHERE customer_id = p_customer_id FOR UPDATE;

  -- Indian financial year start (Apr–Mar), evaluated in IST.
  v_fy_start := CASE
    WHEN EXTRACT(MONTH FROM v_ist_now) >= 4
      THEN make_date(EXTRACT(YEAR FROM v_ist_now)::int, 4, 1)
    ELSE make_date(EXTRACT(YEAR FROM v_ist_now)::int - 1, 4, 1)
  END;

  -- Only real (paid) top-ups count toward the annual cap — promo is a gift.
  SELECT COALESCE(SUM(amount), 0) INTO v_fy_loaded
  FROM wallet_transactions
  WHERE customer_id = p_customer_id
    AND type = 'credit'
    AND (created_at AT TIME ZONE 'Asia/Kolkata')::date >= v_fy_start;

  IF v_fy_loaded + p_amount > v_annual_limit THEN
    RAISE EXCEPTION 'WALLET_LIMIT_EXCEEDED'
      USING DETAIL = format('loaded=%s,limit=%s,remaining=%s',
                            v_fy_loaded, v_annual_limit, v_annual_limit - v_fy_loaded);
  END IF;

  -- Recharge invoice records the PAID amount only (real money received).
  INSERT INTO invoices (
    tenant_id, branch_id, customer_id, invoice_number,
    subtotal, discount_amount, discount_pct, gst_amount, gst_rate, total,
    payment_method, payment_status, delivery_status, invoice_type, wallet_amount
  ) VALUES (
    v_tenant, COALESCE(v_branch, v_cust.branch_id), p_customer_id, '',
    p_amount, 0, 0, 0, 0, p_amount,
    p_payment_method, 'paid', 'pending', 'wallet_recharge', 0
  ) RETURNING id, invoice_number, branch_id INTO v_invoice;

  INSERT INTO invoice_items (
    invoice_id, service_id, product_id, item_type, service_name,
    unit_price, quantity, discount_pct, discount_amount, line_total
  ) VALUES (
    v_invoice.id, NULL, NULL, 'service', 'Wallet Recharge',
    p_amount, 1, 0, 0, p_amount
  );

  -- Credit the paid amount.
  INSERT INTO customer_wallets (tenant_id, branch_id, customer_id, balance)
  VALUES (v_tenant, v_invoice.branch_id, p_customer_id, p_amount)
  ON CONFLICT (customer_id)
  DO UPDATE SET balance = customer_wallets.balance + EXCLUDED.balance, updated_at = now()
  RETURNING balance INTO v_new_balance;

  INSERT INTO wallet_transactions (
    tenant_id, branch_id, customer_id, invoice_id, type, amount, balance_after, description, created_by
  ) VALUES (
    v_tenant, v_invoice.branch_id, p_customer_id, v_invoice.id, 'credit', p_amount, v_new_balance,
    COALESCE(NULLIF(p_note, ''), 'Wallet recharge'), v_emp
  );

  -- Add the promotional bonus (separate ledger row, not counted toward the cap).
  IF v_promo > 0 THEN
    UPDATE customer_wallets
    SET balance = balance + v_promo, updated_at = now()
    WHERE customer_id = p_customer_id
    RETURNING balance INTO v_new_balance;

    INSERT INTO wallet_transactions (
      tenant_id, branch_id, customer_id, invoice_id, type, amount, balance_after, description, created_by
    ) VALUES (
      v_tenant, v_invoice.branch_id, p_customer_id, v_invoice.id, 'promo', v_promo, v_new_balance,
      'Promotional bonus', v_emp
    );
  END IF;

  RETURN jsonb_build_object(
    'invoice_id', v_invoice.id,
    'invoice_number', v_invoice.invoice_number,
    'balance', v_new_balance,
    'paid', p_amount,
    'promo', v_promo
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION wallet_recharge(UUID, NUMERIC, TEXT, TEXT, NUMERIC) TO authenticated;
