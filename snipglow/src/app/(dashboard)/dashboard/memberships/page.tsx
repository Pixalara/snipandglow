import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { MembershipsClient } from './memberships-client';
import type { Membership, UserRole } from '@/types';
import type { LoyaltyTierConfig } from '@/lib/loyalty';
import { DEFAULT_LOYALTY_CONFIG } from '@/lib/loyalty';

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
  const tenantId = user.user_metadata?.tenant_id;

  // Fetch memberships, active count, and tenant loyalty config in parallel
  const [{ data: memberships, error }, { count: activeMembershipCount }, tenantRes] = await Promise.all([
    supabase.from('memberships').select('*').eq('is_active', true).order('created_at', { ascending: false }),
    supabase.from('customer_memberships').select('id', { count: 'exact', head: true }).eq('status', 'active'),
    tenantId ? supabase.from('tenants').select('settings').eq('id', tenantId).single() : Promise.resolve({ data: null }),
  ]);

  if (error) {
    return (
      <div className="flex items-center justify-center rounded-lg border border-border bg-card p-12">
        <p className="text-sm text-destructive">Failed to load membership plans. Please try again.</p>
      </div>
    );
  }

  const loyaltyConfig: LoyaltyTierConfig = {
    ...DEFAULT_LOYALTY_CONFIG,
    ...((tenantRes.data?.settings as any)?.loyalty_tiers ?? {}),
  };

  return (
    <MembershipsClient
      memberships={(memberships ?? []) as Membership[]}
      activeMembershipCount={activeMembershipCount ?? 0}
      role={role}
      loyaltyConfig={loyaltyConfig}
    />
  );
}
