// =============================================================================
// Subscription / trial expiry logic (single source of truth).
//
// A tenant is considered EXPIRED when:
//   • subscription_status is explicitly 'expired' or 'cancelled', OR
//   • the subscription/trial end date (subscription_end) is in the past, OR
//   • (fallback) a trial with no end date was created more than the trial
//     window ago.
//
// This is computed at read time so we don't depend on a cron job to flip the
// status — though admins can also set 'expired' explicitly.
// =============================================================================

export const TRIAL_DAYS = 15;

// =============================================================================
// Plan tier display labels.
//
// The DB stores raw plan tiers ('starter' | 'pro' | 'enterprise') but the
// product is marketed with friendlier names. Use this helper anywhere a plan
// tier is shown to a human so admin/UI surfaces stay consistent.
// =============================================================================
export function planLabel(tier?: string | null): string {
  switch ((tier || '').toLowerCase()) {
    case 'pro':
      return 'Pro';
    case 'enterprise':
      return 'Growth';
    case 'starter':
    default:
      return 'Essentials';
  }
}

export interface SubscriptionState {
  isExpired: boolean;
  isTrial: boolean;
  /** Days remaining (>=0) while active; 0 when expired. */
  daysRemaining: number;
  endDate: Date | null;
}

interface TenantSubscriptionFields {
  subscription_status?: string | null;
  subscription_start?: string | null;
  subscription_end?: string | null;
  created_at?: string | null;
}

export function getSubscriptionState(tenant: TenantSubscriptionFields | null | undefined): SubscriptionState {
  const status = tenant?.subscription_status ?? 'active';
  const now = Date.now();

  // Explicit terminal states always lock.
  if (status === 'expired' || status === 'cancelled') {
    return { isExpired: true, isTrial: status === 'expired', daysRemaining: 0, endDate: parseDate(tenant?.subscription_end) };
  }

  // Paid/active subscriptions: only expired if an end date exists and passed.
  // Trials: expired once the trial window elapses.
  const isTrial = status === 'trial';

  let end = parseDate(tenant?.subscription_end);
  if (!end && isTrial) {
    // Fallback when no explicit end date was stamped: start (or created_at) + TRIAL_DAYS.
    const start = parseDate(tenant?.subscription_start) ?? parseDate(tenant?.created_at);
    if (start) {
      end = new Date(start);
      end.setDate(end.getDate() + TRIAL_DAYS);
    }
  }

  if (end && end.getTime() <= now) {
    return { isExpired: true, isTrial, daysRemaining: 0, endDate: end };
  }

  const daysRemaining = end ? Math.max(0, Math.ceil((end.getTime() - now) / 86_400_000)) : 0;
  return { isExpired: false, isTrial, daysRemaining, endDate: end };
}

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

// =============================================================================
// Billing cycle + plan pricing (single source of truth).
//
// Monthly = list price (no discount). Yearly = discounted effective per-month
// price, billed once for the year. Stored per tenant in `tenants.settings`
// JSONB under `billing_cycle` (defaults to 'yearly').
// =============================================================================

export type BillingCycle = 'monthly' | 'yearly';

export interface PlanPricing {
  /** ₹/month when billed monthly (list price, no discount). */
  monthly: number;
  /** Effective ₹/month when billed yearly (discounted). */
  yearlyPerMonth: number;
}

/** Per-tier pricing. Marketing names: starter=Essentials, pro=Pro, enterprise=Growth. */
export const PLAN_PRICING: Record<'starter' | 'pro' | 'enterprise', PlanPricing> = {
  starter: { monthly: 999, yearlyPerMonth: 799 },
  pro: { monthly: 1999, yearlyPerMonth: 1199 },
  enterprise: { monthly: 2999, yearlyPerMonth: 1499 },
};

export function planPricing(tier?: string | null): PlanPricing {
  switch ((tier || '').toLowerCase()) {
    case 'pro':
      return PLAN_PRICING.pro;
    case 'enterprise':
      return PLAN_PRICING.enterprise;
    case 'starter':
    default:
      return PLAN_PRICING.starter;
  }
}

/** Effective ₹/month for a tier on a given billing cycle. */
export function planMonthlyPrice(tier: string | null | undefined, cycle: BillingCycle): number {
  const p = planPricing(tier);
  return cycle === 'yearly' ? p.yearlyPerMonth : p.monthly;
}

/** Total amount billed once per year on the yearly plan. */
export function planYearlyTotal(tier?: string | null): number {
  return planPricing(tier).yearlyPerMonth * 12;
}

/** Yearly discount percentage vs the monthly list price (rounded). */
export function planYearlyDiscountPct(tier?: string | null): number {
  const p = planPricing(tier);
  if (p.monthly <= 0) return 0;
  return Math.round(((p.monthly - p.yearlyPerMonth) / p.monthly) * 100);
}

/** Normalize a tenant's billing cycle from settings (defaults to 'yearly'). */
export function getBillingCycle(settings: Record<string, unknown> | null | undefined): BillingCycle {
  return (settings?.billing_cycle as string) === 'monthly' ? 'monthly' : 'yearly';
}

export function billingCycleLabel(cycle: BillingCycle): string {
  return cycle === 'monthly' ? 'Monthly' : 'Yearly';
}
