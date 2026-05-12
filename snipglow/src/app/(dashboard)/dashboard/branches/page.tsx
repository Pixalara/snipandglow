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

  // Fetch branch stats
  const branchIds = (branches ?? []).filter((b) => b.is_active).map((b) => b.id);
  const stats: BranchStats[] = [];

  for (const branchId of branchIds) {
    const { count: appointmentCount } = await supabase
      .from('appointments')
      .select('*', { count: 'exact', head: true })
      .eq('branch_id', branchId);

    const { count: customerCount } = await supabase
      .from('customers')
      .select('*', { count: 'exact', head: true })
      .eq('branch_id', branchId);

    const { data: invoices } = await supabase
      .from('invoices')
      .select('total')
      .eq('branch_id', branchId);

    const revenue = (invoices ?? []).reduce((sum, inv) => sum + (inv.total ?? 0), 0);

    stats.push({
      branch_id: branchId,
      appointment_count: appointmentCount ?? 0,
      customer_count: customerCount ?? 0,
      revenue,
    });
  }

  return (
    <BranchesClient
      branches={(branches ?? []) as Branch[]}
      branchStats={stats}
      role={role}
    />
  );
}
