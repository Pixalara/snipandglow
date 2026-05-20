-- =============================================================================
-- Migration 017: Delete Tenant Data (Single-Shot)
-- Creates an RPC function to wipe all tenant data + auth users in one call
-- Must be called with service_role (admin) client
-- Uses session_replication_role = 'replica' to bypass all triggers/FK checks
-- =============================================================================

CREATE OR REPLACE FUNCTION delete_tenant_data(target_tenant_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  auth_user_ids UUID[];
  uid UUID;
  deleted_counts JSONB;
  expense_count INT;
  payroll_count INT;
  lead_count INT;
BEGIN
  -- Step 1: Collect all auth_user_ids linked to this tenant's employees
  SELECT ARRAY_AGG(auth_user_id) 
  INTO auth_user_ids
  FROM employees 
  WHERE tenant_id = target_tenant_id 
    AND auth_user_id IS NOT NULL;

  -- Step 2: Disable ALL triggers and FK checks (nuclear option)
  SET session_replication_role = 'replica';

  -- Step 3: Delete tables that DON'T have ON DELETE CASCADE from tenants
  DELETE FROM leads WHERE tenant_id = target_tenant_id;
  GET DIAGNOSTICS lead_count = ROW_COUNT;

  DELETE FROM payroll WHERE tenant_id = target_tenant_id;
  GET DIAGNOSTICS payroll_count = ROW_COUNT;

  DELETE FROM expenses WHERE tenant_id = target_tenant_id;
  GET DIAGNOSTICS expense_count = ROW_COUNT;

  -- Step 4: Delete audit_logs for this tenant (before tenant row goes)
  DELETE FROM audit_logs WHERE tenant_id = target_tenant_id;

  -- Step 5: Delete the tenant row (cascades branches, employees, customers,
  -- services, appointments, invoices, invoice_items, memberships,
  -- customer_memberships, whatsapp_sessions, analytics_snapshots,
  -- feedback, support_tickets, tenant_whatsapp_settings,
  -- whatsapp_customer_sessions)
  DELETE FROM tenants WHERE id = target_tenant_id;

  -- Step 6: Delete auth users from auth.users (while triggers still disabled)
  IF auth_user_ids IS NOT NULL THEN
    FOREACH uid IN ARRAY auth_user_ids
    LOOP
      DELETE FROM auth.users WHERE id = uid;
    END LOOP;
  END IF;

  -- Step 7: Re-enable all triggers and FK checks
  SET session_replication_role = 'origin';

  -- Return summary
  deleted_counts := jsonb_build_object(
    'tenant_id', target_tenant_id,
    'auth_users_deleted', COALESCE(array_length(auth_user_ids, 1), 0),
    'leads_deleted', lead_count,
    'payroll_deleted', payroll_count,
    'expenses_deleted', expense_count,
    'status', 'deleted'
  );

  RETURN deleted_counts;
END;
$$;

-- Grant execute to service_role only (admin operations)
REVOKE ALL ON FUNCTION delete_tenant_data(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION delete_tenant_data(UUID) FROM anon;
REVOKE ALL ON FUNCTION delete_tenant_data(UUID) FROM authenticated;
GRANT EXECUTE ON FUNCTION delete_tenant_data(UUID) TO service_role;
