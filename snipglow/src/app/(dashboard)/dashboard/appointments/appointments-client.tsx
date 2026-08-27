'use client';

import { useState, useTransition, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { formatDateIN, formatTimeIST, calculatePerItemInvoiceTotal } from '@/lib/utils';
import { DataTable, type Column } from '@/components/data-table';
import { RoleGuard } from '@/components/role-guard';
import { RowActionsMenu, type RowAction } from '@/components/row-actions-menu';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CalendarView } from './calendar-view';
import { updateAppointmentStatus, rescheduleAppointment, getSlotsForReschedule, completeAndGenerateBill, updateAppointmentServices, getActiveServices, getActiveEmployees, getActiveProducts, getCustomerMembershipDiscount } from './actions';
import { getCustomerWalletBalance } from '../customers/wallet-actions';
import { SearchableSelect } from '@/components/searchable-select';
import {
  Calendar,
  List,
  Plus,
  Filter,
  CalendarDays,
  Clock,
  User,
  Scissors,
  CalendarCheck,
  CheckCircle2,
  XCircle,
  CircleCheck,
  CalendarClock,
  Pencil,
  Wallet,
} from 'lucide-react';
import type { AppointmentRow, AppointmentStats } from './page';
import type { AppointmentStatus, UserRole, TimeSlot } from '@/types';

// =============================================================================
// AppointmentsClient — Client component with view toggle and status filter
// =============================================================================

interface AppointmentsClientProps {
  appointments: AppointmentRow[];
  role: UserRole;
  stats: AppointmentStats;
}

type ViewMode = 'list' | 'calendar';

/** Status badge color mapping */
const statusColors: Record<AppointmentStatus, string> = {
  booked: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  confirmed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  completed: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400',
  cancelled: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

const statusDots: Record<AppointmentStatus, string> = {
  booked: 'bg-blue-500',
  confirmed: 'bg-emerald-500',
  completed: 'bg-gray-400',
  cancelled: 'bg-red-500',
};

function StatusBadge({ status }: { status: AppointmentStatus }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${statusColors[status]}`}
    >
      <span className={`size-1.5 rounded-full ${statusDots[status]}`} />
      {status}
    </span>
  );
}

/** Format a time string (HH:MM:SS) to 12-hour AM/PM */
function formatSlotTime(time: string): string {
  const [hours, minutes] = time.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHour = hours % 12 || 12;
  return `${displayHour}:${minutes.toString().padStart(2, '0')} ${period}`;
}

function getToday(): string {
  return new Date().toISOString().split('T')[0];
}

function getMaxDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d.toISOString().split('T')[0];
}

/** Mon–Sun date range (YYYY-MM-DD) for an <input type="week"> value like "2026-W27". */
function weekRangeFromInput(weekStr: string): { start: string; end: string } | null {
  const m = /^(\d{4})-W(\d{2})$/.exec(weekStr);
  if (!m) return null;
  const year = Number(m[1]);
  const week = Number(m[2]);
  // ISO: Jan 4th is always in week 1; week starts Monday.
  const jan4 = new Date(year, 0, 4);
  const jan4Dow = (jan4.getDay() + 6) % 7; // Mon=0 … Sun=6
  const week1Monday = new Date(jan4);
  week1Monday.setDate(jan4.getDate() - jan4Dow);
  const monday = new Date(week1Monday);
  monday.setDate(week1Monday.getDate() + (week - 1) * 7);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return { start: fmt(monday), end: fmt(sunday) };
}

export function AppointmentsClient({ appointments, role, stats }: AppointmentsClientProps) {
  const [view, setView] = useState<ViewMode>('list');
  const [statusFilter, setStatusFilter] = useState<AppointmentStatus | 'all'>('all');
  // List-view date filters (calendar has its own rolling window).
  const [dateFilter, setDateFilter] = useState<string>('');
  const [monthFilter, setMonthFilter] = useState<string>('');
  const [weekFilter, setWeekFilter] = useState<string>('');

  const weekRange = weekFilter ? weekRangeFromInput(weekFilter) : null;

  const filtered = appointments.filter((apt) => {
    if (statusFilter !== 'all' && apt.status !== statusFilter) return false;
    // Date/month/week filters narrow the LIST rows. In calendar view they
    // instead drive which week is shown (via focusDate below).
    if (view === 'list') {
      if (dateFilter && apt.appointment_date !== dateFilter) return false;
      if (monthFilter && !apt.appointment_date.startsWith(monthFilter)) return false;
      if (weekRange && !(apt.appointment_date >= weekRange.start && apt.appointment_date <= weekRange.end)) return false;
    }
    return true;
  });

  // The date the calendar's 7-day window should jump to when a filter is set:
  // an exact date wins, else the selected week's Monday, else the month's 1st.
  const calendarFocusDate = dateFilter || weekRange?.start || (monthFilter ? `${monthFilter}-01` : '');

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-500/10 via-blue-500/5 to-transparent border border-blue-200/50 dark:border-blue-800/30 p-6">
        <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-xl bg-blue-100 dark:bg-blue-900/30">
              <CalendarDays className="size-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">Appointments</h1>
              <p className="text-sm text-muted-foreground">
                {filtered.length} {statusFilter === 'all' ? 'total' : statusFilter} appointment{filtered.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as AppointmentStatus | 'all')}
                className="h-10 min-w-[170px] rounded-xl border border-border bg-background pl-9 pr-10 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-ring appearance-none cursor-pointer"
                aria-label="Filter by status"
              >
                <option value="all">All Status</option>
                <option value="booked">Booked</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
              <svg className="absolute right-3.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
            </div>

            <div className="flex items-center rounded-xl border border-border bg-muted/50 p-1">
              <button
                onClick={() => setView('list')}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 min-h-[44px] sm:min-h-0 text-xs font-medium transition-all ${
                  view === 'list' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                }`}
                aria-label="List view"
              >
                <List className="size-3.5" />
                List
              </button>
              <button
                onClick={() => setView('calendar')}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 min-h-[44px] sm:min-h-0 text-xs font-medium transition-all ${
                  view === 'calendar' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                }`}
                aria-label="Calendar view"
              >
                <Calendar className="size-3.5" />
                Calendar
              </button>
            </div>

            <RoleGuard role={role} action="create" resource="appointments">
              <Link href="/dashboard/appointments/new">
                <Button className="rounded-xl gap-1.5 min-h-[44px] sm:min-h-0">
                  <Plus className="size-4" />
                  <span className="hidden sm:inline">New Booking</span>
                  <span className="sm:hidden">Book</span>
                </Button>
              </Link>
            </RoleGuard>
          </div>
        </div>
        <div className="absolute -right-6 -top-6 h-32 w-32 rounded-full bg-blue-500/5" />
        <div className="absolute -right-2 top-10 h-20 w-20 rounded-full bg-blue-400/5" />
      </div>

      {/* Analytics Bar */}
      <AppointmentStatsBar stats={stats} />

      {/* Date / month / week filters — filter the list; drive the calendar's week */}
      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-border bg-card p-4">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">Date</label>
          <input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="h-10 w-full sm:w-44 rounded-xl border border-border bg-background px-3 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            aria-label="Filter by date"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">Month</label>
          <input
            type="month"
            value={monthFilter}
            onChange={(e) => setMonthFilter(e.target.value)}
            className="h-10 w-full sm:w-44 rounded-xl border border-border bg-background px-3 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            aria-label="Filter by month"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">Week</label>
          <input
            type="week"
            value={weekFilter}
            onChange={(e) => setWeekFilter(e.target.value)}
            className="h-10 w-full sm:w-44 rounded-xl border border-border bg-background px-3 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            aria-label="Filter by week"
          />
        </div>
        {(dateFilter || monthFilter || weekFilter) && (
          <button
            type="button"
            onClick={() => { setDateFilter(''); setMonthFilter(''); setWeekFilter(''); }}
            className="h-10 rounded-xl border border-border px-4 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          >
            Clear filters
          </button>
        )}
      </div>

      {view === 'list' ? (
        <AppointmentListView appointments={filtered} role={role} />
      ) : (
        <CalendarView appointments={filtered} focusDate={calendarFocusDate} />
      )}
    </div>
  );
}

// =============================================================================
// Appointment Stats Bar — today / this week / this month volume
// =============================================================================

function AppointmentStatsBar({ stats }: { stats: AppointmentStats }) {
  const cards = [
    {
      key: 'today',
      label: 'Today',
      value: stats.today,
      icon: <CalendarCheck className="size-4" />,
      iconBg: 'bg-emerald-100 dark:bg-emerald-900/30',
      iconColor: 'text-emerald-600 dark:text-emerald-400',
    },
    {
      key: 'week',
      label: 'This Week',
      value: stats.week,
      icon: <CalendarDays className="size-4" />,
      iconBg: 'bg-blue-100 dark:bg-blue-900/30',
      iconColor: 'text-blue-600 dark:text-blue-400',
    },
    {
      key: 'month',
      label: 'This Month',
      value: stats.month,
      icon: <CalendarClock className="size-4" />,
      iconBg: 'bg-violet-100 dark:bg-violet-900/30',
      iconColor: 'text-violet-600 dark:text-violet-400',
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {cards.map((c) => (
        <div
          key={c.key}
          className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 transition-all hover:shadow-sm"
        >
          <div className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${c.iconBg} ${c.iconColor}`}>
            {c.icon}
          </div>
          <div className="min-w-0">
            <p className="text-2xl font-bold leading-tight text-foreground">{c.value}</p>
            <p className="text-xs font-medium text-muted-foreground">
              {c.label} · {c.value === 1 ? 'appointment' : 'appointments'}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

