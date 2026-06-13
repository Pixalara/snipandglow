'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createProduct, updateProduct } from './actions';
import type { Product } from '@/types';

// =============================================================================
// ProductForm — Add / Edit a retail product
// =============================================================================

const UNIT_OPTIONS = ['piece', 'bottle', 'pack', 'box', 'tube', 'jar', 'ml', 'gram'] as const;

interface ProductFormProps {
  /** If provided, the form is in edit mode. */
  product?: Product;
  onClose: () => void;
}

export function ProductForm({ product, onClose }: ProductFormProps) {
  const isEditing = !!product;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    const fd = new FormData(e.currentTarget);
    const name = (fd.get('name') as string)?.trim();
    const sku = (fd.get('sku') as string)?.trim();
    const category = (fd.get('category') as string)?.trim();
    const brand = (fd.get('brand') as string)?.trim();
    const unit = (fd.get('unit') as string) || 'piece';
    const purchasePrice = parseFloat(fd.get('purchase_price') as string);
    const sellingPrice = parseFloat(fd.get('selling_price') as string);
    const openingStock = parseInt(fd.get('stock_quantity') as string, 10);
    const lowStock = parseInt(fd.get('low_stock_threshold') as string, 10);
    const isActive = fd.get('is_active') === 'on';

    if (!name) {
      setError('Product name is required.');
      setIsSubmitting(false);
      return;
    }
    if (isNaN(sellingPrice) || sellingPrice < 0) {
      setError('Selling price must be a non-negative number.');
      setIsSubmitting(false);
      return;
    }

    let result;
    if (isEditing) {
      result = await updateProduct(product.id, {
        name,
        sku: sku || null,
        category: category || null,
        brand: brand || null,
        unit,
        purchase_price: isNaN(purchasePrice) ? 0 : purchasePrice,
        selling_price: sellingPrice,
        low_stock_threshold: isNaN(lowStock) ? 0 : lowStock,
        is_active: isActive,
      });
    } else {
      result = await createProduct({
        name,
        sku: sku || null,
        category: category || null,
        brand: brand || null,
        unit,
        purchase_price: isNaN(purchasePrice) ? 0 : purchasePrice,
        selling_price: sellingPrice,
        stock_quantity: isNaN(openingStock) ? 0 : openingStock,
        low_stock_threshold: isNaN(lowStock) ? 0 : lowStock,
        is_active: isActive,
      });
    }

    setIsSubmitting(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    onClose();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h2 className="text-lg font-semibold text-foreground">
        {isEditing ? 'Edit Product' : 'Add Product'}
      </h2>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 dark:border-red-900/50 dark:bg-red-900/20">
          <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
        </div>
      )}

      <div className="space-y-3">
        <div>
          <Label htmlFor="name">Product Name</Label>
          <Input id="name" name="name" defaultValue={product?.name ?? ''} placeholder="e.g., Argan Oil Shampoo" required className="mt-1" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="category">Category (optional)</Label>
            <Input id="category" name="category" defaultValue={product?.category ?? ''} placeholder="e.g., Hair Care" className="mt-1" />
          </div>
          <div>
            <Label htmlFor="brand">Brand (optional)</Label>
            <Input id="brand" name="brand" defaultValue={product?.brand ?? ''} placeholder="e.g., L'Oreal" className="mt-1" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="sku">SKU / Code (optional)</Label>
            <Input id="sku" name="sku" defaultValue={product?.sku ?? ''} placeholder="e.g., SHMP-001" className="mt-1" />
          </div>
          <div>
            <Label htmlFor="unit">Unit</Label>
            <select
              id="unit"
              name="unit"
              defaultValue={product?.unit ?? 'piece'}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm capitalize"
            >
              {UNIT_OPTIONS.map((u) => (
                <option key={u} value={u} className="capitalize">{u}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="purchase_price">Purchase Price (₹)</Label>
            <Input id="purchase_price" name="purchase_price" type="number" min="0" step="0.01" defaultValue={product?.purchase_price ?? ''} placeholder="0" className="mt-1" />
          </div>
          <div>
            <Label htmlFor="selling_price">Selling Price (₹)</Label>
            <Input id="selling_price" name="selling_price" type="number" min="0" step="0.01" defaultValue={product?.selling_price ?? ''} placeholder="0" required className="mt-1" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {/* Opening stock can only be set on create; afterwards use Add/Adjust Stock. */}
          {!isEditing && (
            <div>
              <Label htmlFor="stock_quantity">Opening Stock</Label>
              <Input id="stock_quantity" name="stock_quantity" type="number" min="0" step="1" defaultValue={0} placeholder="0" required className="mt-1" />
            </div>
          )}
          <div className={isEditing ? 'col-span-2' : ''}>
            <Label htmlFor="low_stock_threshold">Low Stock Alert</Label>
            <Input id="low_stock_threshold" name="low_stock_threshold" type="number" min="0" step="1" defaultValue={product?.low_stock_threshold ?? 5} placeholder="5" required className="mt-1" />
          </div>
        </div>

        <label className="flex items-center gap-2 pt-1">
          <input type="checkbox" name="is_active" defaultChecked={product?.is_active ?? true} className="size-4 rounded border-border" />
          <span className="text-sm text-foreground">Active (shown in inventory)</span>
        </label>
      </div>

      <div className="flex items-center justify-end gap-2 pt-2">
        <Button type="button" variant="outline" className="rounded-xl" onClick={onClose} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" className="rounded-xl" disabled={isSubmitting}>
          {isSubmitting ? 'Saving...' : isEditing ? 'Update Product' : 'Add Product'}
        </Button>
      </div>
    </form>
  );
}
