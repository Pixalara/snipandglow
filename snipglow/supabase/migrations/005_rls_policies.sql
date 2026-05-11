-- Migration: 005_rls_policies.sql
-- Purpose: Enable RLS on all tables and create tenant isolation + role-based access policies
-- Requirements: 1.1, 1.3, 1.4, 2.5, 2.6, 2.7

-- ============================================================
-- HELPER FUNCTIONS: Extract JWT claims for RLS policies
-- ============================================================

-- Get tenant_id from JWT
CREATE OR REPLACE FUNCTION auth_tenant_id() RETURNS UUID AS $$
  SELECT COALESCE(
    (auth.jwt() -> 'user_metadata' ->> 'tenant_id')::UUID,
    (SELECT tenant_id FROM employees WHERE auth_user_id = auth.uid() LIMIT 1)
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Get role from JWT
CREATE OR REPLACE FUNCTION auth_user_role() RETURNS TEXT AS $$
  SELECT COALESCE(
    auth.jwt() -> 'user_metadata' ->> 'role',
    (SELECT role FROM employees WHERE auth_user_id = auth.uid() LIMIT 1)
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Get branch_id from JWT
CREATE OR REPLACE FUNCTION auth_branch_id() RETURNS UUID AS $$
  SELECT COALESCE(
    (auth.jwt() -> 'user_metadata' ->> 'branch_id')::UUID,
    (SELECT branch_id FROM employees WHERE auth_user_id = auth.uid() LIMIT 1)
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================================
-- ENABLE RLS ON ALL TABLES
-- ============================================================

ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE otp_codes ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- TENANTS: Owner can read their own tenant
-- ============================================================

CREATE POLICY "tenants_select" ON tenants FOR SELECT USING (id = auth_tenant_id());
CREATE POLICY "tenants_update" ON tenants FOR UPDATE USING (id = auth_tenant_id() AND auth_user_role() = 'owner');

-- ============================================================
-- BRANCHES: Owner sees all branches in tenant, manager/staff see only their branch
-- ============================================================

CREATE POLICY "branches_select" ON branches FOR SELECT USING (
  tenant_id = auth_tenant_id() AND (auth_user_role() = 'owner' OR id = auth_branch_id())
);
CREATE POLICY "branches_insert" ON branches FOR INSERT WITH CHECK (tenant_id = auth_tenant_id() AND auth_user_role() = 'owner');
CREATE POLICY "branches_update" ON branches FOR UPDATE USING (tenant_id = auth_tenant_id() AND auth_user_role() = 'owner');

-- ============================================================
-- EMPLOYEES: Owner sees all, manager/staff see their branch
-- ============================================================

CREATE POLICY "employees_select" ON employees FOR SELECT USING (
  tenant_id = auth_tenant_id() AND (auth_user_role() = 'owner' OR branch_id = auth_branch_id())
);
CREATE POLICY "employees_insert" ON employees FOR INSERT WITH CHECK (tenant_id = auth_tenant_id() AND auth_user_role() = 'owner');
CREATE POLICY "employees_update" ON employees FOR UPDATE USING (tenant_id = auth_tenant_id() AND auth_user_role() = 'owner');

-- ============================================================
-- CUSTOMERS: Owner sees all, manager/staff see their branch. Owner/manager can write.
-- ============================================================

CREATE POLICY "customers_select" ON customers FOR SELECT USING (
  tenant_id = auth_tenant_id() AND (auth_user_role() = 'owner' OR branch_id = auth_branch_id())
);
CREATE POLICY "customers_insert" ON customers FOR INSERT WITH CHECK (
  tenant_id = auth_tenant_id() AND auth_user_role() IN ('owner', 'manager')
);
CREATE POLICY "customers_update" ON customers FOR UPDATE USING (
  tenant_id = auth_tenant_id() AND auth_user_role() IN ('owner', 'manager')
);
CREATE POLICY "customers_delete" ON customers FOR DELETE USING (
  tenant_id = auth_tenant_id() AND auth_user_role() = 'owner'
);

-- ============================================================
-- SERVICES: Owner sees all, others see their branch or tenant-wide (branch_id IS NULL). Owner/manager can write.
-- ============================================================

CREATE POLICY "services_select" ON services FOR SELECT USING (
  tenant_id = auth_tenant_id() AND (auth_user_role() = 'owner' OR branch_id = auth_branch_id() OR branch_id IS NULL)
);
CREATE POLICY "services_insert" ON services FOR INSERT WITH CHECK (
  tenant_id = auth_tenant_id() AND auth_user_role() IN ('owner', 'manager')
);
CREATE POLICY "services_update" ON services FOR UPDATE USING (
  tenant_id = auth_tenant_id() AND auth_user_role() IN ('owner', 'manager')
);

-- ============================================================
-- APPOINTMENTS: Owner sees all, manager/staff see their branch
-- ============================================================

CREATE POLICY "appointments_select" ON appointments FOR SELECT USING (
  tenant_id = auth_tenant_id() AND (auth_user_role() = 'owner' OR branch_id = auth_branch_id())
);
CREATE POLICY "appointments_insert" ON appointments FOR INSERT WITH CHECK (
  tenant_id = auth_tenant_id() AND auth_user_role() IN ('owner', 'manager')
);
CREATE POLICY "appointments_update" ON appointments FOR UPDATE USING (
  tenant_id = auth_tenant_id() AND auth_user_role() IN ('owner', 'manager')
);

-- ============================================================
-- INVOICES: Owner sees all, manager sees their branch. Owner/manager can write.
-- ============================================================

CREATE POLICY "invoices_select" ON invoices FOR SELECT USING (
  tenant_id = auth_tenant_id() AND (auth_user_role() = 'owner' OR branch_id = auth_branch_id())
);
CREATE POLICY "invoices_insert" ON invoices FOR INSERT WITH CHECK (
  tenant_id = auth_tenant_id() AND auth_user_role() IN ('owner', 'manager')
);

-- ============================================================
-- INVOICE_ITEMS: Access through invoice (join-based)
-- ============================================================

CREATE POLICY "invoice_items_select" ON invoice_items FOR SELECT USING (
  EXISTS (SELECT 1 FROM invoices WHERE invoices.id = invoice_items.invoice_id AND invoices.tenant_id = auth_tenant_id())
);
CREATE POLICY "invoice_items_insert" ON invoice_items FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM invoices WHERE invoices.id = invoice_items.invoice_id AND invoices.tenant_id = auth_tenant_id())
);

-- ============================================================
-- MEMBERSHIPS: Owner sees all, others see their branch or tenant-wide (branch_id IS NULL)
-- ============================================================

CREATE POLICY "memberships_select" ON memberships FOR SELECT USING (
  tenant_id = auth_tenant_id() AND (auth_user_role() = 'owner' OR branch_id = auth_branch_id() OR branch_id IS NULL)
);
CREATE POLICY "memberships_insert" ON memberships FOR INSERT WITH CHECK (tenant_id = auth_tenant_id() AND auth_user_role() = 'owner');
CREATE POLICY "memberships_update" ON memberships FOR UPDATE USING (tenant_id = auth_tenant_id() AND auth_user_role() = 'owner');

-- ============================================================
-- CUSTOMER_MEMBERSHIPS: Same as customers scope
-- ============================================================

CREATE POLICY "customer_memberships_select" ON customer_memberships FOR SELECT USING (
  tenant_id = auth_tenant_id() AND (auth_user_role() = 'owner' OR branch_id = auth_branch_id())
);
CREATE POLICY "customer_memberships_insert" ON customer_memberships FOR INSERT WITH CHECK (
  tenant_id = auth_tenant_id() AND auth_user_role() IN ('owner', 'manager')
);

-- ============================================================
-- WHATSAPP_SESSIONS: Owner sees all, others see their branch
-- ============================================================

CREATE POLICY "whatsapp_sessions_select" ON whatsapp_sessions FOR SELECT USING (
  tenant_id = auth_tenant_id() AND (auth_user_role() = 'owner' OR branch_id = auth_branch_id())
);
CREATE POLICY "whatsapp_sessions_insert" ON whatsapp_sessions FOR INSERT WITH CHECK (tenant_id = auth_tenant_id());

-- ============================================================
-- AUDIT_LOGS: Owner only
-- ============================================================

CREATE POLICY "audit_logs_select" ON audit_logs FOR SELECT USING (
  tenant_id = auth_tenant_id() AND auth_user_role() = 'owner'
);

-- ============================================================
-- ANALYTICS_SNAPSHOTS: Owner sees all, manager sees their branch
-- ============================================================

CREATE POLICY "analytics_select" ON analytics_snapshots FOR SELECT USING (
  tenant_id = auth_tenant_id() AND (auth_user_role() = 'owner' OR branch_id = auth_branch_id())
);

-- ============================================================
-- OTP_CODES: Accessed by Edge Functions using service_role key, no user-facing policies needed
-- But we still enable RLS for safety
-- ============================================================

CREATE POLICY "otp_codes_service_role" ON otp_codes FOR ALL USING (true);
