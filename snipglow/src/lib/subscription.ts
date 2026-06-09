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
