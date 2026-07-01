import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { BranchesClient } from './branches-client';
import type { Branch, UserRole } from '@/types';
import type { BranchStats } from './actions';

// =============================================================================
// Branch Management Page — Server Component (Owner Only)
// =============================================================================

export default async function BranchesPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect('/login');
  }

  const role = (user.user_metadata?.role as UserRole) ?? 'staff';

  // Only owners can access branch management
  if (role !== 'owner') {
    return (
      <div className="flex items-center justify-center rounded-lg border border-border bg-card p-12">
        <p className="text-sm text-destructive">Access denied. Only owners can manage branches.</p>
      </div>
    );
  }

  // Fetch all branches (RLS enforces tenant scoping)
  const { data: branches, error } = await supabase
    .from('branches')
    .select('*')
    .order('is_default', { ascending: false })
    .order('name', { ascending: true });

  if (error) {
    return (
      <div className="flex items-center justify-center rounded-lg border border-border bg-card p-12">
        <p className="text-sm text-destructive">Failed to load branches. Please try again.</p>
      </div>
    );
  }

  // Fetch branch stats in parallel (not sequential loop)
  const branchIds = (branches ?? []).filter((b) => b.is_active).map((b) => b.id);
  const stats: BranchStats[] = await Promise.all(
    branchIds.map(async (branchId) => {
      const [apptRes, custRes, invRes] = await Promise.all([
        supabase.from('appointments').select('id', { count: 'exact', head: true }).eq('branch_id', branchId),
        supabase.from('customers').select('id', { count: 'exact', head: true }).eq('branch_id', branchId),
        (supabase as any).from('invoices').select('total').eq('branch_id', branchId).eq('payment_status', 'paid').neq('invoice_type', 'wallet_recharge'),
      ]);
      return {
        branch_id: branchId,
        appointment_count: apptRes.count ?? 0,
        customer_count: custRes.count ?? 0,
        revenue: (invRes.data ?? []).reduce((sum: number, inv: any) => sum + (inv.total ?? 0), 0),
      };
    })
  );

  return (
    <BranchesClient
      branches={(branches ?? []) as Branch[]}
      branchStats={stats}
      role={role}
    />
  );
}
