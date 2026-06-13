-- =============================================================================
-- Migration 037: Performance indexes for hot query paths
--
-- Adds composite indexes on the most-queried tables so RLS-scoped queries hit
-- efficient index-only scans instead of table scans at scale.
--
-- All indexes use IF NOT EXISTS and are non-blocking (CREATE INDEX does not
-- lock the table in Postgres 11+). Additive only.
-- =============================================================================

-- appointments: appointments page queries by (tenant_id, status, appointment_date).
-- The existing idx_appointments_tenant_id + idx_appointments_date_status are
-- single-column / pair without tenant_id, so Postgres has to intersect two
-- index scans. A composite covering index removes that cost.
CREATE INDEX IF NOT EXISTS idx_appointments_tenant_status_date
  ON appointments(tenant_id, status, appointment_date);

-- invoices: analytics queries filter by (tenant_id, branch_id, created_at, payment_status).
CREATE INDEX IF NOT EXISTS idx_invoices_tenant_branch_created
  ON invoices(tenant_id, branch_id, created_at);

-- invoice_items: analytics sums items for a set of invoices.
-- The invoice_id index already exists; this partial index helps product-sale queries.
CREATE INDEX IF NOT EXISTS idx_invoice_items_type
  ON invoice_items(item_type) WHERE item_type = 'product';

-- customers: frequently searched by name ILIKE pattern.
-- Trigram index enables fast ILIKE without full-table scans.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_customers_name_trgm
  ON customers USING gin (name gin_trgm_ops);

-- leads: same ILIKE pattern search.
CREATE INDEX IF NOT EXISTS idx_leads_name_trgm
  ON leads USING gin (name gin_trgm_ops);
