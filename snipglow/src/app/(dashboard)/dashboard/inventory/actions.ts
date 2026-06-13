'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { toTitleCase } from '@/lib/utils';
import type {
  ActionResult,
  Product,
  CreateProductInput,
  UpdateProductInput,
  StockAdjustmentInput,
  InventoryMovementType,
} from '@/types';

// Note: 'products' / 'inventory_movements' are created via migration 034 but are
// not yet in the generated Supabase types, so queries use `as any` casts — the
// same pattern used by the expenses module.

/** Movements that must add stock (positive) vs remove stock (negative). */
const POSITIVE_TYPES: InventoryMovementType[] = ['stock_in', 'return'];
const NEGATIVE_TYPES: InventoryMovementType[] = ['sale', 'damage'];

interface AuthContext {
  tenantId: string;
  branchId: string | null;
  role: string;
  employeeId: string | null;
}

/** Resolve the current user's tenant/branch/role context. */
async function getAuthContext(): Promise<{ ctx?: AuthContext; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const tenantId = user.user_metadata?.tenant_id;
  const role = user.user_metadata?.role ?? 'staff';
  const branchId = user.user_metadata?.branch_id ?? null;
  if (!tenantId) return { error: 'No tenant context found.' };

  // Resolve employee id for created_by attribution (best-effort).
  const { data: employee } = await supabase
    .from('employees')
    .select('id')
    .eq('auth_user_id', user.id)
    .maybeSingle();

  return { ctx: { tenantId, branchId, role, employeeId: employee?.id ?? null } };
}

/**
 * Fetch all products for the current tenant (RLS enforces scoping).
 * Returns both active and inactive products so the page can filter client-side.
 */
export async function getProducts(): Promise<ActionResult<Product[]>> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not authenticated' };

  const { data, error } = await (supabase as any)
    .from('products')
    .select('*')
    .order('name', { ascending: true });

  if (error) {
    console.error('Inventory: getProducts error:', error);
    return { success: false, error: 'Failed to load products. Please try again.' };
  }

  return { success: true, data: (data ?? []) as Product[] };
}

/**
 * Create a new product. Requires owner or manager.
 */
export async function createProduct(input: CreateProductInput): Promise<ActionResult<Product>> {
  const { ctx, error: authError } = await getAuthContext();
  if (!ctx) return { success: false, error: authError ?? 'Not authenticated' };
  if (ctx.role !== 'owner' && ctx.role !== 'manager') {
    return { success: false, error: 'Only owners and managers can add products.' };
  }

  // Validation
  if (!input.name?.trim()) {
    return { success: false, error: 'Product name is required.' };
  }
  if (input.selling_price == null || input.selling_price < 0) {
    return { success: false, error: 'Selling price must be a non-negative number.' };
  }
  if (input.purchase_price != null && input.purchase_price < 0) {
    return { success: false, error: 'Purchase price must be a non-negative number.' };
  }
  if (input.stock_quantity == null || input.stock_quantity < 0) {
    return { success: false, error: 'Opening stock must be zero or more.' };
  }
  if (input.low_stock_threshold == null || input.low_stock_threshold < 0) {
    return { success: false, error: 'Low stock alert must be zero or more.' };
  }

  const supabase = await createClient();
  const openingStock = Math.trunc(input.stock_quantity);

  const { data, error } = await (supabase as any)
    .from('products')
    .insert({
      tenant_id: ctx.tenantId,
      branch_id: ctx.branchId,
      name: toTitleCase(input.name),
      sku: input.sku?.trim() || null,
      category: input.category?.trim() ? toTitleCase(input.category) : null,
      brand: input.brand?.trim() ? toTitleCase(input.brand) : null,
      unit: input.unit?.trim() || 'piece',
      purchase_price: input.purchase_price ?? 0,
      selling_price: input.selling_price,
      stock_quantity: openingStock,
      low_stock_threshold: Math.trunc(input.low_stock_threshold),
      is_active: input.is_active ?? true,
    })
    .select()
    .single();

  if (error) {
    console.error('Inventory: createProduct error:', error);
    if ((error as any).code === '23505') {
      return { success: false, error: 'A product with this SKU already exists.' };
    }
    return { success: false, error: 'Failed to add product. Please try again.' };
  }

  // Record an opening-stock movement when there is starting stock.
  if (openingStock > 0) {
    await (supabase as any).from('inventory_movements').insert({
      tenant_id: ctx.tenantId,
      branch_id: ctx.branchId,
      product_id: (data as Product).id,
      movement_type: 'stock_in',
      quantity: openingStock,
      note: 'Opening stock',
      created_by: ctx.employeeId,
    });
  }

  revalidatePath('/dashboard/inventory');
  return { success: true, data: data as Product };
}

