import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { WhatsAppClient } from './whatsapp-client';
import type { PlanTier, UserRole } from '@/types';

// =============================================================================
// WhatsApp Connect Page — Server Component (Owner Only)
// =============================================================================

export default async function WhatsAppPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const tenantId = user.user_metadata?.tenant_id;
  if (!tenantId) redirect('/onboarding');

  const role = (user.user_metadata?.role as UserRole) ?? 'staff';

  // Only owners can access WhatsApp settings
  if (role !== 'owner') {
    return (
      <div className="flex items-center justify-center rounded-lg border border-border bg-card p-12">
        <p className="text-sm text-destructive">Access denied. Only owners can manage WhatsApp settings.</p>
      </div>
    );
  }

  const { data: tenant } = await supabase
    .from('tenants')
    .select('plan_tier')
    .eq('id', tenantId)
    .single();

  if (!tenant) redirect('/dashboard');

  const planTier = tenant.plan_tier as PlanTier;

  return <WhatsAppClient planTier={planTier} />;
}
