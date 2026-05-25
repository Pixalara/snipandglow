'use client';

import { useState, useTransition, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { formatDateIN, formatTimeIST } from '@/lib/utils';
import { DataTable, type Column } from '@/components/data-table';
import { RoleGuard } from '@/components/role-guard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CalendarView } from './calendar-view';
import { updateAppointmentStatus, rescheduleAppointment, getSlotsForReschedule, completeAndGenerateBill, updateAppointmentServices, getActiveServices, getCustomerMembershipDiscount } from './actions';
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
} from 'lucide-react';
import type { AppointmentRow } from './page';
import type { AppointmentStatus, UserRole, TimeSlot } from '@/types';

// =============================================================================
// AppointmentsClient — Client component with view toggle and status filter
// =============================================================================

interface AppointmentsClientProps {
  appointments: AppointmentRow[];
  role: UserRole;
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

export function AppointmentsClient({ appointments, role }: AppointmentsClientProps) {
  const [view, setView] = useState<ViewMode>('list');
  const [statusFilter, setStatusFilter] = useState<AppointmentStatus | 'all'>('all');

  const filtered = statusFilter === 'all'
    ? appointments
    : appointments.filter((apt) => apt.status === statusFilter);

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

      {view === 'list' ? (
        <AppointmentListView appointments={filtered} />
      ) : (
        <CalendarView appointments={filtered} />
      )}
    </div>
  );
}

// =============================================================================
// List View with Actions + Reschedule Modal
// =============================================================================

