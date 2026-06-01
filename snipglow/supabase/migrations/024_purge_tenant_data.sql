-- =============================================================================
-- Migration 024: Purge Tenant Data (explicit child deletes)
-- Fixes the flaw in delete_tenant_data (017) where session_replication_role =
-- 'replica' disabled the ON DELETE CASCADE triggers, leaving orphaned child
-- rows after the tenant row was deleted.
--
-- This version EXPLICITLY deletes every child table by tenant_id (and join
-- tables by their parent id) in FK-safe order, with triggers disabled so the
-- audit-log trigger and FK checks don't block the wipe. Works even when the
-- tenant row is already gone (cleans orphans).
-- =============================================================================

CREATE OR REPLACE FUNCTION purge_tenant_data(target_tenant_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  auth_user_ids UUID[];
  uid UUID;
  cust_ids UUID[];
  appt_ids UUID[];
  invoice_ids UUID[];
BEGIN
  -- Collect auth users tied to this tenant's employees (only those NOT linked
  -- to any other surviving tenant, to avoid logging out multi-salon owners)
  SELECT ARRAY_AGG(e.auth_user_id)
  INTO auth_user_ids
  FROM employees e
  WHERE e.tenant_id = target_tenant_id
    AND e.auth_user_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM employees e2
      WHERE e2.auth_user_id = e.auth_user_id
        AND e2.tenant_id <> target_tenant_id
    );

  -- Collect child ids needed for join-table deletes
  SELECT ARRAY_AGG(id) INTO cust_ids FROM customers WHERE tenant_id = target_tenant_id;
  SELECT ARRAY_AGG(id) INTO appt_ids FROM appointments WHERE tenant_id = target_tenant_id;
  SELECT ARRAY_AGG(id) INTO invoice_ids FROM invoices WHERE tenant_id = target_tenant_id;

  -- Disable triggers + FK checks for a clean wipe
  SET session_replication_role = 'replica';

  -- Join / grandchild tables first
  IF invoice_ids IS NOT NULL THEN
    DELETE FROM invoice_items WHERE invoice_id = ANY(invoice_ids);
  END IF;

  -- Tenant-scoped children
  DELETE FROM invoices WHERE tenant_id = target_tenant_id;
  DELETE FROM customer_memberships WHERE tenant_id = target_tenant_id;
  DELETE FROM memberships WHERE tenant_id = target_tenant_id;
  DELETE FROM feedback WHERE tenant_id = target_tenant_id;
  DELETE FROM whatsapp_customer_sessions WHERE tenant_id = target_tenant_id;
  DELETE FROM whatsapp_sessions WHERE tenant_id = target_tenant_id;
  DELETE FROM support_tickets WHERE tenant_id = target_tenant_id;
  DELETE FROM tenant_whatsapp_settings WHERE tenant_id = target_tenant_id;
  DELETE FROM analytics_snapshots WHERE tenant_id = target_tenant_id;
  DELETE FROM appointments WHERE tenant_id = target_tenant_id;
  DELETE FROM leads WHERE tenant_id = target_tenant_id;
  DELETE FROM payroll WHERE tenant_id = target_tenant_id;
  DELETE FROM expenses WHERE tenant_id = target_tenant_id;
  DELETE FROM audit_logs WHERE tenant_id = target_tenant_id;
  DELETE FROM services WHERE tenant_id = target_tenant_id;
  DELETE FROM customers WHERE tenant_id = target_tenant_id;
  DELETE FROM employees WHERE tenant_id = target_tenant_id;
  DELETE FROM branches WHERE tenant_id = target_tenant_id;

  -- The tenant row itself (may already be gone — harmless)
  DELETE FROM tenants WHERE id = target_tenant_id;

  -- Orphaned auth users tied only to this tenant
  IF auth_user_ids IS NOT NULL THEN
    FOREACH uid IN ARRAY auth_user_ids
    LOOP
      DELETE FROM auth.users WHERE id = uid;
    END LOOP;
  END IF;

  SET session_replication_role = 'origin';

  RETURN jsonb_build_object(
    'status', 'purged',
    'tenant_id', target_tenant_id,
    'auth_users_deleted', COALESCE(array_length(auth_user_ids, 1), 0),
    'customers', COALESCE(array_length(cust_ids, 1), 0),
    'appointments', COALESCE(array_length(appt_ids, 1), 0),
    'invoices', COALESCE(array_length(invoice_ids, 1), 0)
  );
EXCEPTION WHEN OTHERS THEN
  -- Always re-enable triggers even if something fails
  SET session_replication_role = 'origin';
  RAISE;
END;
$$;

REVOKE ALL ON FUNCTION purge_tenant_data(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION purge_tenant_data(UUID) FROM anon;
REVOKE ALL ON FUNCTION purge_tenant_data(UUID) FROM authenticated;
GRANT EXECUTE ON FUNCTION purge_tenant_data(UUID) TO service_role;
