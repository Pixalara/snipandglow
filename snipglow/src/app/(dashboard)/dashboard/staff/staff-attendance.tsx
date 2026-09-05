'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  AlertTriangle,
  CalendarDays,
  CalendarRange,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Copy,
  IndianRupee,
  Loader2,
  Moon,
  Save,
  Send,
  Sparkles,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ExportButton } from '@/components/export-button';
import { formatINR } from '@/lib/utils';
import {
  ATTENDANCE_STATUSES,
  ATTENDANCE_STATUS_LABELS,
  calculateAttendanceDay,
  daysInMonth,
  formatDateLabel,
  formatHours,
  formatMonthLabel,
  isPayableStatus,
  istCurrentMonth,
  istToday,
  isWeekend,
  nextDay,
  previousDay,
  sumAttendance,
  weekdayLabel,
  type AttendanceStatus,
} from '@/lib/attendance';
import type { AttendanceDayRow, AttendanceMonthSummary, SaveAttendanceRow } from '@/types';
import {
  getAttendanceForDay,
  getAttendanceForMonth,
  getEmployeeMonthDays,
  getPreviousDayPattern,
  pushMonthToPayroll,
  saveAttendance,
  setEmployeeHourlyRate,
} from './attendance-actions';

// =============================================================================
// Staff Attendance & Pay — owner-only panel on the Staff page.
//
// Two views, because owners work in two very different rhythms:
//
//   DAY   — the daily habit. One line per active staff member for a single date.
//           Optimised for speed: set the shift once, apply it to everyone, adjust
//           the exceptions, save. Hours and rupees update as you type.
//
//   MONTH — payday. Per-staff totals for the month, and a per-staff drill-down
//           where a whole month can be filled in or corrected in one screen.
//           Ends in "Send to Payroll", which writes the calculated wage into the
//           existing Payroll module as the base salary.
//
// All arithmetic comes from `src/lib/attendance.ts` (unit tested) — this file
// only collects input and displays the result.
//
// LAYOUT NOTE. Both grids use ONE set of inputs across all breakpoints rather
// than a desktop table plus a duplicate mobile card list. Duplicating would mean
// two inputs bound to the same value and two elements carrying the same
// aria-label, which is worse for screen readers and doubles the DOM on a screen
// that can hold 30+ editable rows. Instead the same cells reflow: two columns on
// a phone, six aligned columns from `lg` up.
// =============================================================================

/** Default shift the "apply to everyone" button fills in. */
const DEFAULT_SHIFT_IN = '10:00';
const DEFAULT_SHIFT_OUT = '20:00';

// =============================================================================
// Column templates.
//
// EVERY column is a fixed width except ONE `minmax(0,1fr)`. That is not a style
// preference, it is what makes the rows line up at all.
//
// The header and each row are SEPARATE grid containers, and CSS resolves `fr` and
// `auto` per container from that container's own content. So a row whose last
// cell held "Enter login and logout time to calculate pay." sized its columns
// differently from a row showing just "₹2,450", and the two visibly disagreed.
// With one flexible column, `1fr` = width − Σ(fixed) − gaps, which is identical
// for every row no matter what is inside it.
//
// Tiers are md and xl, not md and lg, because the sidebar appears at lg and eats
// roughly the same width the viewport just gained — usable width is ~656px at
// both 768px and 1024px, so lg keeps the compact widths and only xl gets roomier.
// =============================================================================

const GRID_DAY =
  'md:grid-cols-[minmax(0,1fr)_112px_100px_100px_64px_112px] ' +
  'xl:grid-cols-[minmax(0,1fr)_132px_112px_112px_84px_140px]';

const GRID_MONTH =
  'md:grid-cols-[minmax(0,1fr)_64px_64px_86px_180px] ' +
  'xl:grid-cols-[minmax(0,1fr)_80px_80px_100px_210px]';

const GRID_MONTH_DAY =
  'md:grid-cols-[76px_104px_96px_96px_60px_104px] ' +
  'xl:grid-cols-[84px_112px_100px_100px_68px_120px]';

/** Rotated so a list of staff is scannable rather than a wall of one colour. */
const AVATAR_TINTS = [
  'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
  'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
  'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
  'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300',
];

/** A colour cue on the status column so a month can be scanned at a glance. */
const STATUS_DOT: Record<AttendanceStatus, string> = {
  present: 'bg-emerald-500',
  half_day: 'bg-amber-500',
  absent: 'bg-rose-500',
  leave: 'bg-sky-500',
  week_off: 'bg-slate-400',
};

/** Matches `Input` from the design system, which has no select counterpart. */
const SELECT_CLASS =
  'h-8 w-full rounded-lg border border-input bg-transparent pl-5 pr-2 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30';

type Mode = 'day' | 'month';

const TABS: { value: Mode; label: string; short: string; icon: typeof CalendarDays }[] = [
  { value: 'day', label: 'Daily entry', short: 'Daily', icon: CalendarDays },
  { value: 'month', label: 'Monthly payout', short: 'Monthly', icon: CalendarRange },
];

