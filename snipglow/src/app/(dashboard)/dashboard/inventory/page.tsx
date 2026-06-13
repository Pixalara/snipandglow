import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Package } from 'lucide-react';
import { InventoryClient } from './inventory-client';
import type { Product, UserRole } from '@/types';

// =============================================================================
// Inventory Page — Server Component
// Track salon products, stock levels, and retail sales.
// =============================================================================

export default async function InventoryPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect('/login');
  }

  const role = (user.user_metadata?.role as UserRole) ?? 'staff';

  // Fetch products (RLS enforces tenant/branch scoping). Both active and
  // inactive are returned so the page can offer status filters client-side.
  const { data: products, error } = await (supabase as any)
    .from('products')
    .select('*')
    .order('name', { ascending: true });

  if (error) {
    return (
      <div className="space-y-6">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-teal-500/10 via-teal-500/5 to-transparent border border-teal-200/50 dark:border-teal-800/30 p-6">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-xl bg-teal-100 dark:bg-teal-900/30">
              <Package className="size-5 text-teal-600 dark:text-teal-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">Inventory</h1>
              <p className="text-sm text-destructive">Failed to load products. Please try again.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return <InventoryClient products={(products ?? []) as Product[]} role={role} />;
}