// =============================================================================
// List View with Actions + Reschedule Modal
// =============================================================================

function AppointmentListView({ appointments, role }: { appointments: AppointmentRow[]; role: UserRole }) {
  const [isPending, startTransition] = useTransition();
  const [actionId, setActionId] = useState<string | null>(null);
  const [rescheduleTarget, setRescheduleTarget] = useState<AppointmentRow | null>(null);
  const [completeTarget, setCompleteTarget] = useState<AppointmentRow | null>(null);
  const [editTarget, setEditTarget] = useState<AppointmentRow | null>(null);
  const [cancelTarget, setCancelTarget] = useState<AppointmentRow | null>(null);
  const [cancelError, setCancelError] = useState('');

  function closeCancel() {
    setCancelTarget(null);
    setCancelError('');
  }

  function handleConfirmCancel() {
    if (!cancelTarget) return;
    const id = cancelTarget.id;
    const name = cancelTarget.customer_name;
    setActionId(id);
    setCancelError('');
    startTransition(async () => {
      const result = await updateAppointmentStatus(id, 'cancelled');
      setActionId(null);
      if (result.success) {
        toast.success(`${name}'s appointment was cancelled. They have been notified on WhatsApp.`);
        closeCancel();
        return;
      }
      // Keep the dialog open so the reason stays on screen and the user can
      // retry. Silently closing here is what made a failed cancel look like a
      // slow one, so staff clicked again.
      setCancelError(result.error);
    });
  }

  const columns: Column<AppointmentRow>[] = [
    {
      key: 'customer',
      header: 'Customer',
      render: (row) => (
        row.customer_id ? (
          <Link
            href={`/dashboard/customers/${row.customer_id}`}
            className="group flex items-center gap-2"
          >
            <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-salon-rose/20 to-salon-gold/20">
              <User className="size-3.5 text-salon-rose" />
            </div>
            <span className="font-medium text-foreground group-hover:text-salon-rose group-hover:underline transition-colors">
              {row.customer_name}
            </span>
          </Link>
        ) : (
          <div className="flex items-center gap-2">
            <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-salon-rose/20 to-salon-gold/20">
              <User className="size-3.5 text-salon-rose" />
            </div>
            <span className="font-medium text-foreground">{row.customer_name}</span>
          </div>
        )
      ),
    },
    {
      key: 'service',
      header: 'Service',
      render: (row) => (
        <div className="flex items-center gap-1.5">
          <Scissors className="size-3.5 text-muted-foreground" />
          <span className="text-foreground">{row.service_name}</span>
        </div>
      ),
    },
    {
      key: 'stylist',
      header: 'Stylist',
      render: (row) => <span className="text-muted-foreground">{row.employee_name}</span>,
    },
    {
      key: 'date',
      header: 'Date',
      render: (row) => (
        <div className="flex items-center gap-1.5">
          <CalendarCheck className="size-3.5 text-muted-foreground" />
          <span className="text-muted-foreground">{formatDateIN(row.appointment_date)}</span>
        </div>
      ),
    },
    {
      key: 'time',
      header: 'Time',
      render: (row) => (
        <div className="flex items-center gap-1.5">
          <Clock className="size-3.5 text-muted-foreground" />
          <span className="text-muted-foreground">
            {formatTimeIST(`1970-01-01T${row.start_time}`)}
          </span>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: 'source',
      header: 'Booked Via',
      render: (row) => (
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
          row.source === 'whatsapp_flow' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
          'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
        }`}>
          {row.source === 'whatsapp_flow' ? 'WhatsApp' : 'Dashboard'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (row) => {
        const loading = isPending && actionId === row.id;
        const canAct = row.status === 'booked' || row.status === 'confirmed';
        if (!canAct) return <span className="text-xs text-muted-foreground">—</span>;
        const actions: RowAction[] = [
          { label: 'Edit', icon: <Pencil className="size-3.5" />, onClick: () => setEditTarget(row) },
          { label: 'Reschedule', icon: <CalendarClock className="size-3.5" />, onClick: () => setRescheduleTarget(row) },
          { label: 'Mark complete', icon: <CircleCheck className="size-3.5" />, disabled: loading, onClick: () => setCompleteTarget(row) },
          { label: 'Cancel', icon: <XCircle className="size-3.5" />, danger: true, disabled: loading, onClick: () => setCancelTarget(row) },
        ];
        return <RowActionsMenu actions={actions} />;
      },
    },
  ];

  if (appointments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-card p-12 text-center">
        <div className="flex size-14 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-900/20 mb-4">
          <CalendarDays className="size-6 text-blue-500" />
        </div>
        <h3 className="text-base font-semibold text-foreground">No appointments found</h3>
        <p className="text-sm text-muted-foreground mt-1 max-w-sm">
          No appointments match your current filter. Try changing the status filter or create a new booking.
        </p>
        <Link href="/dashboard/appointments/new">
          <Button className="mt-4 rounded-xl gap-1.5" variant="outline">
            <Plus className="size-4" />
            Book Appointment
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-xl border border-border overflow-hidden">
        <DataTable
          columns={columns}
          data={appointments}
          getRowKey={(row) => row.id}
          emptyMessage="No appointments found"
        />
      </div>

      {/* Reschedule Modal */}
      {rescheduleTarget && (
        <RescheduleModal
          appointment={rescheduleTarget}
          onClose={() => setRescheduleTarget(null)}
        />
      )}

      {/* Complete & Bill Modal */}
      {completeTarget && (
        <CompleteAndBillModal
          appointment={completeTarget}
          role={role}
          onClose={() => setCompleteTarget(null)}
        />
      )}

      {/* Edit Services Modal */}
      {editTarget && (
        <EditServicesModal
          appointment={editTarget}
          onClose={() => setEditTarget(null)}
        />
      )}

      {/* Cancel Confirmation */}
      <ConfirmDialog
        open={!!cancelTarget}
        title="Cancel this appointment?"
        message={
          cancelTarget ? (
            <>
              This will cancel <span className="font-medium text-foreground">{cancelTarget.customer_name}</span>&apos;s
              appointment on {formatDateIN(cancelTarget.appointment_date)} and notify them on WhatsApp. This cannot be undone.
            </>
          ) : ''
        }
        confirmLabel="Yes, Cancel"
        cancelLabel="Keep It"
        pending={isPending && actionId === cancelTarget?.id}
        pendingLabel="Cancelling..."
        error={cancelError}
        onConfirm={handleConfirmCancel}
        onClose={closeCancel}
      />
    </>
  );
}

// =============================================================================
// Reschedule Modal
// =============================================================================

function RescheduleModal({
  appointment,
  onClose,
}: {
  appointment: AppointmentRow;
  onClose: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [newDate, setNewDate] = useState('');
  const [selectedSlot, setSelectedSlot] = useState('');
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [error, setError] = useState('');

  // We need the employee_id and service duration to fetch slots.
  // These are stored on the appointment row from the server.
  // Since AppointmentRow doesn't have employee_id directly, we'll use the
  // rescheduleAppointment action which handles fetching internally.

  // Fetch slots when date changes
  const fetchSlots = useCallback(async () => {
    if (!newDate || !appointment.id) return;
    setLoadingSlots(true);
    setSlots([]);
    setSelectedSlot('');

    const available = await getSlotsForReschedule(appointment.id, newDate);
    setSlots(available);
    setLoadingSlots(false);
  }, [newDate, appointment.id]);

  useEffect(() => {
    if (newDate) fetchSlots();
  }, [newDate, fetchSlots]);

  function handleSubmit() {
    if (!newDate || !selectedSlot) return;
    setError('');

    const [startTime, endTime] = selectedSlot.split('|');

    startTransition(async () => {
      const result = await rescheduleAppointment(appointment.id, {
        appointment_date: newDate,
        start_time: startTime,
        end_time: endTime,
      });

      if (result.success) {
        onClose();
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl mx-4 max-h-[90vh] overflow-y-auto">
        <div className="space-y-5">
          {/* Header */}
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/20">
              <CalendarClock className="size-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">Reschedule Appointment</h2>
              <p className="text-xs text-muted-foreground">
                {appointment.customer_name} · {appointment.service_name}
              </p>
            </div>
          </div>

          {/* Current date/time */}
          <div className="rounded-lg bg-muted/50 px-4 py-3">
            <p className="text-xs text-muted-foreground">Current Schedule</p>
            <p className="text-sm font-medium text-foreground mt-0.5">
              {formatDateIN(appointment.appointment_date)} at {formatTimeIST(`1970-01-01T${appointment.start_time}`)}
            </p>
          </div>

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 dark:border-red-900/50 dark:bg-red-900/20">
              <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
            </div>
          )}

          {/* New Date */}
          <div className="space-y-1.5">
            <label htmlFor="reschedule-date" className="text-sm font-medium text-foreground">
              New Date
            </label>
            <Input
              id="reschedule-date"
              type="date"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
              min={getToday()}
              max={getMaxDate()}
            />
          </div>

          {/* Time Slot */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">New Time Slot</label>
            {!newDate ? (
              <p className="text-xs text-muted-foreground">Select a date first</p>
            ) : loadingSlots ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
                Loading slots...
              </div>
            ) : slots.length === 0 ? (
              <p className="text-sm text-muted-foreground">No available slots for this date.</p>
            ) : (
              <select
                value={selectedSlot}
                onChange={(e) => setSelectedSlot(e.target.value)}
                className="h-9 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Select a time slot...</option>
                {slots.map((slot) => (
                  <option
                    key={`${slot.slot_start}-${slot.slot_end}`}
                    value={`${slot.slot_start}|${slot.slot_end}`}
                  >
                    {formatSlotTime(slot.slot_start)} – {formatSlotTime(slot.slot_end)}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-2">
            <Button variant="outline" className="rounded-xl" onClick={onClose} disabled={isPending}>
              Cancel
            </Button>
            <Button
              className="rounded-xl gap-1.5"
              onClick={handleSubmit}
              disabled={!newDate || !selectedSlot || isPending}
            >
              {isPending ? 'Rescheduling...' : 'Reschedule'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Complete & Generate Bill Modal
// =============================================================================

function CompleteAndBillModal({
  appointment,
  role,
  onClose,
}: {
  appointment: AppointmentRow;
  role: UserRole;
  onClose: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'upi' | 'card'>('cash');
  const [serviceDiscounts, setServiceDiscounts] = useState<Record<string, number>>({});
  const [membershipInfo, setMembershipInfo] = useState<{ discountPct: number; membershipName: string } | null>(null);
  const [loadingMembership, setLoadingMembership] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState<{ invoiceNumber: string } | null>(null);
  // Wallet — owner/manager only (matches the wallet_debit_for_invoice RPC).
  const canUseWallet = role === 'owner' || role === 'manager';
  const [walletBalance, setWalletBalance] = useState(0);
  const [useWallet, setUseWallet] = useState(false);
  const [walletInput, setWalletInput] = useState('');
  /** Lookup FAILED — distinct from a genuine zero balance. */
  const [walletLoadFailed, setWalletLoadFailed] = useState(false);
  const [walletReloadKey, setWalletReloadKey] = useState(0);
  /** Set when the services/staff/products catalog fails to load. */
  const [listsError, setListsError] = useState('');
  const [listsReloadKey, setListsReloadKey] = useState(0);

  // Refresh server data (list + calendar reflect the completed/updated appt)
  // when closing after a successful bill.
  function handleClose() {
    if (success) router.refresh();
    onClose();
  }

  // Catalog + selections for cross-sell / staff attribution.
  const [catalog, setCatalog] = useState<{ id: string; name: string; price: number; category: string | null }[]>([]);
  const [employees, setEmployees] = useState<{ id: string; name: string; role: string }[]>([]);
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>(appointment.service_ids ?? []);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');
  const [addServiceId, setAddServiceId] = useState<string>('');
  const [loadingLists, setLoadingLists] = useState(true);
  // Retail products sold alongside the appointment.
  const [productCatalog, setProductCatalog] = useState<{ id: string; name: string; price: number; stock: number; unit: string; category: string | null }[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<{ id: string; name: string; price: number; quantity: number; maxStock: number; discount_pct: number }[]>([]);
  const [addProductId, setAddProductId] = useState<string>('');

  // Auto-fetch membership discount for this customer
  useEffect(() => {
    async function fetchMembership() {
      setLoadingMembership(true);
      const info = await getCustomerMembershipDiscount(appointment.customer_id);
      if (info && info.discountPct > 0) {
        setMembershipInfo(info);
      }
      setLoadingMembership(false);
    }
    fetchMembership();
  }, [appointment.customer_id]);

  // Fetch wallet balance (owner/manager only — staff can't debit wallets).
  //
  // A failed lookup used to be swallowed, which hid the wallet row entirely and
  // read to staff as "no store credit". Keep the usable balance at 0 but say so.
  useEffect(() => {
    if (!canUseWallet || !appointment.customer_id) return;
    let active = true;
    setWalletLoadFailed(false);
    getCustomerWalletBalance(appointment.customer_id)
      .then((bal) => { if (active) setWalletBalance(bal); })
      .catch(() => {
        if (!active) return;
        setWalletBalance(0);
        setWalletLoadFailed(true);
      });
    return () => { active = false; };
  }, [appointment.customer_id, canUseWallet, walletReloadKey]);

  // Load services catalog + staff list (owner shown first for default selection).
  useEffect(() => {
    async function load() {
      setLoadingLists(true);
      setListsError('');
      // Without this try/catch a rejected fetch left loadingLists true forever,
      // so the staff/service/product pickers stayed disabled and empty with no
      // explanation — the modal looked broken rather than failed.
      try {
        const [svc, emp, prods] = await Promise.all([getActiveServices(), getActiveEmployees(), getActiveProducts()]);
        setCatalog(svc.map((s) => ({ id: s.id, name: s.name, price: s.price, category: s.category ?? null })));
        setProductCatalog(prods.map((p) => ({ id: p.id, name: p.name, price: Number(p.selling_price), stock: Number(p.stock_quantity), unit: p.unit, category: p.category ?? null })));
        const emps = emp.map((e) => ({ id: e.id, name: e.name, role: e.role }));
        // Owner first, then the rest by name.
        emps.sort((a, b) => {
          if (a.role === 'owner' && b.role !== 'owner') return -1;
          if (b.role === 'owner' && a.role !== 'owner') return 1;
          return a.name.localeCompare(b.name);
        });
        setEmployees(emps);
        // Default staff: the appointment's assigned employee if present, else owner (first).
        const defaultEmp = emps.find((e) => e.id === appointment.employee_id) ?? emps[0];
        setSelectedEmployeeId(defaultEmp?.id ?? '');
        // Seed selected services from the appointment.
        setSelectedServiceIds(
          (appointment.service_ids && appointment.service_ids.length > 0)
            ? appointment.service_ids
            : []
        );
      } catch (err) {
        console.error('[appointments] could not load services/staff/products:', err);
        setListsError('Could not load services, staff and products. Check your connection and retry.');
      } finally {
        setLoadingLists(false);
      }
    }
    load();
  }, [appointment.employee_id, appointment.service_ids, listsReloadKey]);

  const selectedServices = catalog.filter((s) => selectedServiceIds.includes(s.id));
  const servicesSubtotal = selectedServices.reduce((sum, s) => sum + s.price, 0);
  const productsSubtotal = selectedProducts.reduce((sum, p) => sum + p.price * p.quantity, 0);
  const subtotal = servicesSubtotal + productsSubtotal;

  // Per-item discounts. Membership % is the default for any line not overridden.
  const membershipDiscountPct = membershipInfo?.discountPct ?? 0;
  const svcDisc = (id: string) => serviceDiscounts[id] ?? membershipDiscountPct;
  const billTotals = calculatePerItemInvoiceTotal({
    lineItems: [
      ...selectedServices.map((s) => ({ price: s.price, quantity: 1, discountPct: svcDisc(s.id) })),
      ...selectedProducts.map((p) => ({ price: p.price, quantity: p.quantity, discountPct: p.discount_pct ?? membershipDiscountPct })),
    ],
    gstRate: 0,
  });
  const discountAmount = billTotals.discountAmount;
  const discountedTotal = billTotals.total;

  // Wallet application: the amount to draw from the wallet is editable so the
  // customer can split the bill (e.g. part wallet, rest cash). Defaults to
  // covering as much as possible; clamped to the balance and the payable.
  const maxWallet = Math.min(walletBalance, discountedTotal);
  const parsedWallet = walletInput.trim() === '' ? maxWallet : Math.round(Number(walletInput));
  const walletApplied =
    useWallet && canUseWallet && Number.isFinite(parsedWallet)
      ? Math.max(0, Math.min(parsedWallet, maxWallet))
      : 0;
  const remainingPayable = Math.max(0, discountedTotal - walletApplied);
  const fullyWallet = walletApplied > 0 && remainingPayable === 0;

  function setServiceDiscount(id: string, pct: number) {
    const v = Math.min(100, Math.max(0, Number.isFinite(pct) ? pct : 0));
    setServiceDiscounts((prev) => ({ ...prev, [id]: v }));
  }
  function setProductDiscount(id: string, pct: number) {
    const v = Math.min(100, Math.max(0, Number.isFinite(pct) ? pct : 0));
    setSelectedProducts((prev) => prev.map((p) => (p.id === id ? { ...p, discount_pct: v } : p)));
  }

  function addService() {
    if (!addServiceId) return;
    if (!selectedServiceIds.includes(addServiceId)) {
      setSelectedServiceIds([...selectedServiceIds, addServiceId]);
    }
    setAddServiceId('');
  }

  function removeService(id: string) {
    setSelectedServiceIds(selectedServiceIds.filter((s) => s !== id));
  }

  function addProduct() {
    if (!addProductId) return;
    const prod = productCatalog.find((p) => p.id === addProductId);
    if (prod && !selectedProducts.some((p) => p.id === prod.id)) {
      setSelectedProducts([...selectedProducts, { id: prod.id, name: prod.name, price: prod.price, quantity: 1, maxStock: prod.stock, discount_pct: membershipDiscountPct }]);
    }
    setAddProductId('');
  }

  function removeProduct(id: string) {
    setSelectedProducts(selectedProducts.filter((p) => p.id !== id));
  }

  function setProductQty(id: string, qty: number) {
    setSelectedProducts(selectedProducts.map((p) =>
      p.id === id ? { ...p, quantity: Math.max(1, Math.min(p.maxStock || 1, qty)) } : p
    ));
  }

  function handleConfirm() {
    setError('');
    if (selectedServiceIds.length === 0) {
      setError('Add at least one service before generating the bill.');
      return;
    }
    if (!selectedEmployeeId) {
      setError('Select the staff member who served the customer.');
      return;
    }
    startTransition(async () => {
      const serviceDiscountsToSend: Record<string, number> = {};
      selectedServiceIds.forEach((id) => { serviceDiscountsToSend[id] = svcDisc(id); });
      const result = await completeAndGenerateBill(
        appointment.id,
        paymentMethod,
        selectedServiceIds,
        membershipDiscountPct,
        selectedEmployeeId,
        selectedProducts.map((p) => ({ product_id: p.id, quantity: p.quantity, discount_pct: p.discount_pct ?? membershipDiscountPct })),
        serviceDiscountsToSend,
        walletApplied,
      );
      if (result.success) {
        setSuccess({ invoiceNumber: result.data.invoiceNumber });
      } else {
        setError(result.error);
      }
    });
  }

  // Success state
  if (success) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={handleClose} aria-hidden="true" />
        <div className="relative z-10 w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-xl mx-4 max-h-[90vh] overflow-y-auto">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="flex size-14 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/20">
              <CheckCircle2 className="size-7 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">Bill Generated!</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Invoice <span className="font-mono font-medium text-foreground">{success.invoiceNumber}</span> has been created.
              </p>
            </div>
            <div className="flex gap-2 w-full">
              <Link href="/dashboard/billing" className="flex-1">
                <Button variant="outline" className="w-full rounded-xl">
                  View Bills
                </Button>
              </Link>
              <Button className="flex-1 rounded-xl" onClick={handleClose}>
                Done
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl mx-4 max-h-[90vh] overflow-y-auto">
        <div className="space-y-5">
          {/* Header */}
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/20">
              <CircleCheck className="size-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">Complete & Generate Bill</h2>
              <p className="text-xs text-muted-foreground">
                {appointment.customer_name} · {appointment.service_name}
              </p>
            </div>
          </div>

          {/* Appointment summary */}
          <div className="rounded-xl bg-muted/50 p-4 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Customer</span>
              <span className="font-medium text-foreground">{appointment.customer_name}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Date & Time</span>
              <span className="text-foreground">
                {formatDateIN(appointment.appointment_date)}, {formatTimeIST(`1970-01-01T${appointment.start_time}`)}
              </span>
            </div>
          </div>

          {/* Served by (staff) — required, owner first by default */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Served by</label>
            <select
              value={selectedEmployeeId}
              onChange={(e) => setSelectedEmployeeId(e.target.value)}
              disabled={loadingLists}
              className="w-full h-11 rounded-xl border border-border bg-transparent px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              {employees.length === 0 && <option value="">Loading staff...</option>}
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}{e.role === 'owner' ? ' (Owner)' : e.role === 'manager' ? ' (Manager)' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Services — editable (cross-sell additions before billing) */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Services</label>
            <div className="space-y-1.5">
              {selectedServices.length === 0 && (
                <p className="text-xs text-muted-foreground">No services selected. Add at least one below.</p>
              )}
              {selectedServices.map((s) => {
                const gross = s.price;
                const net = gross - Math.round((gross * svcDisc(s.id)) / 100);
                return (
                  <div key={s.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 gap-2">
                    <span className="text-sm text-foreground min-w-0 truncate">{s.name}</span>
                    <div className="flex items-center gap-2 shrink-0">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={serviceDiscounts[s.id] ?? (membershipDiscountPct || '')}
                        placeholder="0"
                        onChange={(e) => setServiceDiscount(s.id, parseInt(e.target.value) || 0)}
                        className="h-8 w-14 rounded-lg border border-input bg-transparent px-2 text-center text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                        aria-label={`Discount % for ${s.name}`}
                      />
                      <span className="text-[11px] text-muted-foreground">%</span>
                      <span className="text-sm font-medium text-foreground w-16 text-right">₹{net.toLocaleString('en-IN')}</span>
                      <button
                        type="button"
                        onClick={() => removeService(s.id)}
                        className="text-muted-foreground hover:text-red-600 transition-colors"
                        aria-label={`Remove ${s.name}`}
                      >
                        <XCircle className="size-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            {/* Add service — search or browse */}
            <div className="flex items-center gap-2">
              <SearchableSelect
                className="flex-1"
                value={addServiceId}
                onChange={setAddServiceId}
                disabled={loadingLists}
                placeholder="Search or browse services…"
                emptyText="No service found"
                ariaLabel="Search or select a service"
                options={catalog
                  .filter((s) => !selectedServiceIds.includes(s.id))
                  .map((s) => ({ value: s.id, label: s.name, hint: `₹${s.price.toLocaleString('en-IN')}`, category: s.category }))}
              />
              <Button type="button" variant="outline" className="rounded-xl" onClick={addService} disabled={!addServiceId}>
                Add
              </Button>
            </div>

            {/* Products (retail) */}
            <div className="space-y-2 pt-1">
              <p className="text-sm font-medium text-foreground">Products</p>
              {selectedProducts.map((p) => {
                const net = p.price * p.quantity - Math.round((p.price * p.quantity * (p.discount_pct ?? membershipDiscountPct)) / 100);
                return (
                  <div key={p.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 gap-2">
                    <span className="text-sm text-foreground min-w-0 truncate">{p.name}</span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <input
                        type="number"
                        min={1}
                        max={p.maxStock}
                        value={p.quantity}
                        onChange={(e) => setProductQty(p.id, parseInt(e.target.value) || 1)}
                        className="h-8 w-12 rounded-lg border border-input bg-transparent px-2 text-center text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                        aria-label={`Quantity for ${p.name}`}
                      />
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={p.discount_pct || ''}
                        placeholder="0"
                        onChange={(e) => setProductDiscount(p.id, parseInt(e.target.value) || 0)}
                        className="h-8 w-12 rounded-lg border border-input bg-transparent px-2 text-center text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                        aria-label={`Discount % for ${p.name}`}
                      />
                      <span className="text-[11px] text-muted-foreground">%</span>
                      <span className="text-sm font-medium text-foreground w-16 text-right">₹{net.toLocaleString('en-IN')}</span>
                      <button
                        type="button"
                        onClick={() => removeProduct(p.id)}
                        className="text-muted-foreground hover:text-red-600 transition-colors"
                        aria-label={`Remove ${p.name}`}
                      >
                        <XCircle className="size-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
              <div className="flex items-center gap-2">
                <SearchableSelect
                  className="flex-1"
                  value={addProductId}
                  onChange={setAddProductId}
                  disabled={loadingLists}
                  placeholder="Search or browse products…"
                  emptyText="No product found"
                  ariaLabel="Search or select a product"
                  options={productCatalog
                    .filter((p) => !selectedProducts.some((sp) => sp.id === p.id))
                    .map((p) => ({
                      value: p.id,
                      label: p.name,
                      hint: `₹${p.price.toLocaleString('en-IN')}${p.stock <= 0 ? ' · Out of stock' : ` · ${p.stock} left`}`,
                      category: p.category,
                      disabled: p.stock <= 0,
                    }))}
                />
                <Button type="button" variant="outline" className="rounded-xl" onClick={addProduct} disabled={!addProductId}>
                  Add
                </Button>
              </div>
            </div>

            <div className="flex items-center justify-between text-sm pt-1">
              <span className="font-medium text-foreground">Subtotal</span>
              <span className="text-base font-bold text-foreground">₹{subtotal.toLocaleString('en-IN')}</span>
            </div>
          </div>

          {/* Discount (per item) */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">Discount</p>

            {/* Membership discount indicator */}
            {loadingMembership ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <div className="h-3 w-3 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
                Checking membership...
              </div>
            ) : membershipInfo ? (
              <div className="rounded-lg bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/30 px-4 py-2.5">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400">
                    👑 {membershipInfo.membershipName}
                  </span>
                  <span className="text-sm font-semibold text-amber-700 dark:text-amber-300">
                    {membershipInfo.discountPct}% applied per item
                  </span>
                </div>
              </div>
            ) : null}

            <p className="text-xs text-muted-foreground">
              Set a discount per item using the &quot;%&quot; box on each service / product above.
            </p>

            {/* Total discount summary */}
            {discountAmount > 0 && subtotal > 0 && (
              <div className="rounded-lg bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800/30 px-4 py-2.5 space-y-1">
                <div className="flex items-center justify-between text-xs text-emerald-600 dark:text-emerald-400">
                  <span>Total discount</span>
                  <span className="font-medium">− ₹{discountAmount.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-emerald-700 dark:text-emerald-400">Payable</span>
                  <span className="text-sm font-bold text-emerald-700 dark:text-emerald-400">
                    ₹{discountedTotal.toLocaleString('en-IN')}
                  </span>
                </div>
              </div>
            )}
          </div>

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 dark:border-red-900/50 dark:bg-red-900/20">
              <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
            </div>
          )}

          {/* Catalog failed to load — the pickers above are empty for a reason. */}
          {listsError && (
            <div
              role="alert"
              className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl border border-amber-300 bg-amber-50 p-3 dark:border-amber-800/40 dark:bg-amber-900/15"
            >
              <p className="text-sm text-amber-900 dark:text-amber-200">{listsError}</p>
              <button
                type="button"
                onClick={() => setListsReloadKey((k) => k + 1)}
                className="text-xs font-semibold text-amber-900 underline hover:no-underline dark:text-amber-200"
              >
                Retry
              </button>
            </div>
          )}

          {/* Wallet lookup FAILED — must not be mistaken for "no store credit". */}
          {canUseWallet && walletLoadFailed && (
            <div
              role="alert"
              className="space-y-1.5 rounded-xl border border-amber-300 bg-amber-50 p-3 dark:border-amber-800/40 dark:bg-amber-900/15"
            >
              <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
                Could not check the wallet balance
              </p>
              <p className="text-xs text-amber-800 dark:text-amber-300">
                This customer may still have store credit. Retry before taking payment.
              </p>
              <button
                type="button"
                onClick={() => setWalletReloadKey((k) => k + 1)}
                className="text-xs font-semibold text-amber-900 underline hover:no-underline dark:text-amber-200"
              >
                Retry
              </button>
            </div>
          )}

          {/* Wallet balance option (owner/manager only) */}
          {canUseWallet && !walletLoadFailed && walletBalance > 0 && (
            <div className="space-y-2">
              <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-emerald-200/70 dark:border-emerald-800/40 bg-emerald-50/60 dark:bg-emerald-900/10 px-4 py-3">
                <span className="flex items-center gap-2.5">
                  <span className="flex size-8 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/40">
                    <Wallet className="size-4 text-emerald-600 dark:text-emerald-400" />
                  </span>
                  <span>
                    <span className="block text-sm font-medium text-foreground">Use wallet balance</span>
                    <span className="block text-xs text-muted-foreground">Available ₹{walletBalance.toLocaleString('en-IN')}</span>
                  </span>
                </span>
                <input
                  type="checkbox"
                  checked={useWallet}
                  onChange={(e) => {
                    setUseWallet(e.target.checked);
                    // Default to full coverage; user can lower it to split the bill.
                    setWalletInput(e.target.checked ? String(maxWallet) : '');
                  }}
                  className="size-4 accent-emerald-600"
                  aria-label="Use wallet balance"
                />
              </label>

              {useWallet && (
                <div className="rounded-xl border border-border bg-muted/30 px-4 py-3 space-y-2.5">
                  <div className="flex items-center justify-between gap-3">
                    <label htmlFor="wallet-amount" className="text-sm text-foreground">Amount from wallet</label>
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm text-muted-foreground">₹</span>
                      <input
                        id="wallet-amount"
                        type="number"
                        min={0}
                        max={maxWallet}
                        step="1"
                        inputMode="numeric"
                        value={walletInput}
                        onChange={(e) => setWalletInput(e.target.value)}
                        className="h-9 w-28 rounded-lg border border-input bg-transparent px-2 text-right text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <button
                      type="button"
                      onClick={() => setWalletInput(String(maxWallet))}
                      className="font-medium text-emerald-600 hover:text-emerald-700 dark:text-emerald-400"
                    >
                      Use max (₹{maxWallet.toLocaleString('en-IN')})
                    </button>
                    <span className="text-muted-foreground">Up to ₹{maxWallet.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="border-t border-border/60" />
                  <div className="flex items-center justify-between text-xs text-emerald-700 dark:text-emerald-400">
                    <span>Paid from wallet</span>
                    <span className="font-medium">− ₹{walletApplied.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-foreground">{fullyWallet ? 'Fully covered by wallet' : 'Remaining to pay'}</span>
                    <span className="text-sm font-bold text-foreground">₹{remainingPayable.toLocaleString('en-IN')}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Payment Method — for the amount NOT covered by the wallet */}
          {!fullyWallet && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">
                {walletApplied > 0 ? `Payment Method (for remaining ₹${remainingPayable.toLocaleString('en-IN')})` : 'Payment Method'}
              </p>
              <div className="flex gap-3" role="radiogroup" aria-label="Payment method">
                {(['cash', 'upi', 'card'] as const).map((method) => (
                  <label
                    key={method}
                    className={`inline-flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm transition-all ${
                      paymentMethod === method
                        ? 'border-primary bg-primary/5 text-primary font-medium shadow-sm'
                        : 'border-border text-muted-foreground hover:border-foreground/30'
                    }`}
                  >
                    <input
                      type="radio"
                      name="payment-method"
                      value={method}
                      checked={paymentMethod === method}
                      onChange={() => setPaymentMethod(method)}
                      className="sr-only"
                    />
                    <span className="capitalize">{method === 'upi' ? 'UPI' : method.charAt(0).toUpperCase() + method.slice(1)}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Info */}
          <p className="text-xs text-muted-foreground">
            This will mark the appointment as completed and generate an invoice. The bill will appear in the Billing section.
          </p>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-2">
            <Button variant="outline" className="rounded-xl" onClick={onClose} disabled={isPending}>
              Cancel
            </Button>
            <Button className="rounded-xl gap-1.5" onClick={handleConfirm} disabled={isPending}>
              {isPending ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                  Generating...
                </span>
              ) : (
                <>
                  <CheckCircle2 className="size-4" />
                  Complete & Bill
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}


// =============================================================================
// Edit Services Modal
// =============================================================================

function EditServicesModal({
  appointment,
  onClose,
}: {
  appointment: AppointmentRow;
  onClose: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [services, setServices] = useState<{ id: string; name: string; price: number }[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    async function load() {
      const svcData = await getActiveServices();
      setServices(svcData.map((s) => ({ id: s.id, name: s.name, price: s.price })));
    }
    load();
  }, []);

  const selectedServices = services.filter((s) => selectedIds.includes(s.id));
  const totalAmount = selectedServices.reduce((sum, s) => sum + s.price, 0);

  function handleSave() {
    if (selectedIds.length === 0) {
      setError('Select at least one service.');
      return;
    }
    setError('');
    startTransition(async () => {
      const result = await updateAppointmentServices(appointment.id, selectedIds);
      if (result.success) {
        setSuccess(true);
        setTimeout(onClose, 1000);
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl mx-4 max-h-[90vh] overflow-y-auto">
        <div className="space-y-5">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-full bg-violet-100 dark:bg-violet-900/20">
              <Pencil className="size-5 text-violet-600 dark:text-violet-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">Edit Services</h2>
              <p className="text-xs text-muted-foreground">{appointment.customer_name}</p>
            </div>
          </div>

          {success && (
            <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-900/50 dark:bg-emerald-900/20">
              <CheckCircle2 className="size-4 text-emerald-600" />
              <p className="text-sm text-emerald-800 dark:text-emerald-200">Services updated!</p>
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 dark:border-red-900/50 dark:bg-red-900/20">
              <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
            </div>
          )}

          {/* Selected services chips */}
          {selectedServices.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {selectedServices.map((svc) => (
                <span key={svc.id} className="inline-flex items-center gap-1.5 rounded-full bg-pink-50 dark:bg-pink-900/20 border border-pink-200 dark:border-pink-800 px-3 py-1.5 text-xs font-medium text-pink-700 dark:text-pink-300">
                  {svc.name} (₹{svc.price})
                  <button type="button" onClick={() => setSelectedIds((prev) => prev.filter((id) => id !== svc.id))} className="text-pink-500 hover:text-pink-700 text-base leading-none">×</button>
                </span>
              ))}
            </div>
          )}

          {/* Service selector */}
          {services.length > 0 && (
            <select
              value=""
              onChange={(e) => {
                if (e.target.value && !selectedIds.includes(e.target.value)) {
                  setSelectedIds((prev) => [...prev, e.target.value]);
                }
              }}
              className="w-full"
            >
              <option value="">{selectedIds.length === 0 ? 'Select services...' : '+ Add another service'}</option>
              {services.filter((s) => !selectedIds.includes(s.id)).map((svc) => (
                <option key={svc.id} value={svc.id}>{svc.name} — ₹{svc.price}</option>
              ))}
            </select>
          )}

          {totalAmount > 0 && (
            <div className="rounded-lg bg-muted/50 px-4 py-3 flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Total</span>
              <span className="text-lg font-bold text-foreground">₹{totalAmount.toLocaleString('en-IN')}</span>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button variant="outline" className="rounded-xl" onClick={onClose} disabled={isPending}>
              Cancel
            </Button>
            <Button className="rounded-xl" onClick={handleSave} disabled={isPending || selectedIds.length === 0 || success}>
              {isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
