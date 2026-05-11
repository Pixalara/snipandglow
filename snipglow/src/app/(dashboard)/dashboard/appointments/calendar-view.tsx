'use client';

import { useMemo } from 'react';
import { formatTimeIST } from '@/lib/utils';
import type { AppointmentRow } from './page';
import type { AppointmentStatus } from '@/types';

// =============================================================================
// CalendarView — Simple week view showing appointment blocks by day
// Shows 7 days (current week), color-coded by status.
// Responsive: stacks days vertically on mobile.
// =============================================================================

interface CalendarViewProps {
  appointments: AppointmentRow[];
}

/** Status-based border/background colors for appointment blocks */
const blockColors: Record<AppointmentStatus, string> = {
  booked: 'border-blue-300 bg-blue-50 dark:border-blue-700 dark:bg-blue-900/20',
  confirmed: 'border-emerald-300 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-900/20',
  completed: 'border-gray-300 bg-gray-50 dark:border-gray-700 dark:bg-gray-900/20',
  cancelled: 'border-red-300 bg-red-50 dark:border-red-700 dark:bg-red-900/20',
};

/** Status dot colors */
const dotColors: Record<AppointmentStatus, string> = {
  booked: 'bg-blue-500',
  confirmed: 'bg-emerald-500',
  completed: 'bg-gray-500',
  cancelled: 'bg-red-500',
};

/** Get the start of the current week (Monday) */
function getWeekStart(): Date {
  const now = new Date();
  const day = now.getDay();
  // Adjust so Monday = 0
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

/** Generate 7 days starting from a given date */
function getWeekDays(start: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

/** Format date as YYYY-MM-DD for comparison */
function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Short day name */
const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function CalendarView({ appointments }: CalendarViewProps) {
  const weekStart = useMemo(() => getWeekStart(), []);
  const weekDays = useMemo(() => getWeekDays(weekStart), [weekStart]);

  // Group appointments by date
  const appointmentsByDate = useMemo(() => {
    const map: Record<string, AppointmentRow[]> = {};
    for (const apt of appointments) {
      const key = apt.appointment_date;
      if (!map[key]) map[key] = [];
      map[key].push(apt);
    }
    // Sort each day's appointments by start_time
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
          <span className={`size-2 rounded-full ${dotColors.confirmed}`} />
          Confirmed
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

      {/* Week grid — horizontal on desktop, vertical on mobile */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-7">
        {weekDays.map((day, idx) => {
          const dateKey = toDateKey(day);
          const isToday = dateKey === today;
          const dayAppointments = appointmentsByDate[dateKey] ?? [];

          return (
            <div
              key={dateKey}
              className={`rounded-lg border p-2 ${
                isToday
                  ? 'border-primary/50 bg-primary/5'
                  : 'border-border bg-card'
              }`}
            >
              {/* Day header */}
              <div className="mb-2 text-center">
                <div className="text-xs font-medium text-muted-foreground">
                  {dayNames[idx]}
                </div>
                <div
                  className={`text-sm font-semibold ${
                    isToday ? 'text-primary' : 'text-foreground'
                  }`}
                >
                  {day.getDate()}
                </div>
              </div>

              {/* Appointment blocks */}
              <div className="space-y-1.5">
                {dayAppointments.length === 0 && (
                  <p className="text-center text-[10px] text-muted-foreground/60">
                    No appointments
                  </p>
                )}
                {dayAppointments.map((apt) => (
                  <AppointmentBlock key={apt.id} appointment={apt} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// =============================================================================
// AppointmentBlock — Single appointment card within a day column
// =============================================================================

function AppointmentBlock({ appointment }: { appointment: AppointmentRow }) {
  return (
    <div
      className={`rounded-md border p-1.5 text-[11px] leading-tight ${blockColors[appointment.status]}`}
    >
      <div className="flex items-center gap-1">
        <span className={`size-1.5 shrink-0 rounded-full ${dotColors[appointment.status]}`} />
        <span className="truncate font-medium text-foreground">
          {appointment.customer_name}
        </span>
      </div>
      <div className="mt-0.5 truncate text-muted-foreground">
        {appointment.service_name}
      </div>
      <div className="mt-0.5 text-muted-foreground">
        {formatTimeIST(`1970-01-01T${appointment.start_time}`)}
      </div>
    </div>
  );
}
