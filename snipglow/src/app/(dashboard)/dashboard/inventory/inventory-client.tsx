'use client';

import { useState, useMemo } from 'react';
import { formatINR } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DataTable, type Column } from '@/components/data-table';
import { ExportButton } from '@/components/export-button';
import { RoleGuard } from '@/components/role-guard';
import { RowActionsMenu, type RowAction } from '@/components/row-actions-menu';
import { ProductForm } from './product-form';
import { adjustProductStock, deactivateProduct } from './actions';
import {
  Package,
  Plus,
  Search,
  Filter,
  Pencil,
  PackagePlus,
  SlidersHorizontal,
  PowerOff,
  AlertTriangle,
  Boxes,
  PackageX,
  IndianRupee,
} from 'lucide-react';
import type { Product, StockStatus, UserRole } from '@/types';

// =============================================================================
// InventoryClient — Interactive inventory management
// =============================================================================

/** Compute a product's display stock status. */
function getStockStatus(p: Product): StockStatus {
  if (!p.is_active) return 'inactive';
  if (p.stock_quantity <= 0) return 'out_of_stock';
  if (p.stock_quantity <= p.low_stock_threshold) return 'low_stock';
  return 'in_stock';
}

const STATUS_META: Record<StockStatus, { label: string; className: string }> = {
  in_stock: { label: 'In Stock', className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300' },
  low_stock: { label: 'Low Stock', className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300' },
  out_of_stock: { label: 'Out of Stock', className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' },
  inactive: { label: 'Inactive', className: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' },
};

type FilterKey = 'all' | 'low' | 'out' | 'active' | 'inactive';

interface InventoryClientProps {
  products: Product[];
  role: UserRole;
}

export function InventoryClient({ products, role }: InventoryClientProps) {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Product | undefined>(undefined);
  const [stockTarget, setStockTarget] = useState<{ product: Product; mode: 'add' | 'adjust' } | null>(null);
  const [deactivateTarget, setDeactivateTarget] = useState<Product | null>(null);
  const [actionError, setActionError] = useState('');
  const [isWorking, setIsWorking] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterKey>('all');

  const canWrite = role === 'owner' || role === 'manager';

  // Summary across active products.
  const summary = useMemo(() => {
    const active = products.filter((p) => p.is_active);
    return {
      total: active.length,
      low: active.filter((p) => p.stock_quantity > 0 && p.stock_quantity <= p.low_stock_threshold).length,
      out: active.filter((p) => p.stock_quantity <= 0).length,
      value: active.reduce((sum, p) => sum + Number(p.selling_price) * Number(p.stock_quantity), 0),
    };
  }, [products]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      // Search across name, sku, category, brand.
      if (q) {
        const hay = `${p.name} ${p.sku ?? ''} ${p.category ?? ''} ${p.brand ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      const status = getStockStatus(p);
      switch (filter) {
        case 'low': return status === 'low_stock';
        case 'out': return status === 'out_of_stock';
        case 'active': return p.is_active;
        case 'inactive': return !p.is_active;
        default: return true;
      }
    });
  }, [products, search, filter]);

  function handleEdit(p: Product) {
    setEditing(p);
    setShowForm(true);
  }
  function handleCloseForm() {
    setShowForm(false);
    setEditing(undefined);
  }

  async function handleConfirmDeactivate() {
    if (!deactivateTarget) return;
    setIsWorking(true);
    setActionError('');
    const result = await deactivateProduct(deactivateTarget.id);
    setIsWorking(false);
    if (!result.success) { setActionError(result.error); return; }
    setDeactivateTarget(null);
  }

  const columns: Column<Product>[] = [
    {
      key: 'product',
      header: 'Product',
      render: (p) => (
        <div className="min-w-0">
          <span className="font-medium text-foreground">{p.name}</span>
          {p.sku && <p className="text-xs text-muted-foreground mt-0.5">SKU: {p.sku}</p>}
        </div>
      ),
    },
    {
      key: 'category',
      header: 'Category / Brand',
      render: (p) => (
        <div className="text-sm">
          <span className="text-foreground">{p.category || '—'}</span>
          {p.brand && <p className="text-xs text-muted-foreground mt-0.5">{p.brand}</p>}
        </div>
      ),
    },
    {
      key: 'stock',
      header: 'Stock',
      render: (p) => (
        <span className="font-semibold text-foreground">
          {p.stock_quantity}
          <span className="text-xs font-normal text-muted-foreground ml-1 capitalize">{p.unit}</span>
        </span>
      ),
    },
    {
      key: 'price',
      header: 'Selling Price',
      render: (p) => <span className="font-medium text-foreground">{formatINR(Number(p.selling_price))}</span>,
    },
    {
      key: 'alert',
      header: 'Low Stock Alert',
      render: (p) => <span className="text-sm text-muted-foreground">{p.low_stock_threshold} {p.unit}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (p) => {
        const meta = STATUS_META[getStockStatus(p)];
        return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${meta.className}`}>{meta.label}</span>;
      },
    },
    {
      key: 'actions',
      header: '',
      render: (p) => {
        if (!canWrite) return <span className="text-xs text-muted-foreground">—</span>;
        const actions: RowAction[] = [
          { label: 'Edit', icon: <Pencil className="size-3.5" />, onClick: () => handleEdit(p) },
          { label: 'Add Stock', icon: <PackagePlus className="size-3.5" />, onClick: () => { setStockTarget({ product: p, mode: 'add' }); setActionError(''); } },
          { label: 'Adjust Stock', icon: <SlidersHorizontal className="size-3.5" />, onClick: () => { setStockTarget({ product: p, mode: 'adjust' }); setActionError(''); } },
        ];
        if (p.is_active) {
          actions.push({ label: 'Deactivate', icon: <PowerOff className="size-3.5" />, danger: true, onClick: () => { setDeactivateTarget(p); setActionError(''); } });
        }
        return <RowActionsMenu actions={actions} />;
      },
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-teal-500/10 via-teal-500/5 to-transparent border border-teal-200/50 dark:border-teal-800/30 p-6">
        <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-xl bg-teal-100 dark:bg-teal-900/30">
              <Package className="size-5 text-teal-600 dark:text-teal-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">Inventory</h1>
              <p className="text-sm text-muted-foreground">Track salon products, stock levels, and retail sales.</p>
            </div>
          </div>
          <RoleGuard role={role} action="create" resource="inventory">
            <Button onClick={() => { setEditing(undefined); setShowForm(true); }} className="rounded-xl gap-1.5">
              <Plus className="size-4" />
              Add Product
            </Button>
          </RoleGuard>
        </div>
        <div className="absolute -right-6 -top-6 h-32 w-32 rounded-full bg-teal-500/5" />
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <SummaryCard label="Total Products" value={String(summary.total)} icon={<Boxes className="size-4 text-teal-600" />} />
        <SummaryCard label="Low Stock" value={String(summary.low)} icon={<AlertTriangle className="size-4 text-amber-600" />} accent="text-amber-600" />
        <SummaryCard label="Out of Stock" value={String(summary.out)} icon={<PackageX className="size-4 text-red-600" />} accent="text-red-600" />
        <SummaryCard label="Retail Stock Value" value={formatINR(summary.value)} icon={<IndianRupee className="size-4 text-emerald-600" />} />
      </div>

      {/* Search + filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, SKU, category or brand"
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="size-4 text-muted-foreground hidden sm:block" />
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as FilterKey)}
            className="w-full sm:w-auto rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground"
          >
            <option value="all">All</option>
            <option value="low">Low Stock</option>
            <option value="out">Out of Stock</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
        <ExportButton
          filename="inventory"
          label="Export to Excel"
          rows={filtered}
          columns={[
            { header: 'Product', value: (p) => p.name },
            { header: 'SKU', value: (p) => p.sku ?? '' },
            { header: 'Category', value: (p) => p.category ?? '' },
            { header: 'Brand', value: (p) => p.brand ?? '' },
            { header: 'Unit', value: (p) => p.unit },
            { header: 'Stock', value: (p) => p.stock_quantity },
            { header: 'Purchase Price (INR)', value: (p) => p.purchase_price },
            { header: 'Selling Price (INR)', value: (p) => p.selling_price },
            { header: 'Low Stock Alert', value: (p) => p.low_stock_threshold },
            { header: 'Status', value: (p) => STATUS_META[getStockStatus(p)].label },
          ]}
        />
      </div>

      {/* Product table */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-card p-12 text-center">
          <div className="flex size-14 items-center justify-center rounded-full bg-teal-50 dark:bg-teal-900/20 mb-4">
            <Package className="size-6 text-teal-500" />
          </div>
          <h3 className="text-base font-semibold text-foreground">
            {products.length === 0 ? 'No products yet' : 'No products found'}
          </h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm">
            {products.length === 0
              ? 'Add your first retail product to start tracking stock and sales.'
              : 'Try a different search or filter.'}
          </p>
          {products.length === 0 && (
            <RoleGuard role={role} action="create" resource="inventory">
              <Button onClick={() => setShowForm(true)} className="mt-4 rounded-xl gap-1.5" variant="outline">
                <Plus className="size-4" />
                Add Your First Product
              </Button>
            </RoleGuard>
          )}
        </div>
      ) : (
        <DataTable columns={columns} data={filtered} getRowKey={(p) => p.id} emptyMessage="No products found." />
      )}

      {/* Add / Edit product modal */}
      {showForm && (
        <Modal onClose={handleCloseForm}>
          <ProductForm product={editing} onClose={handleCloseForm} />
        </Modal>
      )}

      {/* Stock modal (add or adjust) */}
      {stockTarget && (
        <Modal onClose={() => setStockTarget(null)}>
          <StockForm
            product={stockTarget.product}
            mode={stockTarget.mode}
            error={actionError}
            onError={setActionError}
            onClose={() => setStockTarget(null)}
          />
        </Modal>
      )}

      {/* Deactivate confirm */}
      {deactivateTarget && (
        <Modal onClose={() => setDeactivateTarget(null)}>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/20">
                <PowerOff className="size-5 text-red-600 dark:text-red-400" />
              </div>
              <h2 className="text-lg font-semibold text-foreground">Deactivate Product</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              Deactivate <span className="font-medium text-foreground">{deactivateTarget.name}</span>? It will be hidden
              from your active inventory but its stock history is kept. You can reactivate it later by editing it.
            </p>
            {actionError && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 dark:border-red-900/50 dark:bg-red-900/20">
                <p className="text-sm text-red-800 dark:text-red-200">{actionError}</p>
              </div>
            )}
            <div className="flex items-center justify-end gap-2 pt-2">
              <Button variant="outline" className="rounded-xl" onClick={() => setDeactivateTarget(null)} disabled={isWorking}>Cancel</Button>
              <Button variant="destructive" className="rounded-xl" onClick={handleConfirmDeactivate} disabled={isWorking}>
                {isWorking ? 'Working...' : 'Deactivate'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// =============================================================================
// SummaryCard
// =============================================================================

function SummaryCard({ label, value, icon, accent }: { label: string; value: string; icon: React.ReactNode; accent?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 hover:shadow-md hover:-translate-y-0.5 transition-all">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        {icon}
      </div>
      <span className={`text-2xl font-bold mt-1 block ${accent ?? 'text-foreground'}`}>{value}</span>
    </div>
  );
}

// =============================================================================
// StockForm — Add Stock / Adjust Stock
// =============================================================================

interface StockFormProps {
  product: Product;
  mode: 'add' | 'adjust';
  error: string;
  onError: (e: string) => void;
  onClose: () => void;
}

function StockForm({ product, mode, error, onError, onClose }: StockFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSubmitting(true);
    onError('');

    const fd = new FormData(e.currentTarget);
    const note = (fd.get('note') as string)?.trim() || null;

    let delta: number;
    let movementType: 'stock_in' | 'adjustment';

    if (mode === 'add') {
      const qty = parseInt(fd.get('quantity') as string, 10);
      if (isNaN(qty) || qty <= 0) {
        onError('Enter a quantity greater than zero.');
        setIsSubmitting(false);
        return;
      }
      delta = qty;
      movementType = 'stock_in';
    } else {
      // Adjust to a new total stock count.
      const newTotal = parseInt(fd.get('new_total') as string, 10);
      if (isNaN(newTotal) || newTotal < 0) {
        onError('Enter the new stock count (zero or more).');
        setIsSubmitting(false);
        return;
      }
      delta = newTotal - product.stock_quantity;
      if (delta === 0) {
        onError('New stock count is the same as the current count.');
        setIsSubmitting(false);
        return;
      }
      movementType = 'adjustment';
    }

    const result = await adjustProductStock({
      product_id: product.id,
      movement_type: movementType,
      quantity: delta,
      note,
    });

    setIsSubmitting(false);
    if (!result.success) { onError(result.error); return; }
    onClose();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h2 className="text-lg font-semibold text-foreground">
        {mode === 'add' ? 'Add Stock' : 'Adjust Stock'}
      </h2>
      <p className="text-sm text-muted-foreground">
        {product.name} — current stock: <span className="font-medium text-foreground">{product.stock_quantity} {product.unit}</span>
      </p>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 dark:border-red-900/50 dark:bg-red-900/20">
          <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
        </div>
      )}

      {mode === 'add' ? (
        <div>
          <Label htmlFor="quantity">Quantity to add</Label>
          <Input id="quantity" name="quantity" type="number" min="1" step="1" placeholder="e.g., 10" required className="mt-1" autoFocus />
        </div>
      ) : (
        <div>
          <Label htmlFor="new_total">New stock count</Label>
          <Input id="new_total" name="new_total" type="number" min="0" step="1" defaultValue={product.stock_quantity} required className="mt-1" autoFocus />
          <p className="text-xs text-muted-foreground mt-1">Set the correct total after a stock count, damage, or correction.</p>
        </div>
      )}

      <div>
        <Label htmlFor="note">Note (optional)</Label>
        <Input id="note" name="note" placeholder="e.g., New delivery, stock count correction" className="mt-1" />
      </div>

      <div className="flex items-center justify-end gap-2 pt-2">
        <Button type="button" variant="outline" className="rounded-xl" onClick={onClose} disabled={isSubmitting}>Cancel</Button>
        <Button type="submit" className="rounded-xl" disabled={isSubmitting}>
          {isSubmitting ? 'Saving...' : mode === 'add' ? 'Add Stock' : 'Update Stock'}
        </Button>
      </div>
    </form>
  );
}

// =============================================================================
// Modal — Simple overlay modal (matches services/expenses pattern)
// =============================================================================

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl mx-4 max-h-[90vh] overflow-y-auto">
        {children}
      </div>
    </div>
  );
}
