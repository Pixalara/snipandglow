-- =============================================================================
-- Add unique tenant code (e.g., SNG-001) for easy identification
-- =============================================================================

-- Add tenant_code column
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS tenant_code TEXT UNIQUE;

-- Generate codes for existing tenants
UPDATE tenants SET tenant_code = 'SNG-' || LPAD(ROW_NUMBER::text, 3, '0')
FROM (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at) as ROW_NUMBER
  FROM tenants
) sub
WHERE tenants.id = sub.id AND tenants.tenant_code IS NULL;

-- Create a function to auto-generate tenant_code for new tenants
CREATE OR REPLACE FUNCTION generate_tenant_code()
RETURNS TRIGGER AS $$
DECLARE
  next_num INTEGER;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(tenant_code FROM 5) AS INTEGER)), 0) + 1
  INTO next_num
  FROM tenants
  WHERE tenant_code IS NOT NULL;
  
  NEW.tenant_code := 'SNG-' || LPAD(next_num::text, 3, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS set_tenant_code ON tenants;
CREATE TRIGGER set_tenant_code
  BEFORE INSERT ON tenants
  FOR EACH ROW
  WHEN (NEW.tenant_code IS NULL)
  EXECUTE FUNCTION generate_tenant_code();
