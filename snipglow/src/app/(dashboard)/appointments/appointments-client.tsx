'use client';

import { useState } from 'react';
import Link from 'next/link';
import { formatDateIN, formatTimeIST } from '@/lib/utils';
import { DataTable, type Column } from '@/components/data-table';
import { RoleGuard } from '@/components/role-guard';
import { Button } from '@/components/ui/button';
import { CalendarView } from './calendar-view';
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

function StatusBadge({ status }: { status: AppointmentStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${statusColors[status]}`}
    >
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
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-semibold text-foreground">Appointments</h1>
        <div className="flex items-center gap-2">
          {/* Status filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as AppointmentStatus | 'all')}
            className="h-8 rounded-lg border border-border bg-background px-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            aria-label="Filter by status"
          >
            <option value="all">All Status</option>
            <option value="booked">Booked</option>
            <option value="confirmed">Confirmed</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>

          {/* View toggle */}
          <div className="flex items-center rounded-lg border border-border bg-muted/50 p-0.5">
            <button
              onClick={() => setView('list')}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                view === 'list'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              aria-label="List view"
            >
              List
            </button>
            <button
              onClick={() => setView('calendar')}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                view === 'calendar'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              aria-label="Calendar view"
            >
              Calendar
            </button>
          </div>

          {/* New Booking button — owner/manager only */}
          <RoleGuard role={role} action="create" resource="appointments">
            <Link href="/appointments/new">
              <Button>New Booking</Button>
            </Link>
          </RoleGuard>
        </div>
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
      render: (row) => <span className="font-medium text-foreground">{row.customer_name}</span>,
    },
    {
      key: 'service',
      header: 'Service',
      render: (row) => <span className="text-foreground">{row.service_name}</span>,
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
        <span className="text-muted-foreground">{formatDateIN(row.appointment_date)}</span>
      ),
    },
    {
      key: 'time',
      header: 'Time',
      render: (row) => (
        <span className="text-muted-foreground">
          {formatTimeIST(`1970-01-01T${row.start_time}`)}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <StatusBadge status={row.status} />,
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={appointments}
      getRowKey={(row) => row.id}
      emptyMessage="No appointments found"
    />
  );
}
