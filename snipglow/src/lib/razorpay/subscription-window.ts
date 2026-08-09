// =============================================================================
// Subscription window calculation for a paid activation.
//
// Pure and side-effect free so the billing rules can be tested exhaustively -
// getting these dates wrong either gives away free months or cuts a paying
// customer off early.
//
// Three rules, driven by whether the tenant already holds a live PAID plan:
//
//   1. First payment (trial, or never subscribed)
//         → starts on the payment date.
//   2. Renewing while a paid plan is still running
//         → starts the day AFTER the current expiry, so no paid day is lost
//           and the cycles sit back to back.
//   3. Renewing after expiry
//         → starts on the payment date (same as rule 1).
//
// A trial is deliberately NOT treated as a live paid plan: rule 1 says a first
// payment starts on the payment date, so paying mid-trial starts the paid term
// immediately.
// =============================================================================

/** IST is a fixed +05:30 with no DST, so a constant offset is exact. */
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/**
 * Add whole months, clamping day-of-month overflow so 31 Jan + 1 month lands on
 * 28/29 Feb rather than rolling into March.
 */
export function addMonths(from: Date, months: number): Date {
  const d = new Date(from);
  const day = d.getUTCDate();
  d.setUTCMonth(d.getUTCMonth() + months);
  if (d.getUTCDate() < day) d.setUTCDate(0); // rolled over → clamp back
  return d;
}

/**
 * Midnight IST at the start of the calendar day AFTER `from`, returned as a UTC
 * instant. Uses the IST calendar because that is the customer's day.
 */
export function istStartOfNextDay(from: Date): Date {
  const shifted = new Date(from.getTime() + IST_OFFSET_MS);
  const ms = Date.UTC(
    shifted.getUTCFullYear(),
    shifted.getUTCMonth(),
    shifted.getUTCDate() + 1
  );
  return new Date(ms - IST_OFFSET_MS);
}

/** Which rule produced the window (recorded on the order for auditability). */
export type ActivationBasis = 'payment_date' | 'day_after_current_end';

export interface SubscriptionWindow {
  start: Date;
  end: Date;
  basis: ActivationBasis;
}

/**
 * Work out the subscription window a payment should buy.
 *
 * @param now          Instant the payment was confirmed.
 * @param currentEnd   Existing subscription_end, if any.
 * @param status       Existing subscription_status ('trial' | 'active' | ...).
 * @param months       Months purchased (1 = monthly, 12 = yearly).
 */
export function computeSubscriptionWindow(params: {
  now: Date;
  currentEnd: Date | null;
  status: string | null | undefined;
  months: number;
}): SubscriptionWindow {
  const { now, currentEnd, status } = params;
  const months = Number(params.months) > 0 ? Math.floor(Number(params.months)) : 1;

  // A live PAID plan is the only case that chains onto the existing term.
  const hasLivePaidPlan =
    (status || '').toLowerCase() === 'active' &&
    currentEnd !== null &&
    currentEnd.getTime() > now.getTime();

  if (hasLivePaidPlan) {
    const start = istStartOfNextDay(currentEnd);
    return { start, end: addMonths(start, months), basis: 'day_after_current_end' };
  }

  return { start: now, end: addMonths(now, months), basis: 'payment_date' };
}
