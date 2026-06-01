'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { formatTimeIST } from '@/lib/utils';
import { updateAppointmentStatus, completeAndGenerateBill } from './actions';
import { CalendarClock, CircleCheck, XCircle, X, User, Scissors, Clock, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { AppointmentRow } from './page';
import type { AppointmentStatus } from '@/types';

// =============================================================================
// CalendarView - Week view with clickable appointment blocks
// =============================================================================

interface CalendarViewProps {
  appointments: AppointmentRow[];
}

const blockColors: Record<AppointmentStatus, string> = {
  booked: 'border-blue-300 bg-blue-50 dark:border-blue-700 dark:bg-blue-900/20',
  confirmed: 'border-emerald-300 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-900/20',
  completed: 'border-gray-300 bg-gray-50 dark:border-gray-700 dark:bg-gray-900/20',
  cancelled: 'border-red-300 bg-red-50 dark:border-red-700 dark:bg-red-900/20',
};

const dotColors: Record<AppointmentStatus, string> = {
  booked: 'bg-blue-500',
  confirmed: 'bg-emerald-500',
  completed: 'bg-gray-500',
  cancelled: 'bg-red-500',
};

const statusLabels: Record<AppointmentStatus, string> = {
  booked: 'Booked',
  confirmed: 'Confirmed',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

const statusBadgeColors: Record<AppointmentStatus, string> = {
  booked: 'bg-blue-100 text-blue-700',
  confirmed: 'bg-emerald-100 text-emerald-700',
  completed: 'bg-gray-100 text-gray-700',
  cancelled: 'bg-red-100 text-red-700',
};

function getWeekStart(): Date {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function getWeekDays(start: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function CalendarView({ appointments }: CalendarViewProps) {
  const weekStart = useMemo(() => getWeekStart(), []);
  const weekDays = useMemo(() => getWeekDays(weekStart), [weekStart]);
  const [selectedAppointment, setSelectedAppointment] = useState<AppointmentRow | null>(null);

  const appointmentsByDate = useMemo(() => {
    const map: Record<string, AppointmentRow[]> = {};
    for (const apt of appointments) {
      const key = apt.appointment_date;
      if (!map[key]) map[key] = [];
      map[key].push(apt);
    }
    for (const key of Object.keys(map)) {
      map[key].sort((a, b) => a.start_time.localeCompare(b.start_time));
    }
    return map;
  }, [appointments]);

  const today = toDateKey(new Date());

  return (
    <div className="space-y-3">
      {/* Legend */}
      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className={`size-2 rounded-full ${dotColors.booked}`} />
          Booked
        </span>
        <span className="flex items-center gap-1">
          <span className={`size-2 rounded-full ${dotColors.completed}`} />
          Completed
        </span>
        <span className="flex items-center gap-1">
          <span className={`size-2 rounded-full ${dotColors.cancelled}`} />
          Cancelled
        </span>
      </div>

      {/* Week grid */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-7">
        {weekDays.map((day, idx) => {
          const dateKey = toDateKey(day);
          const isToday = dateKey === today;
          const dayAppointments = appointmentsByDate[dateKey] ?? [];

          return (
            <div
              key={dateKey}
              className={`rounded-lg border p-2 ${
                isToday ? 'border-primary/50 bg-primary/5' : 'border-border bg-card'
              }`}
            >
              <div className="mb-2 text-center">
                <div className="text-xs font-medium text-muted-foreground">{dayNames[idx]}</div>
                <div className={`text-sm font-semibold ${isToday ? 'text-primary' : 'text-foreground'}`}>
                  {day.getDate()}
                </div>
              </div>

              <div className="space-y-1.5">
                {dayAppointments.length === 0 && (
                  <p className="text-center text-[10px] text-muted-foreground/60">No appointments</p>
                )}
                {dayAppointments.map((apt) => (
                  <button
                    key={apt.id}
                    type="button"
                    onClick={() => setSelectedAppointment(apt)}
                    className={`w-full text-left rounded-md border p-1.5 text-[11px] leading-tight cursor-pointer hover:shadow-md hover:scale-[1.02] transition-all ${blockColors[apt.status]}`}
                  >
                    <div className="flex items-center gap-1">
                      <span className={`size-1.5 shrink-0 rounded-full ${dotColors[apt.status]}`} />
                      <span className="truncate font-medium text-foreground">{apt.customer_name}</span>
                    </div>
                    <div className="mt-0.5 truncate text-muted-foreground">{apt.service_name}</div>
                    <div className="mt-0.5 text-muted-foreground">
                      {formatTimeIST(`1970-01-01T${apt.start_time}`)}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Appointment Detail Popup */}
      {selectedAppointment && (
        <AppointmentDetailPopup
          appointment={selectedAppointment}
          onClose={() => setSelectedAppointment(null)}
        />
      )}
    </div>
  );
}

// =============================================================================
// Appointment Detail Popup
// =============================================================================

function AppointmentDetailPopup({ appointment, onClose }: { appointment: AppointmentRow; onClose: () => void }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState('');

  const canAct = appointment.status === 'booked' || appointment.status === 'confirmed';
  const dateLabel = new Date(appointment.appointment_date + 'T12:00:00+05:30').toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata', weekday: 'long', day: 'numeric', month: 'short', year: 'numeric'
  });
  const timeLabel = formatTimeIST(`1970-01-01T${appointment.start_time}`);
  const endTimeLabel = formatTimeIST(`1970-01-01T${appointment.end_time}`);

  function handleCancel() {
    setError('');
    startTransition(async () => {
      const result = await updateAppointmentStatus(appointment.id, 'cancelled');
      if (result.success) {
        onClose();
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  function handleComplete() {
    setError('');
    startTransition(async () => {
      const result = await completeAndGenerateBill(appointment.id, 'cash');
      if (result.success) {
        onClose();
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl border border-border bg-card shadow-2xl overflow-hidden max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4 bg-muted/30 shrink-0">
          <div className="flex items-center gap-3">
            <div className={`flex size-10 items-center justify-center rounded-full ${statusBadgeColors[appointment.status]}`}>
              <span className={`size-2.5 rounded-full ${dotColors[appointment.status]}`} />
            </div>
            <div>
              <h2 className="text-base font-semibold text-foreground">Appointment Details</h2>
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusBadgeColors[appointment.status]}`}>
                {statusLabels[appointment.status]}
              </span>
            </div>
          </div>
          <button onClick={onClose} className="flex size-9 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
            <X className="size-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {/* Customer */}
          <div className="flex items-center gap-3 rounded-xl bg-muted/50 px-4 py-3">
            <User className="size-4 text-muted-foreground shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">Customer</p>
              <p className="text-sm font-semibold text-foreground">{appointment.customer_name}</p>
            </div>
          </div>

          {/* Service */}
          <div className="flex items-center gap-3 rounded-xl bg-muted/50 px-4 py-3">
            <Scissors className="size-4 text-muted-foreground shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">Service</p>
              <p className="text-sm font-semibold text-foreground">{appointment.service_name}</p>
            </div>
          </div>

          {/* Date & Time */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-3 rounded-xl bg-muted/50 px-4 py-3">
              <Calendar className="size-4 text-muted-foreground shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Date</p>
                <p className="text-sm font-semibold text-foreground">{dateLabel}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-xl bg-muted/50 px-4 py-3">
              <Clock className="size-4 text-muted-foreground shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Time</p>
                <p className="text-sm font-semibold text-foreground">{timeLabel} - {endTimeLabel}</p>
              </div>
            </div>
          </div>

          {/* Stylist & Source */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-muted/50 px-4 py-3">
              <p className="text-xs text-muted-foreground">Stylist</p>
              <p className="text-sm font-semibold text-foreground">{appointment.employee_name}</p>
            </div>
            <div className="rounded-xl bg-muted/50 px-4 py-3">
              <p className="text-xs text-muted-foreground">Booked Via</p>
              <p className="text-sm font-semibold text-foreground">{appointment.source === 'whatsapp_flow' ? 'WhatsApp' : 'Dashboard'}</p>
            </div>
          </div>

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
          )}
        </div>

        {/* Actions */}
        {canAct && (
          <div className="border-t border-border px-5 py-4 bg-muted/20 shrink-0">
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                className="rounded-xl gap-1.5 text-emerald-700 border-emerald-200 hover:bg-emerald-50"
                onClick={handleComplete}
                disabled={isPending}
              >
                <CircleCheck className="size-4" />
                Complete
              </Button>
              <Button
                variant="outline"
                className="rounded-xl gap-1.5 text-red-700 border-red-200 hover:bg-red-50"
                onClick={handleCancel}
                disabled={isPending}
              >
                <XCircle className="size-4" />
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
