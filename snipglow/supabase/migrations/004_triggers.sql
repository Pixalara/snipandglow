-- Migration: 004_triggers
-- Description: Create database triggers for invoice numbering, customer stats, and audit logging
-- Requirements: 17.3, 17.4, 17.5

-- =============================================================================
-- INVOICE NUMBER GENERATION TRIGGER
-- Auto-increment invoice number per branch (format: INV-BRA-0001)
-- Requirements: 17.3
-- =============================================================================
CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS TRIGGER AS $$
DECLARE
  branch_prefix TEXT;
  next_counter INT;
BEGIN
  -- Atomically increment the branch counter
  UPDATE branches
  SET invoice_counter = invoice_counter + 1
  WHERE id = NEW.branch_id
  RETURNING invoice_counter INTO next_counter;

  -- Get branch name abbreviation (first 3 chars uppercase)
  SELECT UPPER(LEFT(name, 3)) INTO branch_prefix
  FROM branches WHERE id = NEW.branch_id;

  NEW.invoice_number := 'INV-' || branch_prefix || '-' || LPAD(next_counter::TEXT, 4, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_invoice_number
  BEFORE INSERT ON invoices
  FOR EACH ROW
  WHEN (NEW.invoice_number IS NULL OR NEW.invoice_number = '')
  EXECUTE FUNCTION generate_invoice_number();

-- =============================================================================
-- CUSTOMER STATS UPDATE TRIGGER
-- Auto-update customer total_visits and total_spent on invoice creation
-- Requirements: 17.4
-- =============================================================================
CREATE OR REPLACE FUNCTION update_customer_stats()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE customers
  SET
    total_visits = total_visits + 1,
    total_spent = total_spent + NEW.total,
    last_visit_at = NEW.created_at
  WHERE id = NEW.customer_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_customer_stats
  AFTER INSERT ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION update_customer_stats();

-- =============================================================================
-- AUDIT LOG TRIGGER
-- Automatic audit logging on INSERT/UPDATE/DELETE for core tables
-- Requirements: 17.5
-- =============================================================================
CREATE OR REPLACE FUNCTION audit_log_trigger()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO audit_logs (
    tenant_id, branch_id, actor_id, actor_name,
    action_type, resource_type, resource_id, description,
    old_data, new_data
  )
  VALUES (
    COALESCE(NEW.tenant_id, OLD.tenant_id),
    COALESCE(NEW.branch_id, OLD.branch_id),
    NULLIF(current_setting('app.actor_id', true), '')::UUID,
    current_setting('app.actor_name', true),
    TG_OP,
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id),
    TG_OP || ' on ' || TG_TABLE_NAME,
    CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END
  );
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply audit trigger to core tables
CREATE TRIGGER audit_customers
  AFTER INSERT OR UPDATE OR DELETE ON customers
  FOR EACH ROW EXECUTE FUNCTION audit_log_trigger();

CREATE TRIGGER audit_appointments
  AFTER INSERT OR UPDATE OR DELETE ON appointments
  FOR EACH ROW EXECUTE FUNCTION audit_log_trigger();

CREATE TRIGGER audit_invoices
  AFTER INSERT OR UPDATE OR DELETE ON invoices
  FOR EACH ROW EXECUTE FUNCTION audit_log_trigger();

CREATE TRIGGER audit_services
  AFTER INSERT OR UPDATE OR DELETE ON services
  FOR EACH ROW EXECUTE FUNCTION audit_log_trigger();

CREATE TRIGGER audit_memberships
  AFTER INSERT OR UPDATE OR DELETE ON memberships
  FOR EACH ROW EXECUTE FUNCTION audit_log_trigger();

CREATE TRIGGER audit_employees
  AFTER INSERT OR UPDATE OR DELETE ON employees
  FOR EACH ROW EXECUTE FUNCTION audit_log_trigger();
