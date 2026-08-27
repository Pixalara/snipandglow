import { describe, it, expect } from 'vitest';
import {
  addMonths,
  istStartOfNextDay,
  istEndOfDay,
  istEndOfDayAfterMonths,
  computeSubscriptionWindow,
} from './subscription-window';

// =============================================================================
// Billing dates decide what a customer paid for. A mistake here either gives
// away free months or cuts off a paying salon, so all three activation rules are
// pinned, plus the calendar edges that break naive date maths.
// =============================================================================

/** IST wall-clock helper: builds the UTC instant for an IST date/time. */
function ist(y: number, m: number, d: number, hh = 0, mm = 0): Date {
  return new Date(Date.UTC(y, m - 1, d, hh, mm) - 5.5 * 60 * 60 * 1000);
}

/** Render a UTC instant as its IST calendar date, for readable assertions. */
function istDate(d: Date): string {
  return new Date(d.getTime() + 5.5 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

describe('addMonths', () => {
  it('adds whole months', () => {
    expect(addMonths(new Date('2026-08-09T10:00:00Z'), 1).toISOString()).toBe(
      '2026-09-09T10:00:00.000Z'
    );
  });

  it('adds a year for the yearly cycle', () => {
    expect(addMonths(new Date('2026-08-09T10:00:00Z'), 12).toISOString()).toBe(
      '2027-08-09T10:00:00.000Z'
    );
  });

  it('clamps day-of-month overflow instead of rolling into the next month', () => {
    // 31 Jan + 1 month must land in February, not 3 March.
    expect(addMonths(new Date('2026-01-31T10:00:00Z'), 1).toISOString()).toBe(
      '2026-02-28T10:00:00.000Z'
    );
    // Leap year.
    expect(addMonths(new Date('2028-01-31T10:00:00Z'), 1).toISOString()).toBe(
      '2028-02-29T10:00:00.000Z'
    );
  });

  it('crosses a year boundary', () => {
    expect(addMonths(new Date('2026-12-15T10:00:00Z'), 1).toISOString()).toBe(
      '2027-01-15T10:00:00.000Z'
    );
  });
});

describe('istStartOfNextDay', () => {
  it('returns IST midnight of the following day', () => {
    // 24 Aug 15:30 IST → 25 Aug 00:00 IST
    expect(istStartOfNextDay(ist(2026, 8, 24, 15, 30)).toISOString()).toBe(
      '2026-08-24T18:30:00.000Z'
    );
    expect(istDate(istStartOfNextDay(ist(2026, 8, 24, 15, 30)))).toBe('2026-08-25');
  });

  it('uses the IST calendar day, not UTC', () => {
    // 23:00 UTC on 24 Aug is already 04:30 IST on 25 Aug, so the next IST day
    // is the 26th - a UTC-based implementation would wrongly say the 25th.
    expect(istDate(istStartOfNextDay(new Date('2026-08-24T23:00:00Z')))).toBe('2026-08-26');
  });

  it('handles a month end', () => {
    expect(istDate(istStartOfNextDay(ist(2026, 8, 31, 12, 0)))).toBe('2026-09-01');
  });

  it('handles a year end', () => {
    expect(istDate(istStartOfNextDay(ist(2026, 12, 31, 23, 0)))).toBe('2027-01-01');
  });

  it('advances even at exactly IST midnight', () => {
    expect(istDate(istStartOfNextDay(ist(2026, 8, 24, 0, 0)))).toBe('2026-08-25');
  });
});

describe('istEndOfDay', () => {
  it('returns the last millisecond of the IST day', () => {
    // 23:59:59.999 IST on 26 Aug = 18:29:59.999Z on the same date.
    expect(istEndOfDay(ist(2026, 8, 26, 10, 0)).toISOString()).toBe('2026-08-26T18:29:59.999Z');
  });

  it('is idempotent', () => {
    const once = istEndOfDay(ist(2026, 8, 26, 10, 0));
    expect(istEndOfDay(once).toISOString()).toBe(once.toISOString());
  });

  it('keeps the IST day when the UTC day is already the previous one', () => {
    // 01:00 IST on 27 Aug is 19:30Z on 26 Aug; the IST day is the 27th.
    expect(istDate(istEndOfDay(ist(2026, 8, 27, 1, 0)))).toBe('2026-08-27');
  });
});

describe('istEndOfDayAfterMonths', () => {
  it('keeps the same day of month', () => {
    expect(istDate(istEndOfDayAfterMonths(ist(2026, 8, 26), 1))).toBe('2026-09-26');
    expect(istDate(istEndOfDayAfterMonths(ist(2026, 8, 26), 12))).toBe('2027-08-26');
  });

  it('ignores the time of day of the input', () => {
    // The regression that caused the drift: an end stored at IST midnight and one
    // stored at IST end-of-day must renew to exactly the same date.
    const fromMidnight = istEndOfDayAfterMonths(ist(2026, 8, 26, 0, 0), 1);
    const fromEndOfDay = istEndOfDayAfterMonths(istEndOfDay(ist(2026, 8, 26)), 1);
    expect(fromEndOfDay.toISOString()).toBe(fromMidnight.toISOString());
    expect(istDate(fromMidnight)).toBe('2026-09-26');
  });

  it('clamps day-of-month overflow on the IST calendar', () => {
    expect(istDate(istEndOfDayAfterMonths(ist(2026, 8, 31), 1))).toBe('2026-09-30');
    expect(istDate(istEndOfDayAfterMonths(ist(2026, 1, 31), 1))).toBe('2026-02-28');
    expect(istDate(istEndOfDayAfterMonths(ist(2028, 1, 31), 1))).toBe('2028-02-29');
  });

  it('crosses a year boundary', () => {
    expect(istDate(istEndOfDayAfterMonths(ist(2026, 12, 15), 1))).toBe('2027-01-15');
  });
});

describe('computeSubscriptionWindow', () => {
  const now = ist(2026, 8, 9, 14, 0); // 9 Aug 2026, 14:00 IST

  describe('rule 1 - first payment', () => {
    it('starts on the payment date for a trial tenant', () => {
      const w = computeSubscriptionWindow({
        now,
        currentEnd: ist(2026, 8, 20), // trial still running
        status: 'trial',
        months: 1,
      });
      expect(w.basis).toBe('payment_date');
      expect(w.start.toISOString()).toBe(now.toISOString());
      expect(istDate(w.end)).toBe('2026-09-09');
    });

    it('starts on the payment date when there is no prior subscription at all', () => {
      const w = computeSubscriptionWindow({ now, currentEnd: null, status: null, months: 1 });
      expect(w.basis).toBe('payment_date');
      expect(w.start.toISOString()).toBe(now.toISOString());
      expect(istDate(w.end)).toBe('2026-09-09');
    });

    it('buys 12 months on the yearly cycle', () => {
      const w = computeSubscriptionWindow({ now, currentEnd: null, status: 'trial', months: 12 });
      expect(istDate(w.end)).toBe('2027-08-09');
    });
  });

  describe('rule 2 - renewing while still active', () => {
    it('starts the day after the current expiry and keeps the anniversary', () => {
      const w = computeSubscriptionWindow({
        now,
        currentEnd: ist(2026, 8, 24, 15, 30),
        status: 'active',
        months: 1,
      });
      expect(w.basis).toBe('day_after_current_end');
      expect(istDate(w.start)).toBe('2026-08-25');
      // Measured from the OLD END (24 Aug), not from the new start (25 Aug).
      expect(istDate(w.end)).toBe('2026-09-24');
    });

    it('never loses a paid day - the new term begins after the old one ends', () => {
      const currentEnd = ist(2026, 8, 24, 15, 30);
      const w = computeSubscriptionWindow({ now, currentEnd, status: 'active', months: 1 });
      expect(w.start.getTime()).toBeGreaterThan(currentEnd.getTime());
      // And coverage is continuous: the new end is well past the old end.
      expect(w.end.getTime()).toBeGreaterThan(currentEnd.getTime());
    });

    it('chains a yearly renewal onto the current term', () => {
      const w = computeSubscriptionWindow({
        now,
        currentEnd: ist(2026, 8, 24),
        status: 'active',
        months: 12,
      });
      expect(istDate(w.start)).toBe('2026-08-25');
      expect(istDate(w.end)).toBe('2027-08-24');
    });

    it('handles an expiry on the last day of a month', () => {
      const w = computeSubscriptionWindow({
        now,
        currentEnd: ist(2026, 8, 31, 20, 0),
        status: 'active',
        months: 1,
      });
      expect(istDate(w.start)).toBe('2026-09-01');
      // September has 30 days, so the term is clamped rather than spilling into
      // October.
      expect(istDate(w.end)).toBe('2026-09-30');
    });

    it('leaves the anniversary exactly where it is over many renewals', () => {
      // The drift bug: each renewal used to push the end date one day later
      // (26th → 27th → 28th …) because the new end was measured from the new
      // start. Twenty-four monthly renewals must still land on the 26th.
      let currentEnd = istEndOfDay(ist(2026, 8, 26));
      for (let i = 0; i < 24; i++) {
        const w = computeSubscriptionWindow({
          // Paying on the expiry day itself, the way a real renewal happens.
          now: ist(
            2026 + Math.floor((7 + i) / 12),
            ((7 + i) % 12) + 1,
            26,
            19,
            26
          ),
          currentEnd,
          status: 'active',
          months: 1,
        });
        expect(w.basis).toBe('day_after_current_end');
        expect(istDate(w.end).slice(-2)).toBe('26');
        currentEnd = w.end;
      }
      expect(istDate(currentEnd)).toBe('2028-08-26');
    });
  });

  describe('the 26 Aug renewal that regressed', () => {
    // Live incident: monthly term ended 26 Aug 2026, tenant paid Rs 799 at
    // 19:26 IST on 26 Aug. Expected 27 Aug → 26 Sep. The system stored
    // 27 Sep → 27 Oct.
    const paidAt = ist(2026, 8, 26, 19, 26);

    it('renews 27 Aug -> 26 Sep when paid on the expiry day', () => {
      // Reproduced with the end stored at IST midnight, exactly as it was.
      const w = computeSubscriptionWindow({
        now: paidAt,
        currentEnd: ist(2026, 8, 26, 0, 0),
        status: 'active',
        months: 1,
      });
      expect(w.basis).toBe('day_after_current_end');
      expect(istDate(w.start)).toBe('2026-08-27');
      expect(istDate(w.end)).toBe('2026-09-26');
    });

    it('gives the same answer when the end is stored at IST end-of-day', () => {
      const w = computeSubscriptionWindow({
        now: paidAt,
        currentEnd: istEndOfDay(ist(2026, 8, 26)),
        status: 'active',
        months: 1,
      });
      expect(istDate(w.start)).toBe('2026-08-27');
      expect(istDate(w.end)).toBe('2026-09-26');
    });

    it('never produces the bad 27 Sep -> 27 Oct window, even applied twice', () => {
      // Belt and braces on the atomicity fix in activate.ts: if a second
      // activation somehow ran, the dates must not silently gain a month.
      const first = computeSubscriptionWindow({
        now: paidAt,
        currentEnd: ist(2026, 8, 26, 0, 0),
        status: 'active',
        months: 1,
      });
      expect(istDate(first.end)).not.toBe('2026-10-27');

      const second = computeSubscriptionWindow({
        now: paidAt,
        currentEnd: first.end,
        status: 'active',
        months: 1,
      });
      // A genuine second month, on the same anniversary - not 27 Oct.
      expect(istDate(second.start)).toBe('2026-09-27');
      expect(istDate(second.end)).toBe('2026-10-26');
    });

    it('leaves the tenant covered for the whole of their final day', () => {
      const w = computeSubscriptionWindow({
        now: paidAt,
        currentEnd: ist(2026, 8, 26, 0, 0),
        status: 'active',
        months: 1,
      });
      // getSubscriptionState locks once end <= now, so 26 Sep must still be live
      // late in the evening.
      expect(w.end.getTime()).toBeGreaterThan(ist(2026, 9, 26, 23, 30).getTime());
      expect(w.end.getTime()).toBeLessThan(ist(2026, 9, 27, 0, 0).getTime());
    });
  });

  describe('rule 3 - renewing after expiry', () => {
    it('starts on the payment date when the plan has lapsed', () => {
      const w = computeSubscriptionWindow({
        now,
        currentEnd: ist(2026, 7, 20), // already past
        status: 'active',
        months: 1,
      });
      expect(w.basis).toBe('payment_date');
      expect(w.start.toISOString()).toBe(now.toISOString());
      expect(istDate(w.end)).toBe('2026-09-09');
    });

    it('does not credit the lapsed gap back to the customer', () => {
      const w = computeSubscriptionWindow({
        now,
        currentEnd: ist(2026, 5, 1), // lapsed three months ago
        status: 'expired',
        months: 1,
      });
      expect(w.start.toISOString()).toBe(now.toISOString());
      expect(istDate(w.end)).toBe('2026-09-09');
    });

    it('treats an explicitly expired status as lapsed even if the date is future', () => {
      // Admin force-expired the tenant; the stale future date must not chain.
      const w = computeSubscriptionWindow({
        now,
        currentEnd: ist(2026, 9, 30),
        status: 'expired',
        months: 1,
      });
      expect(w.basis).toBe('payment_date');
    });

    it('treats a cancelled subscription as lapsed', () => {
      const w = computeSubscriptionWindow({
        now,
        currentEnd: ist(2026, 9, 30),
        status: 'cancelled',
        months: 1,
      });
      expect(w.basis).toBe('payment_date');
    });
  });

  describe('robustness', () => {
    it('defaults to one month when months is missing or nonsense', () => {
      for (const months of [0, -3, NaN]) {
        const w = computeSubscriptionWindow({ now, currentEnd: null, status: 'trial', months });
        expect(istDate(w.end)).toBe('2026-09-09');
      }
    });

    it('is case-insensitive about status', () => {
      const w = computeSubscriptionWindow({
        now,
        currentEnd: ist(2026, 8, 24),
        status: 'ACTIVE',
        months: 1,
      });
      expect(w.basis).toBe('day_after_current_end');
    });

    it('always produces an end after the start', () => {
      const cases = [
        { currentEnd: null, status: 'trial' },
        { currentEnd: ist(2026, 8, 24), status: 'active' },
        { currentEnd: ist(2026, 1, 1), status: 'expired' },
      ];
      for (const c of cases) {
        for (const months of [1, 12]) {
          const w = computeSubscriptionWindow({ now, ...c, months });
          expect(w.end.getTime()).toBeGreaterThan(w.start.getTime());
        }
      }
    });

    it('treats an expiry later today as still live, so paying on expiry day renews', () => {
      // subscription_end names the last DAY of cover, so the exact time of day it
      // was stamped with must not decide between renew and restart.
      const w = computeSubscriptionWindow({ now, currentEnd: now, status: 'active', months: 1 });
      expect(w.basis).toBe('day_after_current_end');
      expect(istDate(w.start)).toBe('2026-08-10');
      expect(istDate(w.end)).toBe('2026-09-09');
    });

    it('treats an expiry on any earlier day as lapsed', () => {
      const w = computeSubscriptionWindow({
        now,
        currentEnd: ist(2026, 8, 8, 23, 59), // yesterday, IST
        status: 'active',
        months: 1,
      });
      expect(w.basis).toBe('payment_date');
      expect(w.start.toISOString()).toBe(now.toISOString());
    });
  });
});
