-- =============================================================================
-- 043_wallet_annual_limit.sql
-- Cap wallet TOP-UPS at ₹50,000 per customer per Indian financial year
-- (1 April – 31 March). The cap is on money LOADED (credits), not the live
-- balance — spending the wallet does not free up the annual allowance.
--
-- Enforced inside wallet_recharge (SECURITY DEFINER, atomic). We lock the
-- customer's wallet row first so two concurrent top-ups can't both slip under
-- the limit. Only 'credit' transactions count toward the cap (refunds/
-- adjustments do not).
-- =============================================================================

CREATE OR REPLACE FUNCTION wallet_recharge(
  p_customer_id UUID,
  p_amount NUMERIC,
  p_payment_method TEXT,
  p_note TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_tenant UUID := auth_tenant_id();
  v_role TEXT := auth_user_role();
  v_branch UUID := auth_branch_id();
  v_emp UUID;
  v_cust RECORD;
  v_invoice RECORD;
  v_new_balance NUMERIC(10,2);
  v_annual_limit NUMERIC := 50000;     -- ₹50,000 per FY
  v_fy_start DATE;
  v_fy_loaded NUMERIC(12,2);
  v_ist_now TIMESTAMP := (now() AT TIME ZONE 'Asia/Kolkata');
BEGIN
  IF v_tenant IS NULL THEN RAISE EXCEPTION 'NO_TENANT'; END IF;
  IF v_role IS NULL OR v_role NOT IN ('owner', 'manager') THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION 'INVALID_AMOUNT'; END IF;
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

  -- Recharge invoice (invoice_number filled by trigger; customer_stats trigger skips it).
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

  RETURN jsonb_build_object(
    'invoice_id', v_invoice.id,
    'invoice_number', v_invoice.invoice_number,
    'balance', v_new_balance
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION wallet_recharge(UUID, NUMERIC, TEXT, TEXT) TO authenticated;