/**
 * Update product details (not stock — use adjustProductStock for stock).
 * Requires owner or manager.
 */
export async function updateProduct(id: string, input: UpdateProductInput): Promise<ActionResult<Product>> {
  const { ctx, error: authError } = await getAuthContext();
  if (!ctx) return { success: false, error: authError ?? 'Not authenticated' };
  if (ctx.role !== 'owner' && ctx.role !== 'manager') {
    return { success: false, error: 'Only owners and managers can update products.' };
  }

  if (input.name !== undefined && !input.name.trim()) {
    return { success: false, error: 'Product name cannot be empty.' };
  }
  if (input.selling_price !== undefined && input.selling_price < 0) {
    return { success: false, error: 'Selling price must be a non-negative number.' };
  }
  if (input.purchase_price !== undefined && input.purchase_price < 0) {
    return { success: false, error: 'Purchase price must be a non-negative number.' };
  }
  if (input.low_stock_threshold !== undefined && input.low_stock_threshold < 0) {
    return { success: false, error: 'Low stock alert must be zero or more.' };
  }

  const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.name !== undefined) updateData.name = toTitleCase(input.name);
  if (input.sku !== undefined) updateData.sku = input.sku?.trim() || null;
  if (input.category !== undefined) updateData.category = input.category?.trim() ? toTitleCase(input.category) : null;
  if (input.brand !== undefined) updateData.brand = input.brand?.trim() ? toTitleCase(input.brand) : null;
  if (input.unit !== undefined) updateData.unit = input.unit?.trim() || 'piece';
  if (input.purchase_price !== undefined) updateData.purchase_price = input.purchase_price;
  if (input.selling_price !== undefined) updateData.selling_price = input.selling_price;
  if (input.low_stock_threshold !== undefined) updateData.low_stock_threshold = Math.trunc(input.low_stock_threshold);
  if (input.is_active !== undefined) updateData.is_active = input.is_active;

  const supabase = await createClient();
  const { data, error } = await (supabase as any)
    .from('products')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Inventory: updateProduct error:', error);
    if ((error as any).code === '23505') {
      return { success: false, error: 'A product with this SKU already exists.' };
    }
    return { success: false, error: 'Failed to update product. Please try again.' };
  }

  revalidatePath('/dashboard/inventory');
  return { success: true, data: data as Product };
}

/**
 * Apply a stock adjustment: records an inventory_movement and updates the
 * product's stock_quantity. `quantity` is a signed delta (e.g. +10, -2).
 * Requires owner or manager. Blocks adjustments that would push stock below 0.
 */
