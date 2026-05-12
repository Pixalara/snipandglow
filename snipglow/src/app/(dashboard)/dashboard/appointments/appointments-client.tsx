'use client';

import { useState } from 'react';
import Link from 'next/link';
import { formatDateIN, formatTimeIST } from '@/lib/utils';
import { DataTable, type Column } from '@/components/data-table';
import { RoleGuard } from '@/components/role-guard';
import { Button } from '@/components/ui/button';
import { CalendarView } from './calendar-view';
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
} from 'lucide-react';
import type { AppointmentRow } from './page';
import type { AppointmentStatus, UserRole } from '@/types';

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

export function AppointmentsClient({ appointments, role }: AppointmentsClientProps) {
  const [view, setView] = useState<ViewMode>('list');
  const [statusFilter, setStatusFilter] = useState<AppointmentStatus | 'all'>('all');

  // Filter appointments by status
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
            {/* Status filter */}
            <div className="relative">
              <Filter className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as AppointmentStatus | 'all')}
                className="h-9 rounded-xl border border-border bg-background pl-8 pr-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring appearance-none cursor-pointer"
                aria-label="Filter by status"
              >
                <option value="all">All Status</option>
                <option value="booked">Booked</option>
                <option value="confirmed">Confirmed</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>

            {/* View toggle */}
            <div className="flex items-center rounded-xl border border-border bg-muted/50 p-1">
              <button
                onClick={() => setView('list')}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                  view === 'list'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                aria-label="List view"
              >
                <List className="size-3.5" />
                List
              </button>
              <button
                onClick={() => setView('calendar')}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                  view === 'calendar'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                aria-label="Calendar view"
              >
                <Calendar className="size-3.5" />
                Calendar
              </button>
            </div>

            {/* New Booking button — owner/manager only */}
            <RoleGuard role={role} action="create" resource="appointments">
              <Link href="/dashboard/appointments/new">
                <Button className="rounded-xl gap-1.5">
                  <Plus className="size-4" />
                  New Booking
                </Button>
              </Link>
            </RoleGuard>
          </div>
        </div>
        {/* Decorative circles */}
        <div className="absolute -right-6 -top-6 h-32 w-32 rounded-full bg-blue-500/5" />
        <div className="absolute -right-2 top-10 h-20 w-20 rounded-full bg-blue-400/5" />
      </div>

      {/* Content */}
      {view === 'list' ? (
        <AppointmentListView appointments={filtered} />
      ) : (
        <CalendarView appointments={filtered} />
      )}
    </div>
  );
}

// =============================================================================
// List View — DataTable with appointment columns
// =============================================================================

function AppointmentListView({ appointments }: { appointments: AppointmentRow[] }) {
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
    <div className="rounded-xl border border-border overflow-hidden">
      <DataTable
        columns={columns}
        data={appointments}
        getRowKey={(row) => row.id}
        emptyMessage="No appointments found"
      />
    </div>
  );
}
