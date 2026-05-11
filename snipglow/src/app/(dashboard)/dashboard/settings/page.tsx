import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { PlanTier, SubscriptionStatus } from '@/types';

const planLabels: Record<PlanTier, string> = {
  starter: 'Starter',
  pro: 'Pro',
  enterprise: 'Enterprise',
};

const statusColors: Record<SubscriptionStatus, string> = {
  trial: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  active: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  past_due: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  expired: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  cancelled: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
};

export default async function SettingsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const tenantId = user.user_metadata?.tenant_id;
  if (!tenantId) redirect('/onboarding');

  const { data: tenant } = await supabase
    .from('tenants')
    .select('*')
    .eq('id', tenantId)
    .single();

  if (!tenant) redirect('/dashboard');

  const subscriptionStatus = tenant.subscription_status as SubscriptionStatus;
  const planTier = tenant.plan_tier as PlanTier;
  const subscriptionEnd = tenant.subscription_end
    ? new Date(tenant.subscription_end)
    : null;

  // Check if subscription is expired > 7 days
  const now = new Date();
  const isExpiredOver7Days =
    subscriptionEnd &&
    subscriptionStatus === 'expired' &&
    now.getTime() - subscriptionEnd.getTime() > 7 * 24 * 60 * 60 * 1000;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>

      {isExpiredOver7Days && (
        <div className="rounded-lg border border-red-300 bg-red-50 p-4 dark:border-red-800 dark:bg-red-950">
          <p className="text-sm font-medium text-red-800 dark:text-red-200">
            Your subscription has expired. Your account is in read-only mode.
            Please renew to continue managing your salon.
          </p>
        </div>
      )}

      {/* Current Plan */}
      <Card>
        <CardHeader>
          <CardTitle>Subscription</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Current Plan</p>
              <p className="text-lg font-semibold">{planLabels[planTier]}</p>
            </div>
            <Badge className={statusColors[subscriptionStatus]}>
              {subscriptionStatus}
            </Badge>
          </div>

          {subscriptionEnd && (
            <div>
              <p className="text-sm text-muted-foreground">Next Payment Date</p>
              <p className="text-sm font-medium">
                {subscriptionEnd.toLocaleDateString('en-IN', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                })}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Plan Tiers */}
      <Card>
        <CardHeader>
          <CardTitle>Available Plans</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-3">
            {(['starter', 'pro', 'enterprise'] as PlanTier[]).map((tier) => (
              <div
                key={tier}
                className={`rounded-lg border p-4 ${
                  tier === planTier ? 'border-primary bg-primary/5' : ''
                }`}
              >
                <h3 className="font-semibold">{planLabels[tier]}</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {tier === 'starter' && 'Single branch, core features'}
                  {tier === 'pro' && 'Multi-branch, analytics, WhatsApp'}
                  {tier === 'enterprise' && 'Unlimited branches, priority support'}
                </p>
                {tier === planTier ? (
                  <Badge variant="outline" className="mt-3">
                    Current
                  </Badge>
                ) : (
                  <Button size="sm" className="mt-3" variant="outline">
                    Upgrade
                  </Button>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
