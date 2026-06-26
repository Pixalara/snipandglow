-- =============================================================================
-- 042_customer_wallet.sql
-- Customer wallet (prepaid balance) feature.
--
-- WHY EACH CHANGE:
--  1. invoices.invoice_type      — distinguishes a wallet top-up ('wallet_recharge')
--                                   from a normal sale ('service'). Needed so a
--                                   recharge is NOT double-counted as service
--                                   revenue and does NOT inflate customer stats.
--  2. invoices.wallet_amount     — the portion of a normal bill that was paid
--                                   FROM the customer's wallet. The invoice
--                                   subtotal/total still show the true bill value;
--                                   this only records how much came from wallet.
--                                   We deliberately do NOT touch the existing
--                                   payment_method CHECK ('cash','upi','card') —
--                                   the external method stays as-is (least risky).
--  3. customer_wallets           — single source of truth for current balance,
--                                   with a DB-level CHECK (balance >= 0) so it can
--                                   never go negative.
--  4. wallet_transactions        — append-only ledger (credit/debit/refund/
--                                   adjustment) with balance_after for audit.
--  5. update_customer_stats()    — patched to skip wallet_recharge invoices.
--  6. wallet_recharge() RPC      — ATOMIC top-up: invoice + item + credit + balance
--                                   update in one transaction (SECURITY DEFINER).
--  7. wallet_debit_for_invoice() — ATOMIC, row-locked debit that rejects overdraw
--                                   and prevents double-debit per invoice.
--
-- Backward compatible: existing invoices default invoice_type='service',
-- wallet_amount=0; existing customers have no wallet row (treated as balance 0).
-- =============================================================================

-- 1 + 2. Extend invoices --------------------------------------------------------
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS invoice_type TEXT NOT NULL DEFAULT 'service'
    CHECK (invoice_type IN ('service', 'wallet_recharge')),
  ADD COLUMN IF NOT EXISTS wallet_amount NUMERIC(10,2) NOT NULL DEFAULT 0;

-- 3. customer_wallets -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS customer_wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  balance NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT customer_wallets_balance_nonneg CHECK (balance >= 0),
  CONSTRAINT customer_wallets_customer_unique UNIQUE (customer_id)
);

CREATE INDEX IF NOT EXISTS idx_customer_wallets_tenant ON customer_wallets(tenant_id);
CREATE INDEX IF NOT EXISTS idx_customer_wallets_branch ON customer_wallets(branch_id);
CREATE INDEX IF NOT EXISTS idx_customer_wallets_customer ON customer_wallets(customer_id);