export async function adjustProductStock(input: StockAdjustmentInput): Promise<ActionResult<Product>> {
  const { ctx, error: authError } = await getAuthContext();
  if (!ctx) return { success: false, error: authError ?? 'Not authenticated' };
  if (ctx.role !== 'owner' && ctx.role !== 'manager') {
    return { success: false, error: 'Only owners and managers can change stock.' };
  }

  const delta = Math.trunc(input.quantity);
  if (!delta) {
    return { success: false, error: 'Quantity must not be zero.' };
  }
  // Enforce sign rules per movement type.
  if (POSITIVE_TYPES.includes(input.movement_type) && delta < 0) {
    return { success: false, error: 'This stock entry must be a positive quantity.' };
  }
  if (NEGATIVE_TYPES.includes(input.movement_type) && delta > 0) {
    return { success: false, error: 'This stock entry must reduce stock.' };
  }

  const supabase = await createClient();

  // Read current stock (RLS-scoped).
  const { data: product, error: readError } = await (supabase as any)
    .from('products')
    .select('*')
    .eq('id', input.product_id)
    .single();

  if (readError || !product) {
    return { success: false, error: 'Product not found.' };
  }

  const current = Number((product as Product).stock_quantity) || 0;
  const newStock = current + delta;
  if (newStock < 0) {
    return {
      success: false,
      error: `Not enough stock. Only ${current} in stock.`,
    };
  }

  // Update stock first (CHECK constraint also guards >= 0).
  const { data: updated, error: updateError } = await (supabase as any)
    .from('products')
    .update({ stock_quantity: newStock, updated_at: new Date().toISOString() })
    .eq('id', input.product_id)
    .select()
    .single();

  if (updateError) {
    console.error('Inventory: adjustProductStock update error:', updateError);
    return { success: false, error: 'Failed to update stock. Please try again.' };
  }

  // Record the movement (best-effort ledger entry).
  const { error: moveError } = await (supabase as any).from('inventory_movements').insert({
    tenant_id: ctx.tenantId,
    branch_id: (product as Product).branch_id ?? ctx.branchId,
    product_id: input.product_id,
    movement_type: input.movement_type,
    quantity: delta,
    note: input.note?.trim() || null,
    created_by: ctx.employeeId,
  });
  if (moveError) {
    console.error('Inventory: adjustProductStock movement log error:', moveError);
  }

  revalidatePath('/dashboard/inventory');
  return { success: true, data: updated as Product };
}

/**
 * Deactivate a product (soft delete). We never hard-delete since a product may
 * have stock movements / historical references. Requires owner or manager.
 */
export async function deactivateProduct(id: string): Promise<ActionResult<void>> {
  const { ctx, error: authError } = await getAuthContext();
  if (!ctx) return { success: false, error: authError ?? 'Not authenticated' };
  if (ctx.role !== 'owner' && ctx.role !== 'manager') {
    return { success: false, error: 'Only owners and managers can deactivate products.' };
  }

  const supabase = await createClient();
  const { error } = await (supabase as any)
    .from('products')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) {
    console.error('Inventory: deactivateProduct error:', error);
    return { success: false, error: 'Failed to deactivate product. Please try again.' };
  }

  revalidatePath('/dashboard/inventory');
  return { success: true, data: undefined };
}

/**
 * Reactivate a previously deactivated product. Requires owner or manager.
 */
export async function reactivateProduct(id: string): Promise<ActionResult<void>> {
  const { ctx, error: authError } = await getAuthContext();
  if (!ctx) return { success: false, error: authError ?? 'Not authenticated' };
  if (ctx.role !== 'owner' && ctx.role !== 'manager') {
    return { success: false, error: 'Only owners and managers can reactivate products.' };
  }

  const supabase = await createClient();
  const { error } = await (supabase as any)
    .from('products')
    .update({ is_active: true, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) {
    console.error('Inventory: reactivateProduct error:', error);
    return { success: false, error: 'Failed to reactivate product. Please try again.' };
  }

  revalidatePath('/dashboard/inventory');
  return { success: true, data: undefined };
}

export interface InventorySummary {
  totalProducts: number;
  lowStock: number;
  outOfStock: number;
  retailStockValue: number;
}

/**
 * Aggregate inventory stats for the summary cards. Active products only.
 */
export async function getInventorySummary(): Promise<ActionResult<InventorySummary>> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not authenticated' };

  const { data, error } = await (supabase as any)
    .from('products')
    .select('selling_price, stock_quantity, low_stock_threshold, is_active')
    .eq('is_active', true);

  if (error) {
    console.error('Inventory: getInventorySummary error:', error);
    return { success: false, error: 'Failed to load inventory summary.' };
  }

  const rows = (data ?? []) as Pick<Product, 'selling_price' | 'stock_quantity' | 'low_stock_threshold' | 'is_active'>[];
  const summary: InventorySummary = {
    totalProducts: rows.length,
    lowStock: rows.filter((p) => p.stock_quantity > 0 && p.stock_quantity <= p.low_stock_threshold).length,
    outOfStock: rows.filter((p) => p.stock_quantity <= 0).length,
    retailStockValue: rows.reduce((sum, p) => sum + Number(p.selling_price) * Number(p.stock_quantity), 0),
  };

  return { success: true, data: summary };
}
