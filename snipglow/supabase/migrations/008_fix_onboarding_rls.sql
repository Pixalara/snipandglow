-- Migration: 008_fix_onboarding_rls.sql
-- Purpose: Allow authenticated users to create tenants during onboarding
-- Problem: New users have no tenant_id in JWT yet, so auth_tenant_id() returns NULL
--          and all INSERT policies fail during the onboarding flow.

-- ============================================================
-- TENANTS: Allow any authenticated user to INSERT a new tenant (onboarding)
-- ============================================================

CREATE POLICY "tenants_insert" ON tenants FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- ============================================================
-- BRANCHES: Allow insert when user is authenticated and has no tenant yet
-- (covers onboarding before JWT metadata is updated)
-- ============================================================

DROP POLICY IF EXISTS "branches_insert" ON branches;
CREATE POLICY "branches_insert" ON branches FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND (
      -- Normal case: user already has tenant context
      (tenant_id = auth_tenant_id() AND auth_user_role() = 'owner')
      -- Onboarding case: user just created the tenant but JWT not refreshed yet
      OR (auth_tenant_id() IS NULL)
    )
  );

-- ============================================================
-- EMPLOYEES: Allow insert during onboarding
-- ============================================================

DROP POLICY IF EXISTS "employees_insert" ON employees;
CREATE POLICY "employees_insert" ON employees FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND (
      (tenant_id = auth_tenant_id() AND auth_user_role() = 'owner')
      OR (auth_tenant_id() IS NULL)
    )
  );

-- ============================================================
-- SERVICES: Allow insert during onboarding
-- ============================================================

DROP POLICY IF EXISTS "services_insert" ON services;
CREATE POLICY "services_insert" ON services FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND (
      (tenant_id = auth_tenant_id() AND auth_user_role() IN ('owner', 'manager'))
      OR (auth_tenant_id() IS NULL)
    )
  );
