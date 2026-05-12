import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Button } from '@/components/ui/button';
import {
  Settings,
  CreditCard,
  Crown,
  Zap,
  Building2,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import type { PlanTier, SubscriptionStatus } from '@/types';

const planLabels: Record<PlanTier, string> = {
  starter: 'Starter',
  pro: 'Pro',
  enterprise: 'Enterprise',
};

const planDescriptions: Record<PlanTier, string> = {
  starter: 'Single branch, core features',
  pro: 'Multi-branch, analytics, WhatsApp',
  enterprise: 'Unlimited branches, priority support',
};

const planIcons: Record<PlanTier, typeof Zap> = {
  starter: Zap,
  pro: Crown,
  enterprise: Building2,
};

const statusConfig: Record<SubscriptionStatus, { label: string; color: string; dotColor: string }> = {
  trial: { label: 'Trial', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300', dotColor: 'bg-blue-500' },
  active: { label: 'Active', color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300', dotColor: 'bg-emerald-500' },
  past_due: { label: 'Past Due', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300', dotColor: 'bg-yellow-500' },
  expired: { label: 'Expired', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300', dotColor: 'bg-red-500' },
  cancelled: { label: 'Cancelled', color: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300', dotColor: 'bg-gray-500' },
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

  const statusCfg = statusConfig[subscriptionStatus];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-gray-500/10 via-gray-500/5 to-transparent border border-gray-200/50 dark:border-gray-800/30 p-6">
        <div className="relative z-10 flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-xl bg-gray-100 dark:bg-gray-900/30">
            <Settings className="size-5 text-gray-600 dark:text-gray-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Settings</h1>
            <p className="text-sm text-muted-foreground">Manage your subscription and preferences</p>
          </div>
        </div>
        <div className="absolute -right-6 -top-6 h-32 w-32 rounded-full bg-gray-500/5" />
        <div className="absolute -right-2 top-10 h-20 w-20 rounded-full bg-gray-400/5" />
      </div>

      {/* Expired Warning */}
      {isExpiredOver7Days && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-800/50 dark:bg-red-900/20">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-red-100 dark:bg-red-900/30">
            <AlertTriangle className="size-4 text-red-600 dark:text-red-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-red-800 dark:text-red-200">
              Subscription Expired
            </p>
            <p className="text-sm text-red-700 dark:text-red-300 mt-0.5">
              Your account is in read-only mode. Please renew to continue managing your salon.
            </p>
          </div>
        </div>
      )}

      {/* Current Subscription Card */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="border-b border-border px-6 py-4 bg-muted/30">
          <div className="flex items-center gap-2">
            <CreditCard className="size-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold text-foreground">Subscription</h2>
          </div>
        </div>
        <div className="p-6 space-y-5">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-salon-rose/20 to-salon-gold/20">
                <Crown className="size-5 text-salon-rose" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Current Plan</p>
                <p className="text-lg font-bold text-foreground">{planLabels[planTier]}</p>
              </div>
            </div>
            <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${statusCfg.color}`}>
              <span className={`size-1.5 rounded-full ${statusCfg.dotColor}`} />
              {statusCfg.label}
            </span>
          </div>

          {subscriptionEnd && (
            <div className="rounded-lg bg-muted/50 px-4 py-3">
              <p className="text-xs text-muted-foreground">Next Payment Date</p>
              <p className="text-sm font-semibold text-foreground mt-0.5">
                {subscriptionEnd.toLocaleDateString('en-IN', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                })}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Available Plans */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="border-b border-border px-6 py-4 bg-muted/30">
          <div className="flex items-center gap-2">
            <Crown className="size-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold text-foreground">Available Plans</h2>
          </div>
        </div>
        <div className="p-6">
          <div className="grid gap-4 sm:grid-cols-3">
            {(['starter', 'pro', 'enterprise'] as PlanTier[]).map((tier) => {
              const Icon = planIcons[tier];
              const isCurrent = tier === planTier;
              return (
                <div
                  key={tier}
                  className={`group relative overflow-hidden rounded-xl border p-5 transition-all hover:shadow-md hover:-translate-y-0.5 ${
                    isCurrent
                      ? 'border-salon-rose/50 bg-gradient-to-br from-salon-rose/5 to-salon-gold/5'
                      : 'border-border hover:border-border/80'
                  }`}
                >
                  <div className="space-y-3">
                    <div className={`flex size-10 items-center justify-center rounded-xl ${
                      isCurrent
                        ? 'bg-salon-rose/10'
                        : 'bg-muted'
                    }`}>
                      <Icon className={`size-5 ${isCurrent ? 'text-salon-rose' : 'text-muted-foreground'}`} />
                    </div>
                    <div>
                      <h3 className="font-bold text-foreground">{planLabels[tier]}</h3>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {planDescriptions[tier]}
                      </p>
                    </div>
                    {isCurrent ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-salon-rose/10 px-3 py-1 text-xs font-medium text-salon-rose">
                        <CheckCircle2 className="size-3" />
                        Current Plan
                      </span>
                    ) : (
                      <Button size="sm" className="rounded-xl" variant="outline">
                        Upgrade
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