export function StaffAttendance() {
  const [mode, setMode] = useState<Mode>('day');

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      {/* ── Panel header ─────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden border-b border-border bg-gradient-to-br from-indigo-500/[0.07] via-indigo-500/[0.03] to-transparent">
        {/* Soft light behind the title, matching the dashboard's page headers. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-10 -top-16 size-40 rounded-full bg-indigo-400/10 blur-3xl"
        />
        <div className="relative flex flex-col gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-indigo-100 shadow-sm dark:bg-indigo-900/40">
              <Clock className="size-[18px] text-indigo-600 dark:text-indigo-400" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold tracking-tight text-foreground sm:text-base">
                Attendance &amp; Pay
              </h2>
              <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                Record login and logout times. Hours worked and wages are calculated for you.
              </p>
            </div>
          </div>

          {/* View switch */}
          <div
            role="tablist"
            aria-label="Attendance view"
            className="flex w-full items-center gap-1 rounded-xl border border-border bg-background/70 p-1 shadow-sm backdrop-blur-sm lg:w-auto"
          >
            {TABS.map((tab) => {
              const active = mode === tab.value;
              return (
                <button
                  key={tab.value}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setMode(tab.value)}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-all lg:flex-none lg:py-1.5 ${
                    active
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                >
                  <tab.icon className="size-3.5 shrink-0" />
                  <span className="sm:hidden">{tab.short}</span>
                  <span className="hidden sm:inline">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {mode === 'day' ? <DayView /> : <MonthView />}
    </div>
  );
}

// =============================================================================
// Shared pieces
// =============================================================================

/** Fields the owner can change on a row, split out so dirty-checking is exact. */
type EditableRow = Pick<
  AttendanceDayRow,
  'status' | 'login_time' | 'logout_time' | 'break_minutes'
>;

const editableOf = (row: AttendanceDayRow): EditableRow => ({
  status: row.status,
  login_time: row.login_time,
  logout_time: row.logout_time,
  break_minutes: row.break_minutes,
});

const sameRow = (a: EditableRow, b: EditableRow) =>
  a.status === b.status &&
  a.login_time === b.login_time &&
  a.logout_time === b.logout_time &&
  a.break_minutes === b.break_minutes;

/**
 * Wraps a control with a label shown only on narrow screens, where the column
 * header isn't there to explain it.
 */
function Field({
  label,
  children,
  className = '',
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`min-w-0 ${className}`}>
      <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground md:hidden">
        {label}
      </span>
      {children}
    </div>
  );
}

/** Status dropdown with a colour cue, used by both the day and month grids. */
function StatusSelect({
  value,
  onChange,
  label,
  disabled = false,
  compact = false,
}: {
  value: AttendanceStatus;
  onChange: (next: AttendanceStatus) => void;
  label: string;
  disabled?: boolean;
  compact?: boolean;
}) {
  return (
    <div className="relative">
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute left-2 top-1/2 size-1.5 -translate-y-1/2 rounded-full ${STATUS_DOT[value]}`}
      />
      <select
        aria-label={label}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value as AttendanceStatus)}
        className={compact ? `${SELECT_CLASS} h-7 text-xs` : SELECT_CLASS}
      >
        {ATTENDANCE_STATUSES.map((status) => (
          <option key={status} value={status}>
            {ATTENDANCE_STATUS_LABELS[status]}
          </option>
        ))}
      </select>
    </div>
  );
}

/** Break-minutes input. Blank rather than `0`, so the field looks unfilled. */
function BreakInput({
  value,
  onChange,
  label,
  disabled,
  compact = false,
}: {
  value: number;
  onChange: (next: number) => void;
  label: string;
  disabled: boolean;
  compact?: boolean;
}) {
  return (
    <Input
      type="number"
      min={0}
      max={1440}
      step={15}
      inputMode="numeric"
      aria-label={label}
      value={value === 0 ? '' : String(value)}
      placeholder="0"
      disabled={disabled}
      onChange={(e) => {
        const parsed = Number(e.target.value);
        onChange(Number.isFinite(parsed) ? Math.min(1440, Math.max(0, parsed)) : 0);
      }}
      className={compact ? 'h-7 text-xs' : undefined}
    />
  );
}

/**
 * The money and hours for one row. Right-aligned from `md` up.
 *
 * Deliberately does NOT render the warning. Warning text is long enough to wrap
 * to several lines, and wrapping inside a fixed-width column made the row tall
 * and lumpy. It is rendered by the caller on its own full-width line instead.
 */
function DayResult({
  amount,
  hours,
  overnight,
}: {
  amount: number;
  hours: number;
  overnight: boolean;
}) {
  const settled = hours > 0;
  return (
    <div className="rounded-lg bg-muted/50 px-2.5 py-1.5 md:bg-transparent md:px-0 md:py-0 md:text-right">
      <div className="flex items-baseline gap-1.5 md:justify-end">
        <p
          className={`text-sm font-semibold tabular-nums ${
            settled ? 'text-foreground' : 'text-muted-foreground'
          }`}
        >
          {formatINR(amount)}
        </p>
        {overnight && (
          <span
            title="Shift ran past midnight"
            className="inline-flex items-center gap-0.5 rounded-full bg-indigo-100 px-1.5 py-0.5 text-[10px] font-medium text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300"
          >
            <Moon className="size-2.5" />
            +1d
          </span>
        )}
      </div>
      <p className="text-[11px] tabular-nums text-muted-foreground md:mt-0.5">
        {formatHours(hours)}
      </p>
    </div>
  );
}

/** Avatar initial, tinted by position in the list. */
function Avatar({ name, index, size = 'md' }: { name: string; index: number; size?: 'sm' | 'md' }) {
  return (
    <span
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center rounded-full font-bold ${
        AVATAR_TINTS[index % AVATAR_TINTS.length]
      } ${size === 'sm' ? 'size-6 text-[10px]' : 'size-8 text-xs'}`}
    >
      {name.charAt(0).toUpperCase()}
    </span>
  );
}

// =============================================================================
// Daily entry
// =============================================================================

function DayView() {
  const [date, setDate] = useState(() => istToday());
  /** Bumped to force a refetch of the same date after a save. */
  const [refetch, setRefetch] = useState(0);
  const [rows, setRows] = useState<AttendanceDayRow[]>([]);
  // Snapshot of what the server returned, so only real edits get written.
  const [original, setOriginal] = useState<Record<string, EditableRow>>({});
  const [needsRates, setNeedsRates] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showRates, setShowRates] = useState(false);
  const [shiftIn, setShiftIn] = useState(DEFAULT_SHIFT_IN);
  const [shiftOut, setShiftOut] = useState(DEFAULT_SHIFT_OUT);

  // `loading` is derived rather than stored: whatever is on screen belongs to
  // `loadedKey`, so it is stale exactly when that differs from what we want. This
  // avoids a setState in the effect body and the cascading render it causes.
  const requestKey = `${date}#${refetch}`;
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const loading = loadedKey !== requestKey;

  useEffect(() => {
    let active = true;
    getAttendanceForDay(date)
      .then((res) => {
        if (!active) return;
        setRows(res.rows);
        setOriginal(Object.fromEntries(res.rows.map((r) => [r.employee_id, editableOf(r)])));
        setNeedsRates(res.needsRates);
      })
      .catch((err) => {
        console.error('[attendance] failed to load day:', err);
        if (!active) return;
        toast.error('Could not load attendance for that date.');
        setRows([]);
        setOriginal({});
      })
      // Marked loaded either way, so a failed fetch shows the empty state rather
      // than spinning forever.
      .finally(() => {
        if (active) setLoadedKey(requestKey);
      });
    return () => {
      active = false;
    };
  }, [date, requestKey]);

  const reload = () => setRefetch((n) => n + 1);

  const patch = (employeeId: string, changes: Partial<EditableRow>) => {
    setRows((prev) => prev.map((r) => (r.employee_id === employeeId ? { ...r, ...changes } : r)));
  };

  /** Put the chosen shift on everyone who has no times yet. */
  const applyShiftToAll = () => {
    if (!shiftIn || !shiftOut) {
      toast.error('Set both a start and an end time first.');
      return;
    }
    let touched = 0;
    setRows((prev) =>
      prev.map((r) => {
        if (r.login_time || r.logout_time) return r;
        touched++;
        return { ...r, status: 'present', login_time: shiftIn, logout_time: shiftOut };
      })
    );
    toast.success(
      touched === 0
        ? 'Everyone already has times — nothing to fill.'
        : `Shift applied to ${touched} staff member${touched === 1 ? '' : 's'}.`
    );
  };

  /** Reuse yesterday's pattern, which in most salons is today's pattern too. */
  const copyPrevious = async () => {
    try {
      const prev = await getPreviousDayPattern(date);
      if (prev.rows.length === 0) {
        toast.error('No attendance was recorded the day before.');
        return;
      }
      const byId = new Map(prev.rows.map((r) => [r.employee_id, r]));
      let touched = 0;
      setRows((current) =>
        current.map((r) => {
          const source = byId.get(r.employee_id);
          if (!source) return r;
          touched++;
          return {
            ...r,
            status: source.status,
            login_time: source.login_time,
            logout_time: source.logout_time,
            break_minutes: source.break_minutes,
          };
        })
      );
      toast.success(
        `Copied ${touched} entr${touched === 1 ? 'y' : 'ies'} from ${formatDateLabel(prev.date)}.`
      );
    } catch (err) {
      console.error('[attendance] copy previous day failed:', err);
      toast.error('Could not copy the previous day.');
    }
  };

  const dirtyRows = useMemo(
    () => rows.filter((r) => !sameRow(editableOf(r), original[r.employee_id] ?? editableOf(r))),
    [rows, original]
  );

  const totals = useMemo(
    () =>
      sumAttendance(
        rows.map((r) => ({
          status: r.status,
          login_time: r.login_time || null,
          logout_time: r.logout_time || null,
          break_minutes: r.break_minutes,
          hourly_rate: r.hourly_rate,
        }))
      ),
    [rows]
  );

  const handleSave = async () => {
    if (dirtyRows.length === 0) {
      toast.info('No changes to save.');
      return;
    }
    setSaving(true);
    const payload: SaveAttendanceRow[] = dirtyRows.map((r) => ({
      employee_id: r.employee_id,
      work_date: date,
      status: r.status,
      login_time: r.login_time || null,
      logout_time: r.logout_time || null,
      break_minutes: r.break_minutes,
    }));

    const res = await saveAttendance(payload);
    setSaving(false);

    if (!res.success) {
      toast.error(res.error);
      return;
    }
    toast.success(
      `Saved ${res.data.saved} entr${res.data.saved === 1 ? 'y' : 'ies'} · ${formatINR(res.data.totalAmount)} payable`
    );
    reload();
  };

  const today = istToday();
  const isToday = date === today;
  const offDays = totals.daysAbsent + totals.daysLeave + totals.daysWeekOff;

  return (
    <div className="space-y-4 p-4 sm:p-5">
      {/* ── Date bar ───────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            aria-label="Previous day"
            onClick={() => setDate((d) => previousDay(d))}
          >
            <ChevronLeft className="size-4" />
          </Button>

          <div className="min-w-0 flex-1 sm:flex-none">
            {/* The native picker is kept — it is the best date experience on a
                phone — with a readable label above it. */}
            <p className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-foreground">
              <span className="truncate">{formatDateLabel(date)}</span>
              {isToday && (
                <span className="shrink-0 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                  Today
                </span>
              )}
            </p>
            <Input
              type="date"
              aria-label="Attendance date"
              value={date}
              max={today}
              onChange={(e) => setDate(e.target.value || today)}
              className="w-full sm:w-[152px]"
            />
          </div>

          <Button
            variant="outline"
            size="icon"
            aria-label="Next day"
            disabled={isToday}
            onClick={() => setDate((d) => nextDay(d))}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>

        <div className="flex items-center gap-2">
          {!isToday && (
            <Button variant="ghost" size="sm" onClick={() => setDate(today)}>
              Jump to today
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowRates(true)}
            disabled={rows.length === 0}
          >
            <Wallet className="size-3.5" />
            Hourly rates
          </Button>
        </div>
      </div>

      {/* ── Quick fill strip ───────────────────────────────────────────────── */}
      {rows.length > 0 && (
        <div className="rounded-xl border border-border bg-muted/30 p-3">
          <p className="mb-2.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            <Sparkles className="size-3" />
            Quick fill
          </p>
          <div className="flex flex-col gap-2.5 sm:flex-row sm:items-end">
            <div className="flex items-end gap-2">
              <div>
                <label
                  htmlFor="shift-in"
                  className="mb-1 block text-[11px] font-medium text-muted-foreground"
                >
                  Shift start
                </label>
                <Input
                  id="shift-in"
                  type="time"
                  value={shiftIn}
                  onChange={(e) => setShiftIn(e.target.value)}
                  className="w-[108px]"
                />
              </div>
              <span className="pb-1.5 text-muted-foreground">&rarr;</span>
              <div>
                <label
                  htmlFor="shift-out"
                  className="mb-1 block text-[11px] font-medium text-muted-foreground"
                >
                  Shift end
                </label>
                <Input
                  id="shift-out"
                  type="time"
                  value={shiftOut}
                  onChange={(e) => setShiftOut(e.target.value)}
                  className="w-[108px]"
                />
              </div>
            </div>

            <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:justify-end">
              <Button variant="outline" onClick={applyShiftToAll} disabled={loading}>
                <Sparkles className="size-3.5" />
                Apply to everyone
              </Button>
              <Button variant="outline" onClick={copyPrevious} disabled={loading}>
                <Copy className="size-3.5" />
                Copy previous day
              </Button>
            </div>
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
            Both fill the form only — nothing is saved until you press Save. Staff who already have
            times are left alone.
          </p>
        </div>
      )}

      {/* Rates not set yet — the calculation can't produce money without them. */}
      {needsRates && !loading && rows.length > 0 && (
        <div className="flex flex-col gap-2.5 rounded-xl border border-amber-300/60 bg-amber-50 p-3 dark:border-amber-800/40 dark:bg-amber-900/20 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <p className="text-xs leading-relaxed text-amber-800 dark:text-amber-200">
              No hourly rates set yet. Hours will still be recorded, but wages show as ₹0 until each
              staff member has a rate.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setShowRates(true)} className="shrink-0">
            Set rates
          </Button>
        </div>
      )}

      {/* ── The grid ───────────────────────────────────────────────────────── */}
      {loading ? (
        <SkeletonRows />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<Users className="size-6 text-muted-foreground" />}
          title="No active staff"
          hint="Add a staff member above, then come back to record their attendance."
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border">
          <div
            className={`hidden bg-muted/40 px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground md:grid md:gap-x-2 xl:gap-x-3 ${GRID_DAY}`}
          >
            <div>Staff</div>
            <div>Status</div>
            <div>Login</div>
            <div>Logout</div>
            <div>Break</div>
            <div className="text-right">Hours &amp; pay</div>
          </div>

          {rows.map((row, index) => (
            <DayRow
              key={row.employee_id}
              row={row}
              index={index}
              dirty={!sameRow(editableOf(row), original[row.employee_id] ?? editableOf(row))}
              onChange={(changes) => patch(row.employee_id, changes)}
            />
          ))}

          {/* Day total */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t-2 border-border bg-muted/50 px-3 py-3">
            <div className="text-sm">
              <p className="font-semibold text-foreground">
                {totals.daysWorked} of {rows.length} working
              </p>
              {offDays > 0 && (
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {[
                    totals.daysAbsent > 0 ? `${totals.daysAbsent} absent` : null,
                    totals.daysLeave > 0 ? `${totals.daysLeave} on leave` : null,
                    totals.daysWeekOff > 0 ? `${totals.daysWeekOff} week off` : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              )}
            </div>
            <div className="text-right">
              <p className="text-base font-bold tabular-nums text-foreground">
                {formatINR(totals.totalAmount)}
              </p>
              <p className="text-[11px] tabular-nums text-muted-foreground">
                {formatHours(totals.totalHours)} total
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Save bar ───────────────────────────────────────────────────────────
          Sticks to the bottom of the viewport while the grid runs past the fold,
          so Save is always in reach on a phone without scrolling to find it. */}
      {rows.length > 0 && (
        <div className="sticky bottom-0 -mx-4 -mb-4 border-t border-border bg-card/95 px-4 py-3 backdrop-blur-sm sm:-mx-5 sm:-mb-5 sm:px-5">
          <div className="flex items-center justify-between gap-3">
            <p className="min-w-0 text-xs text-muted-foreground">
              {dirtyRows.length === 0 ? (
                <span className="flex items-center gap-1.5">
                  <Check className="size-3.5 shrink-0 text-emerald-500" />
                  All changes saved
                </span>
              ) : (
                <span className="flex items-center gap-1.5">
                  <span
                    aria-hidden="true"
                    className="size-1.5 shrink-0 animate-pulse rounded-full bg-amber-500"
                  />
                  <span className="truncate">
                    <span className="font-semibold text-foreground">{dirtyRows.length}</span>{' '}
                    unsaved {dirtyRows.length === 1 ? 'change' : 'changes'}
                  </span>
                </span>
              )}
            </p>
            <Button
              onClick={handleSave}
              disabled={saving || loading || dirtyRows.length === 0}
              className="shrink-0"
            >
              {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
              {saving ? 'Saving' : 'Save attendance'}
            </Button>
          </div>
        </div>
      )}

      {showRates && (
        <RatesModal
          rows={rows}
          onClose={() => setShowRates(false)}
          onSaved={() => {
            setShowRates(false);
            reload();
          }}
        />
      )}
    </div>
  );
}

/** One staff member's line in the daily grid. */
function DayRow({
  row,
  index,
  dirty,
  onChange,
}: {
  row: AttendanceDayRow;
  index: number;
  dirty: boolean;
  onChange: (changes: Partial<EditableRow>) => void;
}) {
  const result = calculateAttendanceDay({
    status: row.status,
    login_time: row.login_time || null,
    logout_time: row.logout_time || null,
    break_minutes: row.break_minutes,
    hourly_rate: row.hourly_rate,
  });
  const payable = isPayableStatus(row.status);

  return (
    <div
      className={`grid grid-cols-2 gap-x-3 gap-y-3 border-t border-border px-3 py-3.5 transition-colors md:items-center md:gap-x-2 md:gap-y-2 md:py-3 xl:gap-x-3 ${GRID_DAY} ${
        dirty ? 'bg-amber-50/60 dark:bg-amber-900/10' : 'hover:bg-muted/25'
      }`}
    >
      {/* Staff */}
      <div className="col-span-2 flex min-w-0 items-center gap-2.5 md:col-span-1">
        <Avatar name={row.employee_name} index={index} />
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 truncate text-sm font-medium text-foreground">
            <span className="truncate">{row.employee_name}</span>
            {dirty ? (
              <span
                title="Unsaved"
                className="size-1.5 shrink-0 rounded-full bg-amber-500"
                aria-label="Unsaved change"
              />
            ) : (
              row.recorded && (
                <Check className="size-3.5 shrink-0 text-emerald-500" aria-label="Saved" />
              )
            )}
          </p>
          <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
            <span className="capitalize">{row.role}</span>
            {row.hourly_rate > 0 ? (
              <> &middot; ₹{row.hourly_rate}/hr</>
            ) : (
              <> &middot; <span className="text-amber-600 dark:text-amber-400">no rate</span></>
            )}
          </p>
        </div>
      </div>

      {/* Status */}
      <Field label="Status" className="col-span-2 md:col-span-1">
        <StatusSelect
          value={row.status}
          label={`Attendance status for ${row.employee_name}`}
          onChange={(status) => onChange({ status })}
        />
      </Field>

      {/* A day that wasn't worked has no times to enter, so the three inputs are
          replaced by a single note rather than left on screen greyed out. */}
      {payable ? (
        <>
          <Field label="Login">
            <Input
              type="time"
              aria-label={`Login time for ${row.employee_name}`}
              value={row.login_time}
              onChange={(e) => onChange({ login_time: e.target.value })}
            />
          </Field>
          <Field label="Logout">
            <Input
              type="time"
              aria-label={`Logout time for ${row.employee_name}`}
              value={row.logout_time}
              onChange={(e) => onChange({ logout_time: e.target.value })}
            />
          </Field>
          <Field label="Break (min)">
            <BreakInput
              value={row.break_minutes}
              label={`Unpaid break minutes for ${row.employee_name}`}
              disabled={false}
              onChange={(break_minutes) => onChange({ break_minutes })}
            />
          </Field>
          <DayResult
            amount={result.amount}
            hours={result.hours}
            overnight={result.overnight}
          />

          {/* Warnings get their own full-width line, so long text can never
              stretch a column and knock the row out of alignment. */}
          {result.warning && (
            <p className="col-span-2 -mt-1 text-[11px] leading-snug text-amber-600 md:col-span-6 md:mt-0 md:text-right dark:text-amber-400">
              {result.warning}
            </p>
          )}
        </>
      ) : (
        <>
          <div className="col-span-2 flex items-center md:col-span-3">
            <p className="text-xs text-muted-foreground">
              {ATTENDANCE_STATUS_LABELS[row.status]} — no hours to record
            </p>
          </div>
          <div className="col-span-2 md:col-span-1">
            <p className="rounded-lg bg-muted/50 px-2.5 py-1.5 text-sm font-semibold text-muted-foreground md:bg-transparent md:px-0 md:py-0 md:text-right">
              Unpaid
            </p>
          </div>
        </>
      )}
    </div>
  );
}

// =============================================================================
// Hourly rates
// =============================================================================

function RatesModal({
  rows,
  onClose,
  onSaved,
}: {
  rows: AttendanceDayRow[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(rows.map((r) => [r.employee_id, r.hourly_rate ? String(r.hourly_rate) : '']))
  );
  const [saving, setSaving] = useState(false);

  const changed = rows.filter((r) => {
    const raw = values[r.employee_id] ?? '';
    return (raw === '' ? 0 : Number(raw)) !== r.hourly_rate;
  });

  const handleSave = async () => {
    if (changed.length === 0) {
      toast.info('No rates changed.');
      return;
    }
    setSaving(true);
    const failures: string[] = [];

    for (const row of changed) {
      const raw = values[row.employee_id] ?? '';
      const res = await setEmployeeHourlyRate(row.employee_id, raw === '' ? 0 : Number(raw));
      if (!res.success) failures.push(`${row.employee_name}: ${res.error}`);
    }

    setSaving(false);
    if (failures.length > 0) {
      toast.error(failures[0]);
      return;
    }
    toast.success(
      `Updated ${changed.length} hourly rate${changed.length === 1 ? '' : 's'}.`
    );
    onSaved();
  };

  return (
    <Modal onClose={onClose} title="Hourly rates">
      <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Wallet className="size-4 text-indigo-500" />
            Hourly rates
          </h3>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Prices every day recorded from now on. Days already saved keep the rate they were saved
            with, so a raise never rewrites past wages.
          </p>
        </div>
        <Button variant="ghost" size="icon" aria-label="Close" onClick={onClose} className="shrink-0">
          <X className="size-4" />
        </Button>
      </div>

      <div className="max-h-[50vh] divide-y divide-border overflow-y-auto px-5">
        {rows.map((row, index) => (
          <div key={row.employee_id} className="flex items-center gap-3 py-3">
            <Avatar name={row.employee_name} index={index} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">{row.employee_name}</p>
              <p className="text-[11px] capitalize text-muted-foreground">{row.role}</p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <IndianRupee className="size-3.5 text-muted-foreground" />
              <Input
                type="number"
                min={0}
                step={10}
                inputMode="numeric"
                aria-label={`Hourly rate for ${row.employee_name}`}
                value={values[row.employee_id] ?? ''}
                placeholder="0"
                onChange={(e) =>
                  setValues((prev) => ({ ...prev, [row.employee_id]: e.target.value }))
                }
                className="w-20 text-right"
              />
              <span className="text-xs text-muted-foreground">/hr</span>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-border px-5 py-4">
        <p className="text-xs text-muted-foreground">
          {changed.length === 0
            ? 'No changes'
            : `${changed.length} rate${changed.length === 1 ? '' : 's'} changed`}
        </p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || changed.length === 0}>
            {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
            Save rates
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// =============================================================================
// Monthly payout
// =============================================================================

function MonthView() {
  const [month, setMonth] = useState(() => istCurrentMonth());
  const [refetch, setRefetch] = useState(0);
  const [summaries, setSummaries] = useState<AttendanceMonthSummary[]>([]);
  const [totals, setTotals] = useState({ hours: 0, amount: 0, daysWorked: 0 });
  const [expanded, setExpanded] = useState<string | null>(null);
  const [pushing, setPushing] = useState<string | null>(null);

  const requestKey = `${month}#${refetch}`;
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const loading = loadedKey !== requestKey;

  useEffect(() => {
    let active = true;
    getAttendanceForMonth(month)
      .then((res) => {
        if (!active) return;
        setSummaries(res.summaries);
        setTotals(res.totals);
      })
      .catch((err) => {
        console.error('[attendance] failed to load month:', err);
        if (!active) return;
        toast.error('Could not load the monthly summary.');
        setSummaries([]);
        setTotals({ hours: 0, amount: 0, daysWorked: 0 });
      })
      .finally(() => {
        if (active) setLoadedKey(requestKey);
      });
    return () => {
      active = false;
    };
  }, [month, requestKey]);

  const reload = () => setRefetch((n) => n + 1);

  const handlePush = async (row: AttendanceMonthSummary) => {
    setPushing(row.employee_id);
    const res = await pushMonthToPayroll(row.employee_id, month);
    setPushing(null);
    if (!res.success) {
      toast.error(res.error);
      return;
    }
    toast.success(`${row.employee_name}: ${formatINR(res.data.amount)} sent to payroll.`);
    reload();
  };

  const currentMonth = istCurrentMonth();

  return (
    <div className="space-y-4 p-4 sm:p-5">
      {/* ── Month bar ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-foreground">
            <span className="truncate">{formatMonthLabel(month)}</span>
            {month === currentMonth && (
              <span className="shrink-0 rounded-full bg-indigo-100 px-1.5 py-0.5 text-[10px] font-medium text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
                In progress
              </span>
            )}
          </p>
          <Input
            type="month"
            aria-label="Payout month"
            value={month}
            max={currentMonth}
            onChange={(e) => setMonth(e.target.value || currentMonth)}
            className="w-full sm:w-[168px]"
          />
        </div>
        <ExportButton
          filename={`attendance-${month}`}
          label="Export"
          rows={summaries}
          columns={[
            { header: 'Staff', value: (r) => r.employee_name },
            { header: 'Role', value: (r) => r.role },
            { header: 'Hourly Rate (INR)', value: (r) => r.hourly_rate },
            { header: 'Days Worked', value: (r) => r.daysWorked },
            { header: 'Absent', value: (r) => r.daysAbsent },
            { header: 'Leave', value: (r) => r.daysLeave },
            { header: 'Week Off', value: (r) => r.daysWeekOff },
            { header: 'Total Hours', value: (r) => r.totalHours },
            { header: 'Payable (INR)', value: (r) => r.totalAmount },
            {
              header: 'Payroll',
              value: (r) => (r.payrollPaid ? 'Paid' : r.payrollExists ? 'Pending' : 'Not raised'),
            },
          ]}
        />
      </div>

      {loading ? (
        <SkeletonRows />
      ) : summaries.length === 0 ? (
        <EmptyState
          icon={<CalendarRange className="size-6 text-muted-foreground" />}
          title="Nothing to show for this month"
          hint="Record attendance on the Daily entry tab and the monthly payout will build up here."
        />
      ) : (
        <>
          {/* Month headline */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <SummaryCard
              icon={<CalendarDays className="size-4" />}
              tint="blue"
              label="Days worked"
              value={String(totals.daysWorked)}
            />
            <SummaryCard
              icon={<Clock className="size-4" />}
              tint="violet"
              label="Hours worked"
              value={formatHours(totals.hours)}
            />
            <SummaryCard
              icon={<IndianRupee className="size-4" />}
              tint="emerald"
              label="Total payable"
              value={formatINR(totals.amount)}
            />
          </div>

          <div className="overflow-hidden rounded-xl border border-border">
            <div
              className={`hidden bg-muted/40 px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground md:grid md:gap-x-2 xl:gap-x-3 ${GRID_MONTH}`}
            >
              <div>Staff</div>
              <div className="text-center">Worked</div>
              <div className="text-center">Off</div>
              <div className="text-right">Hours</div>
              <div className="text-right">Payable</div>
            </div>

            {summaries.map((row, index) => {
              const open = expanded === row.employee_id;
              return (
                <div key={row.employee_id}>
                  {/* Three mobile columns so Worked / Off / Hours sit on one
                      line without leaving a hole; five aligned columns from lg. */}
                  <div
                    className={`grid grid-cols-3 gap-x-3 gap-y-3 border-t border-border px-3 py-3.5 transition-colors md:items-center md:gap-x-2 md:gap-y-2 md:py-3 xl:gap-x-3 ${GRID_MONTH} ${
                      open ? 'bg-muted/40' : 'hover:bg-muted/25'
                    }`}
                  >
                    <div className="col-span-3 min-w-0 md:col-span-1">
                      <button
                        type="button"
                        onClick={() => setExpanded(open ? null : row.employee_id)}
                        aria-expanded={open}
                        className="flex w-full min-w-0 items-center gap-2 rounded-lg text-left transition-opacity hover:opacity-75"
                      >
                        <ChevronDown
                          className={`size-4 shrink-0 text-muted-foreground transition-transform ${
                            open ? 'rotate-180' : ''
                          }`}
                        />
                        <Avatar name={row.employee_name} index={index} size="sm" />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">
                            {row.employee_name}
                          </p>
                          <p className="truncate text-[11px] text-muted-foreground">
                            <span className="capitalize">{row.role}</span>
                            {row.hourly_rate > 0 && <> &middot; ₹{row.hourly_rate}/hr</>}
                          </p>
                        </div>
                      </button>
                    </div>

                    <Field label="Worked" className="md:text-center">
                      <span className="text-sm tabular-nums text-foreground">{row.daysWorked}</span>
                    </Field>
                    <Field label="Off" className="md:text-center">
                      <span className="text-sm tabular-nums text-muted-foreground">
                        {row.daysAbsent + row.daysLeave + row.daysWeekOff}
                      </span>
                    </Field>
                    <Field label="Hours" className="md:text-right">
                      <span className="text-sm tabular-nums text-foreground">
                        {formatHours(row.totalHours)}
                      </span>
                    </Field>

                    <div className="col-span-3 flex items-center justify-between gap-2 border-t border-border/60 pt-3 md:col-span-1 md:justify-end md:border-0 md:pt-0">
                      <p className="text-base font-bold tabular-nums text-foreground md:text-sm">
                        {formatINR(row.totalAmount)}
                      </p>
                      {row.payrollPaid ? (
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-100 px-2 py-1 text-[11px] font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                          <Check className="size-3" />
                          Paid
                        </span>
                      ) : (
                        <Button
                          variant={row.payrollExists ? 'outline' : 'default'}
                          size="sm"
                          className="shrink-0"
                          disabled={row.totalAmount <= 0 || pushing === row.employee_id}
                          onClick={() => handlePush(row)}
                        >
                          {pushing === row.employee_id ? (
                            <Loader2 className="size-3 animate-spin" />
                          ) : (
                            <Send className="size-3" />
                          )}
                          {row.payrollExists ? 'Update payroll' : 'Send to payroll'}
                        </Button>
                      )}
                    </div>
                  </div>

                  {open && (
                    <EmployeeMonthEditor
                      employeeId={row.employee_id}
                      employeeName={row.employee_name}
                      month={month}
                      hourlyRate={row.hourly_rate}
                      onSaved={reload}
                    />
                  )}
                </div>
              );
            })}

            <div className="flex items-center justify-between gap-3 border-t-2 border-border bg-muted/50 px-3 py-3">
              <p className="text-sm font-semibold text-foreground">Total payable</p>
              <p className="text-base font-bold tabular-nums text-foreground">
                {formatINR(totals.amount)}
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/**
 * A whole month for one staff member, day by day.
 *
 * The server only stores days that were recorded, so the calendar is filled in
 * client-side from `daysInMonth` — the owner sees every date and can enter or
 * correct any of them, then save the month in one request.
 */
function EmployeeMonthEditor({
  employeeId,
  employeeName,
  month,
  hourlyRate,
  onSaved,
}: {
  employeeId: string;
  employeeName: string;
  month: string;
  hourlyRate: number;
  onSaved: () => void;
}) {
  const [refetch, setRefetch] = useState(0);
  const [days, setDays] = useState<Record<string, EditableRow>>({});
  const [original, setOriginal] = useState<Record<string, EditableRow>>({});
  /** Rate snapshotted on each already-saved day; new days use the current rate. */
  const [rates, setRates] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);

  const allDates = useMemo(() => daysInMonth(month), [month]);
  const today = istToday();

  const requestKey = `${employeeId}|${month}#${refetch}`;
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const loading = loadedKey !== requestKey;

  useEffect(() => {
    let active = true;
    getEmployeeMonthDays(employeeId, month)
      .then((stored) => {
        if (!active) return;
        // The server only stores days that were recorded, so start from a blank
        // entry for every date in the month and overlay what exists.
        const next: Record<string, EditableRow> = {};
        const rateMap: Record<string, number> = {};
        for (const date of daysInMonth(month)) {
          next[date] = { status: 'present', login_time: '', logout_time: '', break_minutes: 0 };
        }
        for (const record of stored) {
          if (!record.work_date) continue;
          next[record.work_date] = editableOf(record);
          rateMap[record.work_date] = record.hourly_rate;
        }
        setDays(next);
        setOriginal(Object.fromEntries(Object.entries(next).map(([k, v]) => [k, { ...v }])));
        setRates(rateMap);
      })
      .catch((err) => {
        console.error('[attendance] failed to load employee month:', err);
        if (!active) return;
        toast.error('Could not load that month.');
        setDays({});
        setOriginal({});
        setRates({});
      })
      .finally(() => {
        if (active) setLoadedKey(requestKey);
      });
    return () => {
      active = false;
    };
  }, [employeeId, month, requestKey]);

  const reload = () => setRefetch((n) => n + 1);

  const patch = (date: string, changes: Partial<EditableRow>) => {
    setDays((prev) => ({ ...prev, [date]: { ...prev[date], ...changes } }));
  };

  const dirtyDates = useMemo(
    () =>
      allDates.filter((date) => {
        const current = days[date];
        const before = original[date];
        return current && before && !sameRow(current, before);
      }),
    [allDates, days, original]
  );

  const totals = useMemo(
    () =>
      sumAttendance(
        allDates
          .filter((date) => days[date])
          .map((date) => ({
            status: days[date].status,
            login_time: days[date].login_time || null,
            logout_time: days[date].logout_time || null,
            break_minutes: days[date].break_minutes,
            // Inlined rather than via a helper so the dependency list is honest.
            hourly_rate: rates[date] ?? hourlyRate,
          }))
      ),
    [allDates, days, rates, hourlyRate]
  );

  /** Fill every unfilled past date with a standard shift, weekends off. */
  const fillMonth = () => {
    let touched = 0;
    setDays((prev) => {
      const next = { ...prev };
      for (const date of allDates) {
        if (date > today) continue;
        const row = next[date];
        if (!row || row.login_time || row.logout_time) continue;
        touched++;
        next[date] = isWeekend(date)
          ? { status: 'week_off', login_time: '', logout_time: '', break_minutes: 0 }
          : {
              status: 'present',
              login_time: DEFAULT_SHIFT_IN,
              logout_time: DEFAULT_SHIFT_OUT,
              break_minutes: 0,
            };
      }
      return next;
    });
    toast.success(
      touched === 0
        ? 'Every day up to today is already filled in.'
        : `Filled ${touched} day${touched === 1 ? '' : 's'} — review, then save.`
    );
  };

  const handleSave = async () => {
    if (dirtyDates.length === 0) {
      toast.info('No changes to save.');
      return;
    }
    setSaving(true);
    const payload: SaveAttendanceRow[] = dirtyDates.map((date) => ({
      employee_id: employeeId,
      work_date: date,
      status: days[date].status,
      login_time: days[date].login_time || null,
      logout_time: days[date].logout_time || null,
      break_minutes: days[date].break_minutes,
    }));

    const res = await saveAttendance(payload);
    setSaving(false);
    if (!res.success) {
      toast.error(res.error);
      return;
    }
    toast.success(`${employeeName}: ${res.data.saved} day${res.data.saved === 1 ? '' : 's'} saved.`);
    reload();
    onSaved();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center border-t border-border bg-muted/20 py-10">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="border-t border-border bg-muted/20 p-3">
      <div className="mb-3 flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground">
          Every day in {formatMonthLabel(month)} &middot; {formatHours(totals.totalHours)} &middot;{' '}
          <span className="font-semibold text-foreground">{formatINR(totals.totalAmount)}</span>
        </p>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fillMonth}>
            <Sparkles className="size-3" />
            Fill standard shift
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving || dirtyDates.length === 0}>
            {saving ? <Loader2 className="size-3 animate-spin" /> : <Save className="size-3" />}
            {dirtyDates.length > 0 ? `Save ${dirtyDates.length}` : 'Save'}
          </Button>
        </div>
      </div>

      <div className="max-h-[460px] overflow-y-auto overscroll-contain rounded-xl border border-border bg-background">
        {allDates.map((date) => {
          const row = days[date];
          if (!row) return null;
          const dirty = original[date] && !sameRow(row, original[date]);
          const future = date > today;
          const result = calculateAttendanceDay({
            status: row.status,
            login_time: row.login_time || null,
            logout_time: row.logout_time || null,
            break_minutes: row.break_minutes,
            hourly_rate: rates[date] ?? hourlyRate,
          });
          const payable = isPayableStatus(row.status);
          const isToday = date === today;

          return (
            <div
              key={date}
              className={`grid grid-cols-2 items-center gap-x-2.5 gap-y-2.5 border-b border-border px-2.5 py-2.5 last:border-b-0 md:gap-x-2 md:py-2 xl:gap-x-2.5 ${GRID_MONTH_DAY} ${
                dirty
                  ? 'bg-amber-50/60 dark:bg-amber-900/10'
                  : future
                    ? 'opacity-45'
                    : isWeekend(date)
                      ? 'bg-muted/30'
                      : ''
              }`}
            >
              {/* Date */}
              <div className="col-span-2 flex items-center gap-1.5 md:col-span-1">
                <p className="text-xs font-semibold tabular-nums text-foreground">
                  {date.slice(8)} {weekdayLabel(date)}
                </p>
                {isToday && (
                  <span className="rounded-full bg-emerald-100 px-1 py-0.5 text-[9px] font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                    Today
                  </span>
                )}
                {dirty && (
                  <span
                    aria-label="Unsaved change"
                    className="size-1.5 rounded-full bg-amber-500"
                  />
                )}
              </div>

              <Field label="Status" className="col-span-2 md:col-span-1">
                <StatusSelect
                  compact
                  value={row.status}
                  disabled={future}
                  label={`Status on ${formatDateLabel(date)}`}
                  onChange={(status) => patch(date, { status })}
                />
              </Field>

              {payable ? (
                <>
                  <Field label="In">
                    <Input
                      type="time"
                      aria-label={`Login time on ${formatDateLabel(date)}`}
                      value={row.login_time}
                      disabled={future}
                      onChange={(e) => patch(date, { login_time: e.target.value })}
                      className="h-7 text-xs"
                    />
                  </Field>
                  <Field label="Out">
                    <Input
                      type="time"
                      aria-label={`Logout time on ${formatDateLabel(date)}`}
                      value={row.logout_time}
                      disabled={future}
                      onChange={(e) => patch(date, { logout_time: e.target.value })}
                      className="h-7 text-xs"
                    />
                  </Field>
                  <Field label="Break">
                    <BreakInput
                      compact
                      value={row.break_minutes}
                      label={`Break minutes on ${formatDateLabel(date)}`}
                      disabled={future}
                      onChange={(break_minutes) => patch(date, { break_minutes })}
                    />
                  </Field>
                  {/* One column on mobile so it pairs with Break instead of
                      wrapping and leaving a hole. */}
                  <div className="flex items-center justify-end gap-2 md:col-span-1">
                    {result.overnight && (
                      <Moon className="size-3 shrink-0 text-indigo-500" aria-label="Overnight" />
                    )}
                    <span className="text-[11px] tabular-nums text-muted-foreground">
                      {formatHours(result.hours)}
                    </span>
                    <span className="min-w-[52px] text-right text-xs font-semibold tabular-nums text-foreground">
                      {formatINR(result.amount)}
                    </span>
                  </div>
                </>
              ) : (
                <>
                  <div className="col-span-2 md:col-span-3">
                    <p className="text-[11px] text-muted-foreground">No hours</p>
                  </div>
                  <div className="col-span-2 text-right md:col-span-1">
                    <span className="text-xs font-medium text-muted-foreground">Unpaid</span>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// =============================================================================
// Small presentational pieces
// =============================================================================

function SummaryCard({
  icon,
  label,
  value,
  tint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tint: 'emerald' | 'blue' | 'violet';
}) {
  const tints: Record<string, string> = {
    emerald: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400',
    blue: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
    violet: 'bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400',
  };
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border p-3 sm:block sm:p-4">
      <div className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${tints[tint]}`}>
        {icon}
      </div>
      <div className="min-w-0 sm:mt-2.5">
        <p className="truncate text-lg font-bold tabular-nums text-foreground">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

/** Shape-of-the-content placeholder, rather than a lone spinner. */
function SkeletonRows() {
  return (
    <div className="overflow-hidden rounded-xl border border-border" aria-busy="true">
      <div className="h-9 border-b border-border bg-muted/40" />
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="flex items-center gap-3 border-b border-border px-3 py-4 last:border-b-0"
        >
          <div className="size-8 shrink-0 animate-pulse rounded-full bg-muted" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-32 animate-pulse rounded bg-muted" />
            <div className="h-2.5 w-20 animate-pulse rounded bg-muted" />
          </div>
          <div className="hidden h-8 w-28 animate-pulse rounded-lg bg-muted sm:block" />
          <div className="hidden h-8 w-24 animate-pulse rounded-lg bg-muted md:block" />
          <div className="h-3 w-16 animate-pulse rounded bg-muted" />
        </div>
      ))}
      <span className="sr-only">Loading attendance</span>
    </div>
  );
}

function EmptyState({
  icon,
  title,
  hint,
}: {
  icon: React.ReactNode;
  title: string;
  hint: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border px-6 py-14 text-center">
      <div className="mb-3 flex size-12 items-center justify-center rounded-full bg-muted">
        {icon}
      </div>
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="mt-1 max-w-xs text-xs leading-relaxed text-muted-foreground">{hint}</p>
    </div>
  );
}

/**
 * Local modal, matching the private ones in `staff-client.tsx` and
 * `payroll-client.tsx` — this codebase has no shared modal primitive.
 */
function Modal({
  children,
  onClose,
  title,
}: {
  children: React.ReactNode;
  onClose: () => void;
  title: string;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    // Stop the page behind from scrolling while the dialog is open.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative z-10 max-h-[92vh] w-full max-w-md overflow-hidden rounded-t-2xl border border-border bg-card shadow-2xl sm:rounded-2xl"
      >
        {children}
      </div>
    </div>
  );
}