-- 4. wallet_transactions (ledger) ----------------------------------------------
CREATE TABLE IF NOT EXISTS wallet_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN ('credit', 'debit', 'refund', 'adjustment')),
  amount NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  balance_after NUMERIC(10,2) NOT NULL,
  description TEXT,
  created_by UUID REFERENCES employees(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wallet_tx_tenant ON wallet_transactions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_wallet_tx_branch ON wallet_transactions(branch_id);
CREATE INDEX IF NOT EXISTS idx_wallet_tx_customer ON wallet_transactions(customer_id);
CREATE INDEX IF NOT EXISTS idx_wallet_tx_invoice ON wallet_transactions(invoice_id) WHERE invoice_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_wallet_tx_created ON wallet_transactions(created_at);
-- Prevents a retry/duplicate-submit from crediting OR debiting the same invoice twice.
CREATE UNIQUE INDEX IF NOT EXISTS idx_wallet_tx_invoice_type_unique
  ON wallet_transactions(invoice_id, type) WHERE invoice_id IS NOT NULL;

-- RLS — read-only for tenant members; ALL writes happen through the SECURITY
-- DEFINER RPCs below (which bypass RLS but still validate the caller's tenant).
ALTER TABLE customer_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "customer_wallets_select" ON customer_wallets;
CREATE POLICY "customer_wallets_select" ON customer_wallets FOR SELECT
  USING (tenant_id = auth_tenant_id());

DROP POLICY IF EXISTS "wallet_transactions_select" ON wallet_transactions;
CREATE POLICY "wallet_transactions_select" ON wallet_transactions FOR SELECT
  USING (tenant_id = auth_tenant_id());

-- 5. Patch customer-stats trigger so wallet top-ups don't count as spend/visits.
CREATE OR REPLACE FUNCTION update_customer_stats()
RETURNS TRIGGER AS $$
BEGIN
  -- A wallet recharge is a prepaid deposit, not a visit or a sale.
  IF NEW.invoice_type = 'wallet_recharge' THEN
    RETURN NEW;
  END IF;

  UPDATE customers
  SET
    total_visits = total_visits + 1,
    total_spent = total_spent + NEW.total,
    last_visit_at = NEW.created_at
  WHERE id = NEW.customer_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 6. wallet_recharge() — atomic top-up -----------------------------------------
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
BEGIN
  IF v_tenant IS NULL THEN RAISE EXCEPTION 'NO_TENANT'; END IF;
  IF v_role IS NULL OR v_role NOT IN ('owner', 'manager') THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION 'INVALID_AMOUNT'; END IF;
  IF p_payment_method NOT IN ('cash', 'upi', 'card') THEN RAISE EXCEPTION 'INVALID_PAYMENT_METHOD'; END IF;

  SELECT id, tenant_id, branch_id INTO v_cust FROM customers WHERE id = p_customer_id;
  IF NOT FOUND OR v_cust.tenant_id <> v_tenant THEN RAISE EXCEPTION 'CUSTOMER_NOT_FOUND'; END IF;

  SELECT id INTO v_emp FROM employees WHERE auth_user_id = auth.uid() LIMIT 1;

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

-- 7. wallet_debit_for_invoice() — atomic, row-locked, no overdraw ---------------
CREATE OR REPLACE FUNCTION wallet_debit_for_invoice(
  p_invoice_id UUID,
  p_amount NUMERIC
) RETURNS JSONB AS $$
DECLARE
  v_tenant UUID := auth_tenant_id();
  v_role TEXT := auth_user_role();
  v_emp UUID;
  v_inv RECORD;
  v_balance NUMERIC(10,2);
  v_new_balance NUMERIC(10,2);
BEGIN
  IF v_tenant IS NULL THEN RAISE EXCEPTION 'NO_TENANT'; END IF;
  IF v_role IS NULL OR v_role NOT IN ('owner', 'manager') THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION 'INVALID_AMOUNT'; END IF;

  SELECT id, tenant_id, branch_id, customer_id, total INTO v_inv FROM invoices WHERE id = p_invoice_id;
  IF NOT FOUND OR v_inv.tenant_id <> v_tenant THEN RAISE EXCEPTION 'INVOICE_NOT_FOUND'; END IF;
  IF p_amount > v_inv.total THEN RAISE EXCEPTION 'AMOUNT_EXCEEDS_TOTAL'; END IF;

  SELECT id INTO v_emp FROM employees WHERE auth_user_id = auth.uid() LIMIT 1;

  -- Lock the wallet row so concurrent bills can't both spend the same balance.
  SELECT balance INTO v_balance FROM customer_wallets WHERE customer_id = v_inv.customer_id FOR UPDATE;
  IF NOT FOUND THEN v_balance := 0; END IF;
  IF v_balance < p_amount THEN RAISE EXCEPTION 'INSUFFICIENT_WALLET_BALANCE'; END IF;

  v_new_balance := v_balance - p_amount;
  UPDATE customer_wallets SET balance = v_new_balance, updated_at = now() WHERE customer_id = v_inv.customer_id;

  -- UNIQUE(invoice_id,type) makes a duplicate debit for the same invoice fail here.
  INSERT INTO wallet_transactions (
    tenant_id, branch_id, customer_id, invoice_id, type, amount, balance_after, description, created_by
  ) VALUES (
    v_tenant, v_inv.branch_id, v_inv.customer_id, v_inv.id, 'debit', p_amount, v_new_balance,
    'Wallet payment for invoice', v_emp
  );

  UPDATE invoices SET wallet_amount = p_amount WHERE id = v_inv.id;

  RETURN jsonb_build_object('balance', v_new_balance, 'wallet_amount', p_amount);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION wallet_recharge(UUID, NUMERIC, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION wallet_debit_for_invoice(UUID, NUMERIC) TO authenticated;
