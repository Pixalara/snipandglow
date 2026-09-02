import { describe, it, expect } from 'vitest';
import {
  ATTENDANCE_STATUSES,
  ATTENDANCE_STATUS_LABELS,
  parseTimeToMinutes,
  minutesToTime,
  calculateAttendanceDay,
  sumAttendance,
  formatHours,
  isPayableStatus,
  istToday,
  istCurrentMonth,
  previousDay,
  nextDay,
  shiftDay,
  daysInMonth,
  monthRange,
  weekdayLabel,
  isWeekend,
  type AttendanceDayInput,
} from './attendance';

// =============================================================================
// These functions decide what a salon owner pays their staff, so the cases that
// matter are the ones that silently produce a WRONG NUMBER rather than an error:
// overnight shifts, break handling, and rounding drift across a full month.
// =============================================================================

const day = (over: Partial<AttendanceDayInput> = {}): AttendanceDayInput => ({
  status: 'present',
  login_time: '10:00',
  logout_time: '19:00',
  break_minutes: 0,
  hourly_rate: 300,
  ...over,
});

describe('parseTimeToMinutes', () => {
  it('parses HH:MM and HH:MM:SS', () => {
    expect(parseTimeToMinutes('00:00')).toBe(0);
    expect(parseTimeToMinutes('10:30')).toBe(630);
    expect(parseTimeToMinutes('23:59')).toBe(1439);
    // Postgres TIME comes back with seconds.
    expect(parseTimeToMinutes('09:15:00')).toBe(555);
  });

  it('accepts a single-digit hour', () => {
    expect(parseTimeToMinutes('9:05')).toBe(545);
  });

  it('returns null for missing or malformed values', () => {
    for (const v of [null, undefined, '', '   ', 'abc', '10', '10:5', '1030', '10:60', '24:00']) {
      expect(parseTimeToMinutes(v as string)).toBeNull();
    }
  });
});

describe('minutesToTime', () => {
  it('round-trips with parseTimeToMinutes', () => {
    for (const t of ['00:00', '09:05', '13:45', '23:59']) {
      expect(minutesToTime(parseTimeToMinutes(t))).toBe(t);
    }
  });

  it('returns an empty string for nothing, so inputs stay blank', () => {
    expect(minutesToTime(null)).toBe('');
    expect(minutesToTime(undefined)).toBe('');
    expect(minutesToTime(NaN)).toBe('');
  });
});

describe('calculateAttendanceDay — the normal case', () => {
  it('computes hours and pay for a straight shift', () => {
    // 10:00 to 19:00 at Rs 300/hr = 9h = Rs 2700.
    const r = calculateAttendanceDay(day());
    expect(r.minutes).toBe(540);
    expect(r.hours).toBe(9);
    expect(r.amount).toBe(2700);
    expect(r.overnight).toBe(false);
    expect(r.warning).toBeNull();
  });

  it('deducts an unpaid break', () => {
    // 9h shift minus a 45m break = 8.25h at Rs 300 = Rs 2475.
    const r = calculateAttendanceDay(day({ break_minutes: 45 }));
    expect(r.minutes).toBe(495);
    expect(r.hours).toBe(8.25);
    expect(r.amount).toBe(2475);
  });

  it('handles a part-hour shift', () => {
    // 10:00 to 16:30 = 6.5h at Rs 300 = Rs 1950.
    const r = calculateAttendanceDay(day({ logout_time: '16:30' }));
    expect(r.hours).toBe(6.5);
    expect(r.amount).toBe(1950);
  });
});

describe('calculateAttendanceDay — overnight shifts', () => {
  it('treats a logout before the login as crossing midnight', () => {
    // Salon closes at 01:00: 17:00 -> 01:00 is 8h, not minus 16h.
    const r = calculateAttendanceDay(day({ login_time: '17:00', logout_time: '01:00' }));
    expect(r.overnight).toBe(true);
    expect(r.hours).toBe(8);
    expect(r.amount).toBe(2400);
  });

  it('treats an identical login and logout as a full 24h, not zero', () => {
    // Ambiguous by nature; a full day is the safer reading than silently zeroing.
    const r = calculateAttendanceDay(day({ login_time: '10:00', logout_time: '10:00' }));
    expect(r.overnight).toBe(true);
    expect(r.hours).toBe(24);
  });

  it('still deducts a break across midnight', () => {
    const r = calculateAttendanceDay(
      day({ login_time: '20:00', logout_time: '02:00', break_minutes: 30 })
    );
    expect(r.hours).toBe(5.5);
    expect(r.amount).toBe(1650);
  });
});

