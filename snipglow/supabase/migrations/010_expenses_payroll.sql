-- =============================================================================
-- Migration 010: Expenses & Payroll Tables
-- =============================================================================

-- Expense Tracker table
CREATE TABLE IF NOT EXISTS expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  branch_id UUID NOT NULL REFERENCES branches(id),
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_method TEXT DEFAULT 'cash',
  receipt_note TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "expenses_select" ON expenses FOR SELECT
  USING (tenant_id = auth_tenant_id());

CREATE POLICY "expenses_insert" ON expenses FOR INSERT
  WITH CHECK (tenant_id = auth_tenant_id() AND auth_user_role() IN ('owner', 'manager'));

CREATE POLICY "expenses_update" ON expenses FOR UPDATE
  USING (tenant_id = auth_tenant_id() AND auth_user_role() = 'owner');

CREATE POLICY "expenses_delete" ON expenses FOR DELETE
  USING (tenant_id = auth_tenant_id() AND auth_user_role() = 'owner');

-- Payroll table
CREATE TABLE IF NOT EXISTS payroll (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  branch_id UUID NOT NULL REFERENCES branches(id),
  employee_id UUID NOT NULL REFERENCES employees(id),
  month TEXT NOT NULL,
  base_salary NUMERIC(10,2) NOT NULL DEFAULT 0,
  bonus NUMERIC(10,2) DEFAULT 0,
  deductions NUMERIC(10,2) DEFAULT 0,
  net_salary NUMERIC(10,2) NOT NULL DEFAULT 0,
  payment_status TEXT DEFAULT 'pending',
  paid_date DATE,
  payment_method TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE payroll ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payroll_select" ON payroll FOR SELECT
  USING (tenant_id = auth_tenant_id() AND auth_user_role() = 'owner');

CREATE POLICY "payroll_insert" ON payroll FOR INSERT
  WITH CHECK (tenant_id = auth_tenant_id() AND auth_user_role() = 'owner');

CREATE POLICY "payroll_update" ON payroll FOR UPDATE
  USING (tenant_id = auth_tenant_id() AND auth_user_role() = 'owner');

-- Indexes
CREATE INDEX IF NOT EXISTS idx_expenses_tenant_branch ON expenses(tenant_id, branch_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date DESC);
CREATE INDEX IF NOT EXISTS idx_payroll_tenant_branch ON payroll(tenant_id, branch_id);
CREATE INDEX IF NOT EXISTS idx_payroll_month ON payroll(month);
CREATE INDEX IF NOT EXISTS idx_payroll_employee ON payroll(employee_id);
