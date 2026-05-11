import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { MembershipsClient } from './memberships-client';
import type { Membership, UserRole } from '@/types';

// =============================================================================
// Memberships Management Page — Server Component
// Requirements: 8.1, 8.5
// =============================================================================

export default async function MembershipsPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect('/login');
  }

  const role = (user.user_metadata?.role as UserRole) ?? 'staff';

  // Fetch active membership plans (RLS enforces tenant/branch scoping)
  const { data: memberships, error } = await supabase
    .from('memberships')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (error) {
    return (
      <div className="flex items-center justify-center rounded-lg border border-border bg-card p-12">
        <p className="text-sm text-destructive">Failed to load membership plans. Please try again.</p>
      </div>
    );
  }

  // Get active membership count (customer_memberships where status = 'active')
  const { count: activeMembershipCount } = await supabase
    .from('customer_memberships')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'active');

  return (
    <MembershipsClient
      memberships={(memberships ?? []) as Membership[]}
      activeMembershipCount={activeMembershipCount ?? 0}
      role={role}
    />
  );
}