describe('calculateAttendanceDay — non-payable and incomplete days', () => {
  it('pays nothing for absent, leave or week off, even with times recorded', () => {
    for (const status of ['absent', 'leave', 'week_off'] as const) {
      const r = calculateAttendanceDay(day({ status }));
      expect(r.minutes).toBe(0);
      expect(r.amount).toBe(0);
      expect(r.warning).toBeNull();
    }
  });

  it('asks for times when neither is recorded', () => {
    const r = calculateAttendanceDay(day({ login_time: null, logout_time: null }));
    expect(r.amount).toBe(0);
    expect(r.warning).toMatch(/login and logout/i);
  });

  it('names which single time is missing', () => {
    expect(calculateAttendanceDay(day({ login_time: null })).warning).toMatch(/login/i);
    expect(calculateAttendanceDay(day({ logout_time: null })).warning).toMatch(/logout/i);
  });

  it('refuses to pay when the break swallows the shift', () => {
    const r = calculateAttendanceDay(day({ logout_time: '11:00', break_minutes: 90 }));
    expect(r.minutes).toBe(0);
    expect(r.amount).toBe(0);
    expect(r.warning).toMatch(/break is longer/i);
  });

  it('computes hours but flags a missing rate rather than pretending to pay', () => {
    const r = calculateAttendanceDay(day({ hourly_rate: 0 }));
    expect(r.hours).toBe(9);
    expect(r.amount).toBe(0);
    expect(r.warning).toMatch(/no hourly rate/i);
  });

  it('treats a negative break or rate as zero instead of crediting time', () => {
    expect(calculateAttendanceDay(day({ break_minutes: -60 })).hours).toBe(9);
    expect(calculateAttendanceDay(day({ hourly_rate: -300 })).amount).toBe(0);
  });

  it('half day is payable — it is a real worked shift', () => {
    const r = calculateAttendanceDay(day({ status: 'half_day', logout_time: '14:00' }));
    expect(r.amount).toBe(1200);
  });
});

describe('rounding', () => {
  it('derives pay from minutes, not from the 2dp display hours', () => {
    // 20 minutes is 0.333... h. Rounding hours first (0.33) would pay Rs 99;
    // the correct figure from exact minutes is Rs 100.
    const r = calculateAttendanceDay(day({ login_time: '10:00', logout_time: '10:20' }));
    expect(r.hours).toBe(0.33);
    expect(r.amount).toBe(100);
  });

  it('does not accumulate rounding drift across a month', () => {
    // 30 x 20-minute days = 600 minutes = 10h exactly = Rs 3000.
    const days = Array.from({ length: 30 }, () =>
      day({ login_time: '10:00', logout_time: '10:20' })
    );
    const totals = sumAttendance(days);
    expect(totals.totalMinutes).toBe(600);
    expect(totals.totalHours).toBe(10);
    // Per-day amounts round to 100 each, so the sum is exact here.
    expect(totals.totalAmount).toBe(3000);
  });
});

describe('sumAttendance', () => {
  it('counts each status and totals only worked days', () => {
    const totals = sumAttendance([
      day(),                                   // 9h  / 2700
      day({ logout_time: '16:00' }),           // 6h  / 1800
      day({ status: 'absent' }),
      day({ status: 'leave' }),
      day({ status: 'week_off' }),
      day({ status: 'week_off' }),
      day({ login_time: null, logout_time: null }), // present but not recorded
    ]);
    expect(totals.daysWorked).toBe(2);
    expect(totals.daysAbsent).toBe(1);
    expect(totals.daysLeave).toBe(1);
    expect(totals.daysWeekOff).toBe(2);
    expect(totals.totalHours).toBe(15);
    expect(totals.totalAmount).toBe(4500);
  });

  it('returns zeroes for an empty month', () => {
    expect(sumAttendance([])).toMatchObject({
      daysWorked: 0,
      totalHours: 0,
      totalAmount: 0,
    });
  });

  it('honours a per-day rate change mid-month', () => {
    // The rate is snapshotted per row, so a raise applies only from its day on.
    const totals = sumAttendance([
      day({ hourly_rate: 300 }), // 9h -> 2700
      day({ hourly_rate: 400 }), // 9h -> 3600
    ]);
    expect(totals.totalAmount).toBe(6300);
  });
});

