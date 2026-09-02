// =============================================================================
// Staff attendance — hours worked and amount payable.
//
// Pure and side-effect free, like `loyalty.ts` and `wallet.ts`, because this is
// what decides what a salon owner pays their team. A mistake here either
// shortchanges someone's wages or overpays out of the salon's margin, so every
// rule is unit tested.
//
// Money convention matches the rest of the codebase: whole rupees, via
// Math.round (see src/lib/wallet.ts).
// =============================================================================

/**
 * What happened on a given day.
 *
 * Only `present` and `half_day` are payable — the rest exist so an owner can
 * record WHY someone wasn't working, rather than leaving a blank the following
 * month is impossible to interpret.
 */
export type AttendanceStatus = 'present' | 'half_day' | 'absent' | 'leave' | 'week_off';

/** Statuses that earn wages. */
const PAYABLE_STATUSES: ReadonlySet<AttendanceStatus> = new Set(['present', 'half_day']);

export function isPayableStatus(status: AttendanceStatus): boolean {
  return PAYABLE_STATUSES.has(status);
}

/**
 * Every status, in the order they should appear in a dropdown.
 *
 * Single source of truth: the UI builds its `<option>` list from this and the
 * server validates against it, so the two cannot disagree.
 */
export const ATTENDANCE_STATUSES: readonly AttendanceStatus[] = [
  'present',
  'half_day',
  'absent',
  'leave',
  'week_off',
];

/** Human labels for the UI, kept next to the type so they can't drift. */
export const ATTENDANCE_STATUS_LABELS: Record<AttendanceStatus, string> = {
  present: 'Present',
  half_day: 'Half day',
  absent: 'Absent',
  leave: 'Leave',
  week_off: 'Week off',
};

const MINUTES_PER_DAY = 24 * 60;

/**
 * Parse a Postgres TIME string (`HH:MM` or `HH:MM:SS`) into minutes since
 * midnight. Returns null for anything unparseable so callers can treat a missing
 * time as "not recorded yet" rather than as midnight.
 */
