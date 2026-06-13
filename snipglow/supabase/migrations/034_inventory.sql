-- =============================================================================
-- Migration 034: Inventory (retail products + stock movements)
--
-- Adds a simple inventory feature for salons that sell retail products
-- (shampoo, serum, cream, wax, hair color, etc.).
--
-- Tables:
--   • products              — the catalog of retail products with stock levels
--   • inventory_movements   — append-only log of every stock change
--
-- RLS mirrors the existing tenant/branch isolation style (see migrations 005 /
-- 010): all reads are tenant-scoped; writes are limited to owner/manager;
-- only owner may delete. Helpers auth_tenant_id() / auth_user_role() come from
-- migration 005. Additive only — does not touch existing tables.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- products
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sku TEXT,
  category TEXT,
  brand TEXT,
  unit TEXT DEFAULT 'piece',
  purchase_price NUMERIC(10,2) DEFAULT 0,
  selling_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  stock_quantity INT NOT NULL DEFAULT 0,
  low_stock_threshold INT NOT NULL DEFAULT 5,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT products_selling_price_nonneg CHECK (selling_price >= 0),
  CONSTRAINT products_purchase_price_nonneg CHECK (purchase_price >= 0),
  CONSTRAINT products_stock_nonneg CHECK (stock_quantity >= 0),
  CONSTRAINT products_low_stock_nonneg CHECK (low_stock_threshold >= 0)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_products_tenant ON products(tenant_id);
CREATE INDEX IF NOT EXISTS idx_products_branch ON products(branch_id);
CREATE INDEX IF NOT EXISTS idx_products_tenant_branch ON products(tenant_id, branch_id);
CREATE INDEX IF NOT EXISTS idx_products_tenant_name ON products(tenant_id, name);
CREATE INDEX IF NOT EXISTS idx_products_active ON products(tenant_id, is_active) WHERE is_active = true;
-- Unique SKU per tenant when an SKU is provided.
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_tenant_sku
  ON products(tenant_id, sku) WHERE sku IS NOT NULL;

ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- All tenant members may read products (staff read-only).
CREATE POLICY "products_select" ON products FOR SELECT
  USING (tenant_id = auth_tenant_id());

-- Owner/manager may add and update products.
CREATE POLICY "products_insert" ON products FOR INSERT
  WITH CHECK (tenant_id = auth_tenant_id() AND auth_user_role() IN ('owner', 'manager'));

CREATE POLICY "products_update" ON products FOR UPDATE
  USING (tenant_id = auth_tenant_id() AND auth_user_role() IN ('owner', 'manager'));

-- Only owner may hard-delete (the app prefers deactivate over delete).
CREATE POLICY "products_delete" ON products FOR DELETE
  USING (tenant_id = auth_tenant_id() AND auth_user_role() = 'owner');

-- ---------------------------------------------------------------------------
-- inventory_movements (append-only stock ledger)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS inventory_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  movement_type TEXT NOT NULL
    CHECK (movement_type IN ('stock_in', 'sale', 'adjustment', 'return', 'damage')),
  quantity INT NOT NULL,
  note TEXT,
  reference_type TEXT,
  reference_id UUID,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  -- A movement must change stock by a non-zero amount.
  CONSTRAINT inventory_movements_qty_nonzero CHECK (quantity <> 0)
);

CREATE INDEX IF NOT EXISTS idx_inv_moves_tenant ON inventory_movements(tenant_id);
CREATE INDEX IF NOT EXISTS idx_inv_moves_product ON inventory_movements(product_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inv_moves_tenant_branch ON inventory_movements(tenant_id, branch_id);

ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY;

-- All tenant members may read the ledger.
CREATE POLICY "inventory_movements_select" ON inventory_movements FOR SELECT
  USING (tenant_id = auth_tenant_id());

-- Owner/manager may record movements.
CREATE POLICY "inventory_movements_insert" ON inventory_movements FOR INSERT
  WITH CHECK (tenant_id = auth_tenant_id() AND auth_user_role() IN ('owner', 'manager'));