describe('formatHours', () => {
  it('renders a timesheet, not a decimal', () => {
    expect(formatHours(7.5)).toBe('7h 30m');
    expect(formatHours(8)).toBe('8h');
    expect(formatHours(0.5)).toBe('30m');
    expect(formatHours(0)).toBe('0h');
  });

  it('is defensive about nonsense input', () => {
    expect(formatHours(-5)).toBe('0h');
    expect(formatHours(NaN)).toBe('0h');
  });
});

describe('isPayableStatus', () => {
  it('pays present and half day only', () => {
    expect(isPayableStatus('present')).toBe(true);
    expect(isPayableStatus('half_day')).toBe(true);
    expect(isPayableStatus('absent')).toBe(false);
    expect(isPayableStatus('leave')).toBe(false);
    expect(isPayableStatus('week_off')).toBe(false);
  });
});

describe('ATTENDANCE_STATUSES', () => {
  // The dropdown is built from this list and the server validates against it, so
  // a status without a label (or a label without a status) would ship a blank
  // option or an unselectable value.
  it('covers every label exactly once', () => {
    expect([...ATTENDANCE_STATUSES].sort()).toEqual(
      Object.keys(ATTENDANCE_STATUS_LABELS).sort()
    );
    expect(new Set(ATTENDANCE_STATUSES).size).toBe(ATTENDANCE_STATUSES.length);
  });

  it('leads with the status used most, so the default needs no thought', () => {
    expect(ATTENDANCE_STATUSES[0]).toBe('present');
  });
});

describe('date helpers', () => {
  it('istToday uses the salon timezone, not the server', () => {
    // 20:00 UTC on 26 Aug is already 01:30 IST on 27 Aug.
    expect(istToday(new Date('2026-08-26T20:00:00Z'))).toBe('2026-08-27');
    expect(istCurrentMonth(new Date('2026-08-26T20:00:00Z'))).toBe('2026-08');
  });

  it('previousDay steps back across month and year boundaries', () => {
    expect(previousDay('2026-08-27')).toBe('2026-08-26');
    expect(previousDay('2026-09-01')).toBe('2026-08-31');
    expect(previousDay('2027-01-01')).toBe('2026-12-31');
  });

  it('nextDay steps forward across month and year boundaries', () => {
    expect(nextDay('2026-08-27')).toBe('2026-08-28');
    expect(nextDay('2026-08-31')).toBe('2026-09-01');
    expect(nextDay('2026-12-31')).toBe('2027-01-01');
    // 2028 is a leap year, so February has a 29th.
    expect(nextDay('2028-02-28')).toBe('2028-02-29');
  });

  it('shiftDay moves whole weeks and is reversible', () => {
    expect(shiftDay('2026-08-27', 7)).toBe('2026-09-03');
    expect(shiftDay('2026-08-27', -7)).toBe('2026-08-20');
    expect(shiftDay('2026-08-27', 0)).toBe('2026-08-27');
    expect(shiftDay(shiftDay('2026-08-27', 5), -5)).toBe('2026-08-27');
  });

  it('shiftDay returns the input unchanged for an unparseable date', () => {
    expect(shiftDay('not-a-date', 1)).toBe('not-a-date');
    expect(nextDay('')).toBe('');
  });

  it('daysInMonth returns every day, handling month length and leap years', () => {
    expect(daysInMonth('2026-08')).toHaveLength(31);
    expect(daysInMonth('2026-09')).toHaveLength(30);
    expect(daysInMonth('2026-02')).toHaveLength(28);
    expect(daysInMonth('2028-02')).toHaveLength(29);
    expect(daysInMonth('2026-08')[0]).toBe('2026-08-01');
    expect(daysInMonth('2026-08')[30]).toBe('2026-08-31');
  });

  it('daysInMonth rejects nonsense rather than throwing', () => {
    expect(daysInMonth('2026-13')).toEqual([]);
    expect(daysInMonth('not-a-month')).toEqual([]);
    expect(daysInMonth('')).toEqual([]);
  });

  it('monthRange gives an inclusive first/last date for range queries', () => {
    expect(monthRange('2026-02')).toEqual({ start: '2026-02-01', end: '2026-02-28' });
    expect(monthRange('bad')).toBeNull();
  });

  it('weekdayLabel and isWeekend agree on a known date', () => {
    // 27 Aug 2026 is a Thursday.
    expect(weekdayLabel('2026-08-27')).toBe('Thu');
    expect(isWeekend('2026-08-27')).toBe(false);
    // 29/30 Aug 2026 are Sat/Sun.
    expect(isWeekend('2026-08-29')).toBe(true);
    expect(isWeekend('2026-08-30')).toBe(true);
  });
});