export function parseTimeToMinutes(value: string | null | undefined): number | null {
  if (!value) return null;
  const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(String(value).trim());
  if (!m) return null;
  const hours = Number(m[1]);
  const minutes = Number(m[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

/** Render minutes-since-midnight back to `HH:MM` for an <input type="time">. */
export function minutesToTime(total: number | null | undefined): string {
  if (total == null || !Number.isFinite(total)) return '';
  const wrapped = ((Math.round(total) % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  const h = Math.floor(wrapped / 60);
  const m = wrapped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export interface AttendanceDayInput {
  status: AttendanceStatus;
  /** `HH:MM` / `HH:MM:SS`, or null when not recorded. */
  login_time?: string | null;
  logout_time?: string | null;
  /** Unpaid break, in minutes. */
  break_minutes?: number | null;
  /** Rate that applied on this day (snapshotted per row, see migration 049). */
  hourly_rate?: number | null;
}

export interface AttendanceDayResult {
  /** Net minutes worked after the break, never negative. */
  minutes: number;
  /** Net hours, rounded to 2dp — for DISPLAY only. */
  hours: number;
  /** Whole rupees payable for the day. */
  amount: number;
  /** True when the shift ran past midnight into the next day. */
  overnight: boolean;
  /** Set when the entry can't be costed, e.g. only one of the two times given. */
  warning: string | null;
}

/**
 * Work out hours and pay for a single day.
 *
 * Two rules worth knowing:
 *
 *  • OVERNIGHT SHIFTS. A salon that closes at 01:00 records login 17:00 and
 *    logout 01:00. Treating that as negative would silently zero the day, so a
 *    logout at or before the login is taken to mean the next calendar day.
 *
 *  • ROUNDING. The amount is derived from exact MINUTES, not from the rounded
 *    `hours` value, so a 2dp display rounding can never compound into the wages.
 */
export function calculateAttendanceDay(input: AttendanceDayInput): AttendanceDayResult {
  const empty: AttendanceDayResult = {
    minutes: 0,
    hours: 0,
    amount: 0,
    overnight: false,
    warning: null,
  };

  // Non-working days are worth nothing regardless of what times were left behind.
  if (!isPayableStatus(input.status)) return empty;

  const login = parseTimeToMinutes(input.login_time);
  const logout = parseTimeToMinutes(input.logout_time);

  if (login == null && logout == null) {
    return { ...empty, warning: 'Enter login and logout time to calculate pay.' };
  }
  if (login == null || logout == null) {
    return {
      ...empty,
      warning: login == null ? 'Login time is missing.' : 'Logout time is missing.',
    };
  }

  // logout <= login means the shift crossed midnight.
  const overnight = logout <= login;
  const grossMinutes = overnight ? logout + MINUTES_PER_DAY - login : logout - login;

  const breakMinutes = Math.max(0, Math.round(Number(input.break_minutes ?? 0)) || 0);

  if (breakMinutes >= grossMinutes) {
    return {
      ...empty,
      overnight,
      warning: 'Break is longer than the shift — no payable hours.',
    };
  }

  const minutes = grossMinutes - breakMinutes;
  const rate = Math.max(0, Number(input.hourly_rate ?? 0) || 0);

  return {
    minutes,
    hours: Math.round((minutes / 60) * 100) / 100,
    // Derived from minutes, deliberately not from the rounded hours above.
    amount: Math.round((minutes / 60) * rate),
    overnight,
    warning: rate <= 0 ? 'No hourly rate set for this staff member.' : null,
  };
}

export interface AttendanceTotals {
  /** Days with a payable status AND a costable pair of times. */
  daysWorked: number;
  /** Days explicitly marked absent. */
  daysAbsent: number;
  /** Days marked as leave. */
  daysLeave: number;
  /** Days marked as week off. */
  daysWeekOff: number;
  totalMinutes: number;
  /** Net hours across the period, rounded to 2dp. */
  totalHours: number;
  /** Whole rupees payable across the period. */
  totalAmount: number;
}

/**
 * Roll a set of days up into a period total (a month, typically).
 *
 * Hours are summed from MINUTES and rounded once at the end, so a month of 2dp
 * per-day roundings cannot drift the total.
 */
export function sumAttendance(days: AttendanceDayInput[]): AttendanceTotals {
  let daysWorked = 0;
  let daysAbsent = 0;
  let daysLeave = 0;
  let daysWeekOff = 0;
  let totalMinutes = 0;
  let totalAmount = 0;

  for (const day of days) {
    if (day.status === 'absent') daysAbsent++;
    else if (day.status === 'leave') daysLeave++;
    else if (day.status === 'week_off') daysWeekOff++;

    const result = calculateAttendanceDay(day);
    if (result.minutes > 0) {
      daysWorked++;
      totalMinutes += result.minutes;
      totalAmount += result.amount;
    }
  }

  return {
    daysWorked,
    daysAbsent,
    daysLeave,
    daysWeekOff,
    totalMinutes,
    totalHours: Math.round((totalMinutes / 60) * 100) / 100,
    totalAmount,
  };
}

/** `7.5` → `"7h 30m"`. Owners read a timesheet, not a decimal. */
export function formatHours(hours: number): string {
  const safe = Number.isFinite(hours) ? Math.max(0, hours) : 0;
  const totalMinutes = Math.round(safe * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0 && m === 0) return '0h';
  if (m === 0) return `${h}h`;
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

/** Today's date in the salon's timezone as `YYYY-MM-DD`. */
export function istToday(now: Date = new Date()): string {
  return now.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

/** Current month in the salon's timezone as `YYYY-MM`. */
export function istCurrentMonth(now: Date = new Date()): string {
  return istToday(now).slice(0, 7);
}

/**
 * Shift a `YYYY-MM-DD` date by whole days.
 *
 * Anchored at midday UTC so a DST-style hour shift can never land the result on
 * the wrong calendar day. Returns the input unchanged if it isn't a real date.
 */
export function shiftDay(date: string, delta: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return date;
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

/** The day before `date` (`YYYY-MM-DD`), for the "copy previous day" action. */
export function previousDay(date: string): string {
  return shiftDay(date, -1);
}

/** The day after `date` (`YYYY-MM-DD`), for the day-view stepper. */
export function nextDay(date: string): string {
  return shiftDay(date, 1);
}

/**
 * Every date in a `YYYY-MM` month as `YYYY-MM-DD`, in order.
 * Uses UTC arithmetic so a server in any timezone produces the same list.
 */
export function daysInMonth(month: string): string[] {
  const m = /^(\d{4})-(\d{2})$/.exec(month);
  if (!m) return [];
  const year = Number(m[1]);
  const monthIndex = Number(m[2]) - 1;
  if (monthIndex < 0 || monthIndex > 11) return [];

  // Day 0 of the next month is the last day of this one.
  const count = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  const out: string[] = [];
  for (let day = 1; day <= count; day++) {
    out.push(`${m[1]}-${m[2]}-${String(day).padStart(2, '0')}`);
  }
  return out;
}

/** Inclusive first/last date of a `YYYY-MM` month, for range queries. */
export function monthRange(month: string): { start: string; end: string } | null {
  const days = daysInMonth(month);
  if (days.length === 0) return null;
  return { start: days[0], end: days[days.length - 1] };
}

// Spelled out rather than derived from toLocaleDateString. `en-IN` renders
// September as "Sept" and inserts a comma before the year, and the exact output
// depends on the ICU data compiled into whichever Node build is running — so a
// label that looked right locally could differ in production. These are fixed.
const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const MONTH_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
] as const;
const MONTH_LONG = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const;

/** Short weekday label (`Mon`) for a `YYYY-MM-DD`, used in the month view. */
export function weekdayLabel(date: string): string {
  const d = new Date(`${date}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return '';
  return WEEKDAY_SHORT[d.getUTCDay()];
}

/**
 * `2026-09-03` → `Thu, 3 Sep 2026`.
 *
 * Read in UTC from a midday anchor, like the other helpers here, so the label
 * always names the date that was passed in. Reading it in local time would shift
 * the label by a day for anyone west of UTC.
 */
export function formatDateLabel(date: string): string {
  const d = new Date(`${date}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return date;
  return `${WEEKDAY_SHORT[d.getUTCDay()]}, ${d.getUTCDate()} ${MONTH_SHORT[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** `2026-09` → `September 2026`. */
export function formatMonthLabel(month: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(month);
  if (!m) return month;
  const index = Number(m[2]) - 1;
  if (index < 0 || index > 11) return month;
  return `${MONTH_LONG[index]} ${m[1]}`;
}

/** True for Sat/Sun, so the day view can suggest a week off. */
export function isWeekend(date: string): boolean {
  const d = new Date(`${date}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return false;
  const dow = d.getUTCDay();
  return dow === 0 || dow === 6;
}
