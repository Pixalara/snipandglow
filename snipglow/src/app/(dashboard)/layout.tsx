import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { AppShell } from '@/components/app-shell';
import { SubscriptionGuard } from '@/components/subscription-guard';
import { RenewalReminderPopup } from '@/components/renewal-reminder-popup';
import { getSubscriptionState, planLabel, amountPayable, getBillingCycle } from '@/lib/subscription';
import type { UserRole, Branch } from '@/types';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  // Backup redirect for middleware — if no session, go to login
  if (!user) {
    redirect('/login');
  }

  const role = (user.user_metadata?.role as UserRole) ?? 'staff';
  const tenantId = user.user_metadata?.tenant_id as string | undefined;
  const branchId = user.user_metadata?.branch_id as string | undefined;
  const userName = user.user_metadata?.name ?? user.email ?? 'User';

  // Fetch branches and subscription status in parallel
  let branches: Branch[] = [];
  let subscriptionStatus = 'active';
  let planTier = 'starter';
  let isExpired = false;
  let isTrial = false;
  let trialEndedAt: string | null = null;
  let subscriptionEndDate: string | null = null;
  let renewalAmount = 0;

  if (tenantId) {
    const [branchRes, tenantRes] = await Promise.all([
      role === 'owner'
        ? supabase
            .from('branches')
            .select('id, name, address, phone, is_default, is_active, tenant_id, operating_hours, invoice_counter, created_at')
            .eq('tenant_id', tenantId)
            .eq('is_active', true)
            .order('name')
        : branchId
          ? supabase
              .from('branches')
              .select('id, name, address, phone, is_default, is_active, tenant_id, operating_hours, invoice_counter, created_at')
              .eq('id', branchId)
              .limit(1)
          : Promise.resolve({ data: [] }),
      supabase
        .from('tenants')
        // `settings` is required: renewalAmount below reads the billing cycle and
        // any negotiated rate from it. Omitting it silently fell back to list
        // yearly pricing, so the reminder popup quoted a price that checkout then
        // contradicted.
        .select('subscription_status, subscription_start, subscription_end, plan_tier, created_at, settings')
        .eq('id', tenantId)
        .single(),
    ]);

    if (branchRes.data) {
      branches = branchRes.data as Branch[];
    }
    if (tenantRes.data) {
      subscriptionStatus = tenantRes.data.subscription_status ?? 'active';
      planTier = (tenantRes.data as any).plan_tier ?? 'starter';
      const state = getSubscriptionState(tenantRes.data as any);
      isExpired = state.isExpired;
      isTrial = state.isTrial;
      trialEndedAt = state.endDate ? state.endDate.toISOString() : null;
      // Custom-rate aware: matches exactly what Razorpay will charge.
      const tSettings = ((tenantRes.data as any).settings ?? {}) as Record<string, unknown>;
      renewalAmount = amountPayable(planTier, getBillingCycle(tSettings), tSettings);
      subscriptionEndDate = state.endDate ? state.endDate.toISOString() : null;
    }
  }

  const activeBranchId = branchId ?? branches[0]?.id ?? '';

  return (
    <AppShell
      role={role}
      userName={userName}
      branches={branches}
      activeBranchId={activeBranchId}
      planTier={planTier}
    >
      <SubscriptionGuard
        subscriptionStatus={subscriptionStatus}
        isExpired={isExpired}
        isTrial={isTrial}
        trialEndedAt={trialEndedAt}
      >
        {children}
      </SubscriptionGuard>
      <RenewalReminderPopup
        endDate={subscriptionEndDate}
        isExpired={isExpired}
        isOwner={role === 'owner'}
        planLabel={planLabel(planTier)}
        renewalAmount={renewalAmount}
      />
    </AppShell>
  );
}
