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
  Users,
  Wallet,
  Wand2,
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
  formatHours,
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
// =============================================================================

/** Default shift the "apply to everyone" button fills in. */
const DEFAULT_SHIFT_IN = '10:00';
const DEFAULT_SHIFT_OUT = '20:00';

type Mode = 'day' | 'month';

export function StaffAttendance() {
  const [mode, setMode] = useState<Mode>('day');

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-border bg-gradient-to-br from-indigo-500/5 to-transparent px-4 py-4 sm:px-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-indigo-100 dark:bg-indigo-900/30">
            <Clock className="size-4 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-foreground">Attendance &amp; Pay</h2>
            <p className="text-xs text-muted-foreground">
              Record login and logout times — hours worked and wages are calculated for you
            </p>
          </div>
        </div>

        {/* View switch */}
        <div className="flex items-center rounded-xl border border-border bg-muted/50 p-1">
          {(
            [
              { value: 'day' as Mode, label: 'Daily entry', icon: CalendarDays },
              { value: 'month' as Mode, label: 'Monthly payout', icon: CalendarRange },
            ]
          ).map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => setMode(tab.value)}
              aria-pressed={mode === tab.value}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all sm:flex-none ${
                mode === tab.value
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <tab.icon className="size-3.5" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {mode === 'day' ? <DayView /> : <MonthView />}
    </div>
  );
}

