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
//
// TWO INVARIANTS HOLD THE BILLING ANNIVERSARY STILL. Both were broken before,
// and together they renewed a 26 Aug expiry as 27 Sep → 27 Oct:
//
//   A. `subscription_end` names the LAST DAY OF COVER, so the plan is live until
//      that IST day closes (23:59:59.999 IST). Paying on your own expiry day is
//      therefore a renewal of a live plan (rule 2), not a lapsed restart. The
//      old code compared against the raw stored instant, so an end stamped at
//      IST midnight counted as already gone and the term restarted on the
//      payment date, shunting the anniversary to whatever day that was.
//
//   B. The new END is measured from the OLD END, never from the new start. The
//      start is `oldEnd + 1 day`, so measuring from it added a spurious day on
//      every single renewal (26th → 27th → 28th …).
//
// All month arithmetic below is done on the IST CALENDAR, not on the underlying
// UTC instant. Adding a month to a UTC instant can land on a different IST day
// depending on the stored time of day, which would reintroduce the drift.
// =============================================================================

/** IST is a fixed +05:30 with no DST, so a constant offset is exact. */
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Add whole months, clamping day-of-month overflow so 31 Jan + 1 month lands on
 * 28/29 Feb rather than rolling into March.
 *
 * Operates on the UTC instant and preserves the time of day. Prefer
 * `istEndOfDayAfterMonths` for billing windows, which works on the IST calendar.
 */
export function addMonths(from: Date, months: number): Date {
  const d = new Date(from);
  const day = d.getUTCDate();
  d.setUTCMonth(d.getUTCMonth() + months);
  if (d.getUTCDate() < day) d.setUTCDate(0); // rolled over → clamp back
  return d;
}

/** The IST calendar date (month is 1-12) of a UTC instant. */
function istParts(from: Date): { y: number; m: number; d: number } {
  const shifted = new Date(from.getTime() + IST_OFFSET_MS);
  return {
    y: shifted.getUTCFullYear(),
    m: shifted.getUTCMonth() + 1,
    d: shifted.getUTCDate(),
  };
}

/** Number of days in the given calendar month (month is 1-12). */
function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** UTC instant for 00:00:00.000 IST on the given IST calendar date. */
function istMidnight(y: number, m: number, d: number): Date {
  return new Date(Date.UTC(y, m - 1, d) - IST_OFFSET_MS);
}

/**
 * Midnight IST at the start of the calendar day AFTER `from`, returned as a UTC
 * instant. Uses the IST calendar because that is the customer's day.
 */
export function istStartOfNextDay(from: Date): Date {
  const { y, m, d } = istParts(from);
  return istMidnight(y, m, d + 1);
}

/**
 * The last instant of `from`'s IST calendar day (23:59:59.999 IST).
 *
 * Subscription ends are stored this way so the final day is fully usable:
 * `getSubscriptionState` locks the account once `subscription_end <= now`, so an
 * end stamped at IST midnight would lock the tenant out for the whole of the day
 * they are still paid up for.
 */
export function istEndOfDay(from: Date): Date {
  const { y, m, d } = istParts(from);
  return new Date(istMidnight(y, m, d).getTime() + DAY_MS - 1);
}

/**
 * End of the IST calendar day `months` whole months after `from`'s IST day,
 * clamping day-of-month overflow (31 Aug + 1 month → 30 Sep, never 1 Oct).
 *
 * Time of day in `from` is irrelevant: only its IST calendar date is used, so a
 * term whose end is stored at IST midnight and one stored at IST end-of-day
 * renew to the very same date.
 */
export function istEndOfDayAfterMonths(from: Date, months: number): Date {
  const { y, m, d } = istParts(from);
  const monthIndex = m - 1 + months;
  const targetYear = y + Math.floor(monthIndex / 12);
  const targetMonth = (((monthIndex % 12) + 12) % 12) + 1;
  const targetDay = Math.min(d, daysInMonth(targetYear, targetMonth));
  return new Date(istMidnight(targetYear, targetMonth, targetDay).getTime() + DAY_MS - 1);
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

  // Invariant A: the stored end names the last DAY of cover, so the plan runs
  // until that IST day closes. This is what makes a payment on the expiry day
  // itself a renewal (rule 2) rather than a lapsed restart (rule 3).
  const coverUntil = currentEnd !== null ? istEndOfDay(currentEnd) : null;

  // A live PAID plan is the only case that chains onto the existing term.
  const hasLivePaidPlan =
    (status || '').toLowerCase() === 'active' &&
    currentEnd !== null &&
    coverUntil !== null &&
    coverUntil.getTime() > now.getTime();

  if (hasLivePaidPlan) {
    return {
      start: istStartOfNextDay(currentEnd),
      // Invariant B: measured from the OLD END, never from the new start (which
      // is already old end + 1 day). This is what pins the anniversary: a term
      // ending the 26th always renews to the 26th, however many times it runs.
      end: istEndOfDayAfterMonths(currentEnd, months),
      basis: 'day_after_current_end',
    };
  }

  // Rules 1 and 3: the paid term starts at the moment of payment and runs to the
  // end of the same day-of-month `months` later.
  return { start: now, end: istEndOfDayAfterMonths(now, months), basis: 'payment_date' };
}
