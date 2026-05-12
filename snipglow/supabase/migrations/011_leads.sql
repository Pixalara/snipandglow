-- =============================================================================
-- Migration 011: Leads Management
-- Tracks potential customers who haven't booked yet (walk-ins, social media, etc.)
-- =============================================================================

CREATE TABLE IF NOT EXISTS leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  branch_id UUID NOT NULL REFERENCES branches(id),
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  source TEXT NOT NULL DEFAULT 'walk_in', -- walk_in, social_media, referral, website, whatsapp, other
  status TEXT NOT NULL DEFAULT 'new', -- new, contacted, interested, not_interested, converted
  notes TEXT,
  interested_services TEXT[], -- array of service names they showed interest in
  follow_up_date DATE,
  assigned_to UUID REFERENCES employees(id),
  converted_customer_id UUID REFERENCES customers(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "leads_select" ON leads FOR SELECT USING (tenant_id = auth_tenant_id());
CREATE POLICY "leads_insert" ON leads FOR INSERT WITH CHECK (tenant_id = auth_tenant_id() AND auth_user_role() IN ('owner', 'manager'));
CREATE POLICY "leads_update" ON leads FOR UPDATE USING (tenant_id = auth_tenant_id() AND auth_user_role() IN ('owner', 'manager'));
CREATE POLICY "leads_delete" ON leads FOR DELETE USING (tenant_id = auth_tenant_id() AND auth_user_role() = 'owner');

CREATE INDEX IF NOT EXISTS idx_leads_tenant ON leads(tenant_id);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_follow_up ON leads(follow_up_date);