// =============================================================================
// Daily entry
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
    setRows((prev) =>
      prev.map((r) => (r.employee_id === employeeId ? { ...r, ...changes } : r))
    );
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
      toast.success(`Copied ${touched} entr${touched === 1 ? 'y' : 'ies'} from ${prev.date}.`);
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

  const isToday = date === istToday();

  return (
    <div className="p-4 sm:p-6 space-y-4">
      {/* ── Date navigation + bulk helpers ─────────────────────────────────── */}
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <label htmlFor="attendance-date" className="text-[11px] font-medium text-muted-foreground">
              Date
            </label>
            <div className="mt-1 flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                aria-label="Previous day"
                onClick={() => setDate((d) => previousDay(d))}
              >
                <ChevronLeft className="size-4" />
              </Button>
              <Input
                id="attendance-date"
                type="date"
                value={date}
                max={istToday()}
                onChange={(e) => setDate(e.target.value || istToday())}
                className="w-[150px]"
              />
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
          </div>

          <div className="flex items-end gap-1.5">
            <div>
              <label htmlFor="shift-in" className="text-[11px] font-medium text-muted-foreground">
                Shift start
              </label>
              <Input
                id="shift-in"
                type="time"
                value={shiftIn}
                onChange={(e) => setShiftIn(e.target.value)}
                className="mt-1 w-[110px]"
              />
            </div>
            <div>
              <label htmlFor="shift-out" className="text-[11px] font-medium text-muted-foreground">
                Shift end
              </label>
              <Input
                id="shift-out"
                type="time"
                value={shiftOut}
                onChange={(e) => setShiftOut(e.target.value)}
                className="mt-1 w-[110px]"
              />
            </div>
            <Button variant="outline" onClick={applyShiftToAll} disabled={loading || rows.length === 0}>
              <Wand2 className="size-3.5" />
              Apply to all
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={copyPrevious} disabled={loading || rows.length === 0}>
            <Copy className="size-3.5" />
            Copy previous day
          </Button>
          <Button variant="outline" onClick={() => setShowRates(true)} disabled={rows.length === 0}>
            <Wallet className="size-3.5" />
            Hourly rates
          </Button>
          <Button onClick={handleSave} disabled={saving || loading || dirtyRows.length === 0}>
            {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
            {dirtyRows.length > 0 ? `Save ${dirtyRows.length}` : 'Save'}
          </Button>
        </div>
      </div>

      {/* Rates not set yet — the calculation can't produce money without them. */}
      {needsRates && !loading && rows.length > 0 && (
        <div className="flex flex-col gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs dark:border-amber-800/40 dark:bg-amber-900/20 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <p className="text-amber-800 dark:text-amber-200">
              No hourly rates set yet. Hours will still be recorded, but wages show as ₹0 until you
              add a rate for each staff member.
            </p>
          </div>
          <Button variant="outline" onClick={() => setShowRates(true)} className="shrink-0">
            Set rates
          </Button>
        </div>
      )}

      {/* ── The grid ───────────────────────────────────────────────────────── */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="mb-3 flex size-12 items-center justify-center rounded-full bg-muted">
            <Users className="size-6 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium text-foreground">No active staff</p>
          <p className="mt-1 max-w-xs text-xs text-muted-foreground">
            Add a staff member above, then come back to record their attendance.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border">
          <div className="hidden bg-muted/40 px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground lg:grid lg:grid-cols-[minmax(150px,1.5fr)_130px_110px_110px_92px_minmax(130px,1fr)] lg:gap-3">
            <div>Staff</div>
            <div>Status</div>
            <div>Login</div>
            <div>Logout</div>
            <div>Break</div>
            <div className="text-right">Hours &amp; pay</div>
          </div>

          {rows.map((row) => (
            <DayRow
              key={row.employee_id}
              row={row}
              dirty={!sameRow(editableOf(row), original[row.employee_id] ?? editableOf(row))}
              onChange={(changes) => patch(row.employee_id, changes)}
            />
          ))}

          {/* Day total */}
          <div className="grid grid-cols-2 items-center gap-3 border-t-2 border-border bg-muted/50 px-3 py-3 text-sm lg:grid-cols-[minmax(150px,1.5fr)_130px_110px_110px_92px_minmax(130px,1fr)]">
            <div className="font-semibold text-foreground lg:col-span-3">
              {totals.daysWorked} of {rows.length} working
              {totals.daysAbsent + totals.daysLeave + totals.daysWeekOff > 0 && (
                <span className="ml-1.5 font-normal text-muted-foreground">
                  ({[
                    totals.daysAbsent > 0 ? `${totals.daysAbsent} absent` : null,
                    totals.daysLeave > 0 ? `${totals.daysLeave} leave` : null,
                    totals.daysWeekOff > 0 ? `${totals.daysWeekOff} off` : null,
                  ]
                    .filter(Boolean)
                    .join(', ')})
                </span>
              )}
            </div>
            <div className="hidden lg:col-span-2 lg:block" />
            <div className="text-right">
              <p className="font-bold text-foreground">{formatINR(totals.totalAmount)}</p>
              <p className="text-[11px] text-muted-foreground">{formatHours(totals.totalHours)} total</p>
            </div>
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
  dirty,
  onChange,
}: {
  row: AttendanceDayRow;
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
      className={`grid grid-cols-2 gap-x-3 gap-y-2 border-t border-border px-3 py-3 text-sm lg:grid-cols-[minmax(150px,1.5fr)_130px_110px_110px_92px_minmax(130px,1fr)] lg:items-center ${
        dirty ? 'bg-primary/[0.04]' : ''
      }`}
    >
      {/* Staff */}
      <div className="col-span-2 flex min-w-0 items-center gap-2.5 lg:col-span-1">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
          {row.employee_name.charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 truncate font-medium text-foreground">
            {row.employee_name}
            {row.recorded && !dirty && (
              <Check className="size-3 shrink-0 text-emerald-500" aria-label="Saved" />
            )}
          </p>
          <p className="text-[11px] text-muted-foreground">
            <span className="capitalize">{row.role}</span>
            {row.hourly_rate > 0 ? ` · ₹${row.hourly_rate}/hr` : ' · no rate'}
          </p>
        </div>
      </div>

      {/* Status */}
      <Field label="Status" className="col-span-2 lg:col-span-1">
        <select
          aria-label={`Attendance status for ${row.employee_name}`}
          value={row.status}
          onChange={(e) => onChange({ status: e.target.value as AttendanceStatus })}
          className="h-8 w-full rounded-lg border border-border bg-background px-2 text-sm"
        >
          {ATTENDANCE_STATUSES.map((status) => (
            <option key={status} value={status}>
              {ATTENDANCE_STATUS_LABELS[status]}
            </option>
          ))}
        </select>
      </Field>

      {/* Login */}
      <Field label="Login">
        <Input
          type="time"
          aria-label={`Login time for ${row.employee_name}`}
          value={row.login_time}
          disabled={!payable}
          onChange={(e) => onChange({ login_time: e.target.value })}
        />
      </Field>

      {/* Logout */}
      <Field label="Logout">
        <Input
          type="time"
          aria-label={`Logout time for ${row.employee_name}`}
          value={row.logout_time}
          disabled={!payable}
          onChange={(e) => onChange({ logout_time: e.target.value })}
        />
      </Field>

      {/* Break */}
      <Field label="Break (min)">
        <Input
          type="number"
          min={0}
          max={1440}
          step={15}
          aria-label={`Unpaid break minutes for ${row.employee_name}`}
          value={row.break_minutes === 0 ? '' : String(row.break_minutes)}
          placeholder="0"
          disabled={!payable}
          onChange={(e) => {
            const parsed = Number(e.target.value);
            onChange({
              break_minutes: Number.isFinite(parsed) ? Math.min(1440, Math.max(0, parsed)) : 0,
            });
          }}
        />
      </Field>

      {/* Result */}
      <div className="col-span-2 text-right lg:col-span-1">
        {payable ? (
          <>
            <p className="font-semibold text-foreground">{formatINR(result.amount)}</p>
            <p className="flex items-center justify-end gap-1 text-[11px] text-muted-foreground">
              {result.overnight && (
                <Moon className="size-3 text-indigo-500" aria-label="Overnight shift" />
              )}
              {formatHours(result.hours)}
            </p>
          </>
        ) : (
          <p className="text-xs text-muted-foreground">{ATTENDANCE_STATUS_LABELS[row.status]} — unpaid</p>
        )}
        {result.warning && payable && (
          <p className="mt-0.5 text-[11px] text-amber-600 dark:text-amber-400">{result.warning}</p>
        )}
      </div>
    </div>
  );
}

/** Wraps a control with a label that only shows on narrow screens. */
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
    <div className={className}>
      <span className="mb-0.5 block text-[11px] font-medium text-muted-foreground lg:hidden">
        {label}
      </span>
      {children}
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

  const handleSave = async () => {
    setSaving(true);
    const failures: string[] = [];

    for (const row of rows) {
      const raw = values[row.employee_id] ?? '';
      const rate = raw === '' ? 0 : Number(raw);
      if (rate === row.hourly_rate) continue;
      const res = await setEmployeeHourlyRate(row.employee_id, rate);
      if (!res.success) failures.push(`${row.employee_name}: ${res.error}`);
    }

    setSaving(false);
    if (failures.length > 0) {
      toast.error(failures[0]);
      return;
    }
    toast.success('Hourly rates updated.');
    onSaved();
  };

  return (
    <Modal onClose={onClose}>
      <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Hourly rates</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Used to price every day recorded from now on. Days already saved keep the rate they were
            saved with, so a raise never rewrites past wages.
          </p>
        </div>
        <Button variant="ghost" size="icon" aria-label="Close" onClick={onClose}>
          <X className="size-4" />
        </Button>
      </div>

      <div className="max-h-[55vh] space-y-2 overflow-y-auto px-5 py-4">
        {rows.map((row) => (
          <div key={row.employee_id} className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">{row.employee_name}</p>
              <p className="text-[11px] capitalize text-muted-foreground">{row.role}</p>
            </div>
            <div className="flex items-center gap-1.5">
              <IndianRupee className="size-3.5 text-muted-foreground" />
              <Input
                type="number"
                min={0}
                step={10}
                aria-label={`Hourly rate for ${row.employee_name}`}
                value={values[row.employee_id] ?? ''}
                placeholder="0"
                onChange={(e) =>
                  setValues((prev) => ({ ...prev, [row.employee_id]: e.target.value }))
                }
                className="w-24"
              />
              <span className="text-xs text-muted-foreground">/hr</span>
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-end gap-2 border-t border-border px-5 py-4">
        <Button variant="outline" onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
          Save rates
        </Button>
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

  return (
    <div className="space-y-4 p-4 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <label htmlFor="attendance-month" className="text-[11px] font-medium text-muted-foreground">
            Month
          </label>
          <Input
            id="attendance-month"
            type="month"
            value={month}
            max={istCurrentMonth()}
            onChange={(e) => setMonth(e.target.value || istCurrentMonth())}
            className="mt-1 w-[170px]"
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
            { header: 'Payroll', value: (r) => (r.payrollPaid ? 'Paid' : r.payrollExists ? 'Pending' : 'Not raised') },
          ]}
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : summaries.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="mb-3 flex size-12 items-center justify-center rounded-full bg-muted">
            <CalendarRange className="size-6 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium text-foreground">Nothing to show for this month</p>
          <p className="mt-1 max-w-xs text-xs text-muted-foreground">
            Record attendance on the Daily entry tab and the monthly payout will build up here.
          </p>
        </div>
      ) : (
        <>
          {/* Month headline */}
          <div className="grid grid-cols-3 gap-3">
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
            <div className="hidden bg-muted/40 px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground lg:grid lg:grid-cols-[minmax(150px,1.4fr)_repeat(3,minmax(80px,0.7fr))_minmax(150px,1fr)] lg:gap-3">
              <div>Staff</div>
              <div className="text-center">Worked</div>
              <div className="text-center">Off</div>
              <div className="text-right">Hours</div>
              <div className="text-right">Payable</div>
            </div>

            {summaries.map((row) => (
              <div key={row.employee_id}>
                <div className="grid grid-cols-2 items-center gap-x-3 gap-y-2 border-t border-border px-3 py-3 text-sm lg:grid-cols-[minmax(150px,1.4fr)_repeat(3,minmax(80px,0.7fr))_minmax(150px,1fr)]">
                  <div className="col-span-2 flex min-w-0 items-center gap-2 lg:col-span-1">
                    <button
                      type="button"
                      onClick={() =>
                        setExpanded((id) => (id === row.employee_id ? null : row.employee_id))
                      }
                      aria-expanded={expanded === row.employee_id}
                      className="flex min-w-0 items-center gap-2 text-left hover:opacity-80"
                    >
                      <ChevronDown
                        className={`size-4 shrink-0 text-muted-foreground transition-transform ${
                          expanded === row.employee_id ? 'rotate-180' : ''
                        }`}
                      />
                      <div className="min-w-0">
                        <p className="truncate font-medium text-foreground">{row.employee_name}</p>
                        <p className="text-[11px] text-muted-foreground">
                          <span className="capitalize">{row.role}</span>
                          {row.hourly_rate > 0 ? ` · ₹${row.hourly_rate}/hr` : ''}
                        </p>
                      </div>
                    </button>
                  </div>

                  <Field label="Worked" className="text-center">
                    <span className="text-foreground">{row.daysWorked}</span>
                  </Field>
                  <Field label="Off" className="text-center">
                    <span className="text-muted-foreground">
                      {row.daysAbsent + row.daysLeave + row.daysWeekOff}
                    </span>
                  </Field>
                  <Field label="Hours" className="lg:text-right">
                    <span className="text-foreground">{formatHours(row.totalHours)}</span>
                  </Field>

                  <div className="col-span-2 flex items-center justify-between gap-2 lg:col-span-1 lg:justify-end">
                    <p className="font-semibold text-foreground">{formatINR(row.totalAmount)}</p>
                    {row.payrollPaid ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                        <Check className="size-3" />
                        Paid
                      </span>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
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

                {expanded === row.employee_id && (
                  <EmployeeMonthEditor
                    employeeId={row.employee_id}
                    employeeName={row.employee_name}
                    month={month}
                    hourlyRate={row.hourly_rate}
                    onSaved={reload}
                  />
                )}
              </div>
            ))}

            <div className="grid grid-cols-2 items-center gap-3 border-t-2 border-border bg-muted/50 px-3 py-3 text-sm lg:grid-cols-[minmax(150px,1.4fr)_repeat(3,minmax(80px,0.7fr))_minmax(150px,1fr)]">
              <div className="font-semibold text-foreground lg:col-span-4">Total</div>
              <div className="text-right font-bold text-foreground lg:text-right">
                {formatINR(totals.amount)}
              </div>
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

  const rateFor = (date: string) => rates[date] ?? hourlyRate;

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
            // Inlined rather than via `rateFor` so the dependency list is honest.
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
    <div className="border-t border-border bg-muted/20 px-3 py-3">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          Every day in {month}. {formatHours(totals.totalHours)} ·{' '}
          <span className="font-semibold text-foreground">{formatINR(totals.totalAmount)}</span>
        </p>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fillMonth}>
            <Wand2 className="size-3" />
            Fill standard shift
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving || dirtyDates.length === 0}>
            {saving ? <Loader2 className="size-3 animate-spin" /> : <Save className="size-3" />}
            {dirtyDates.length > 0 ? `Save ${dirtyDates.length}` : 'Save'}
          </Button>
        </div>
      </div>

      <div className="max-h-[420px] overflow-y-auto rounded-lg border border-border bg-background">
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
            hourly_rate: rateFor(date),
          });
          const payable = isPayableStatus(row.status);

          return (
            <div
              key={date}
              className={`flex flex-wrap items-center gap-2 border-b border-border px-2.5 py-2 text-xs last:border-b-0 ${
                dirty ? 'bg-primary/[0.04]' : future ? 'opacity-50' : ''
              }`}
            >
              <div className="w-[86px] shrink-0">
                <p className="font-medium text-foreground">{date.slice(8)} {weekdayLabel(date)}</p>
                {isWeekend(date) && <p className="text-[10px] text-muted-foreground">Weekend</p>}
              </div>

              <select
                aria-label={`Status on ${date}`}
                value={row.status}
                disabled={future}
                onChange={(e) => patch(date, { status: e.target.value as AttendanceStatus })}
                className="h-7 w-[104px] shrink-0 rounded-lg border border-border bg-background px-1.5 text-xs disabled:opacity-50"
              >
                {ATTENDANCE_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {ATTENDANCE_STATUS_LABELS[status]}
                  </option>
                ))}
              </select>

              <Input
                type="time"
                aria-label={`Login time on ${date}`}
                value={row.login_time}
                disabled={!payable || future}
                onChange={(e) => patch(date, { login_time: e.target.value })}
                className="h-7 w-[104px] shrink-0 text-xs"
              />
              <Input
                type="time"
                aria-label={`Logout time on ${date}`}
                value={row.logout_time}
                disabled={!payable || future}
                onChange={(e) => patch(date, { logout_time: e.target.value })}
                className="h-7 w-[104px] shrink-0 text-xs"
              />
              <Input
                type="number"
                min={0}
                max={1440}
                step={15}
                aria-label={`Break minutes on ${date}`}
                value={row.break_minutes === 0 ? '' : String(row.break_minutes)}
                placeholder="brk"
                disabled={!payable || future}
                onChange={(e) => {
                  const parsed = Number(e.target.value);
                  patch(date, {
                    break_minutes: Number.isFinite(parsed) ? Math.min(1440, Math.max(0, parsed)) : 0,
                  });
                }}
                className="h-7 w-[68px] shrink-0 text-xs"
              />

              <div className="ml-auto flex items-center gap-1.5 text-right">
                {result.overnight && <Moon className="size-3 text-indigo-500" aria-label="Overnight" />}
                <span className="text-muted-foreground">{formatHours(result.hours)}</span>
                <span className="w-16 font-semibold text-foreground">{formatINR(result.amount)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

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
    <div className="rounded-xl border border-border p-3 sm:p-4">
      <div className={`flex size-8 items-center justify-center rounded-lg ${tints[tint]}`}>{icon}</div>
      <p className="mt-2.5 truncate text-base font-bold text-foreground sm:text-lg">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

/**
 * Local modal, matching the private ones in `staff-client.tsx` and
 * `payroll-client.tsx` — this codebase has no shared modal primitive.
 */
function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Hourly rates"
        className="relative z-10 w-full max-w-md overflow-hidden rounded-2xl border border-border bg-card shadow-xl"
      >
        {children}
      </div>
    </div>
  );
}