function AppointmentListView({ appointments }: { appointments: AppointmentRow[] }) {
  const [isPending, startTransition] = useTransition();
  const [actionId, setActionId] = useState<string | null>(null);
  const [rescheduleTarget, setRescheduleTarget] = useState<AppointmentRow | null>(null);
  const [completeTarget, setCompleteTarget] = useState<AppointmentRow | null>(null);
  const [editTarget, setEditTarget] = useState<AppointmentRow | null>(null);

  function handleStatusChange(id: string, newStatus: AppointmentStatus) {
    setActionId(id);
    startTransition(async () => {
      await updateAppointmentStatus(id, newStatus);
      setActionId(null);
    });
  }

  const columns: Column<AppointmentRow>[] = [
    {
      key: 'customer',
      header: 'Customer',
      render: (row) => (
        <div className="flex items-center gap-2">
          <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-salon-rose/20 to-salon-gold/20">
            <User className="size-3.5 text-salon-rose" />
          </div>
          <span className="font-medium text-foreground">{row.customer_name}</span>
        </div>
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
          {row.source === 'whatsapp_flow' ? '💬 WhatsApp' : '🖥️ Dashboard'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (row) => {
        const loading = isPending && actionId === row.id;
        const canReschedule = row.status === 'booked' || row.status === 'confirmed';
        return (
          <div className="grid grid-cols-2 gap-1.5 w-fit">
            {canReschedule && (
              <button
                onClick={() => setEditTarget(row)}
                className="inline-flex items-center justify-center gap-2 rounded-xl px-3 py-1.5 text-xs font-medium bg-violet-50 text-violet-700 border border-violet-200 hover:bg-violet-100 hover:border-violet-300 dark:bg-violet-900/20 dark:text-violet-400 dark:border-violet-800 dark:hover:bg-violet-900/40 transition-all active:scale-95"
                title="Edit Services"
              >
                <Pencil className="size-3.5" />
                <span>Edit</span>
              </button>
            )}
            {canReschedule && (
              <button
                onClick={() => setRescheduleTarget(row)}
                className="inline-flex items-center justify-center gap-2 rounded-xl px-3 py-1.5 text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 hover:border-amber-300 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800 dark:hover:bg-amber-900/40 transition-all active:scale-95"
                title="Reschedule"
              >
                <CalendarClock className="size-3.5" />
                <span>Reschedule</span>
              </button>
            )}
            {canReschedule && (
              <button
                onClick={() => setCompleteTarget(row)}
                disabled={loading}
                className="inline-flex items-center justify-center gap-2 rounded-xl px-3 py-1.5 text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 hover:border-blue-300 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800 dark:hover:bg-blue-900/40 transition-all active:scale-95 disabled:opacity-50"
                title="Complete & Bill"
              >
                <CircleCheck className="size-3.5" />
                <span>Complete</span>
              </button>
            )}
            {canReschedule && (
              <button
                onClick={() => handleStatusChange(row.id, 'cancelled')}
                disabled={loading}
                className="inline-flex items-center justify-center gap-2 rounded-xl px-3 py-1.5 text-xs font-medium bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 hover:border-red-300 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800 dark:hover:bg-red-900/40 transition-all active:scale-95 disabled:opacity-50"
                title="Cancel"
              >
                <XCircle className="size-3.5" />
                <span>Cancel</span>
              </button>
            )}
            {(row.status === 'completed' || row.status === 'cancelled') && (
              <span className="text-sm text-muted-foreground italic px-2">—</span>
            )}
          </div>
        );
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
  onClose,
}: {
  appointment: AppointmentRow;
  onClose: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'upi' | 'card'>('cash');
  const [additionalDiscountPct, setAdditionalDiscountPct] = useState(0);
  const [membershipInfo, setMembershipInfo] = useState<{ discountPct: number; membershipName: string } | null>(null);
  const [loadingMembership, setLoadingMembership] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState<{ invoiceNumber: string } | null>(null);

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

  // Total discount = membership + additional (capped at 100%)
  const membershipDiscountPct = membershipInfo?.discountPct ?? 0;
  const totalDiscountPct = Math.min(100, membershipDiscountPct + additionalDiscountPct);

  const discountedTotal = appointment.total_amount > 0
    ? Math.round(appointment.total_amount - (appointment.total_amount * totalDiscountPct / 100))
    : 0;

  function handleConfirm() {
    setError('');
    startTransition(async () => {
      const result = await completeAndGenerateBill(appointment.id, paymentMethod, undefined, totalDiscountPct);
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
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
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
              <Button className="flex-1 rounded-xl" onClick={onClose}>
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
              <span className="text-muted-foreground">Service</span>
              <span className="font-medium text-foreground">{appointment.service_name}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Stylist</span>
              <span className="text-foreground">{appointment.employee_name}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Date & Time</span>
              <span className="text-foreground">
                {formatDateIN(appointment.appointment_date)}, {formatTimeIST(`1970-01-01T${appointment.start_time}`)}
              </span>
            </div>
            {appointment.total_amount > 0 && (
              <div className="flex items-center justify-between text-sm pt-2 border-t border-border mt-2">
                <span className="font-medium text-foreground">Total Amount</span>
                <span className="text-lg font-bold text-foreground">₹{appointment.total_amount.toLocaleString('en-IN')}</span>
              </div>
            )}
          </div>

          {/* Discount */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">Discount</p>

            {/* Membership discount indicator */}
            {loadingMembership ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <div className="h-3 w-3 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
                Checking membership...
              </div>
            ) : membershipInfo ? (
              <div className="rounded-lg bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/30 px-4 py-2.5 mb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400">
                      👑 {membershipInfo.membershipName}
                    </span>
                  </div>
                  <span className="text-sm font-semibold text-amber-700 dark:text-amber-300">
                    {membershipInfo.discountPct}% off
                  </span>
                </div>
              </div>
            ) : null}

            {/* Additional discount */}
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground">
                {membershipInfo ? 'Additional discount (adds on top of membership)' : 'Apply discount'}
              </p>
              <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                {[0, 5, 10, 15, 20].map((pct) => (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => setAdditionalDiscountPct(pct)}
                    className={`rounded-xl border px-3 py-2.5 text-sm font-medium transition-all min-h-[44px] min-w-[48px] ${
                      additionalDiscountPct === pct
                        ? 'border-pink-500 bg-pink-50 text-pink-600 dark:bg-pink-900/20 dark:border-pink-700'
                        : 'border-border text-muted-foreground hover:border-pink-300'
                    }`}
                  >
                    {pct === 0 ? 'None' : `+${pct}%`}
                  </button>
                ))}
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={additionalDiscountPct || ''}
                  onChange={(e) => setAdditionalDiscountPct(Math.min(100, Math.max(0, Number(e.target.value) || 0)))}
                  placeholder="Custom"
                  className="w-20 rounded-xl border border-border px-3 py-2.5 text-sm text-center min-h-[44px]"
                />
              </div>
            </div>

            {/* Total discount summary */}
            {totalDiscountPct > 0 && appointment.total_amount > 0 && (
              <div className="rounded-lg bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800/30 px-4 py-2.5 space-y-1.5">
                {membershipInfo && additionalDiscountPct > 0 && (
                  <div className="flex items-center justify-between text-xs text-emerald-600 dark:text-emerald-400">
                    <span>Membership ({membershipInfo.discountPct}%) + Additional ({additionalDiscountPct}%)</span>
                    <span className="font-medium">= {totalDiscountPct}% total</span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-emerald-700 dark:text-emerald-400">
                    {totalDiscountPct}% total discount
                  </span>
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

          {/* Payment Method */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">Payment Method</p>
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
