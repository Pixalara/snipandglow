'use client';

import { formatINR, formatDateIN, formatTimeIST } from '@/lib/utils';
import { DataTable, type Column } from '@/components/data-table';

/** Serializable visit history row */
export interface VisitRow {
  id: string;
  appointment_date: string;
  start_time: string;
  service_name: string;
  employee_name: string;
}

/** Serializable billing history row */
export interface BillingHistoryRow {
  id: string;
  invoice_number: string;
  total: number;
  payment_method: string;
  delivery_status: string;
  created_at: string;
}

export function VisitHistoryTable({ appointments }: { appointments: VisitRow[] }) {
  const columns: Column<VisitRow>[] = [
    {
      key: 'service',
      header: 'Service',
      render: (row) => (
        <span className="font-medium text-foreground">{row.service_name}</span>
      ),
    },
    {
      key: 'stylist',
      header: 'Stylist',
      render: (row) => (
        <span className="text-muted-foreground">{row.employee_name}</span>
      ),
    },
    {
      key: 'date',
      header: 'Date',
      render: (row) => <span>{formatDateIN(row.appointment_date)}</span>,
    },
    {
      key: 'time',
      header: 'Time',
      render: (row) => (
        <span className="text-muted-foreground">
          {formatTimeFromTimeField(row.start_time)}
        </span>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={appointments}
      getRowKey={(row) => row.id}
      emptyMessage="No visit history yet"
    />
  );
}

function formatTimeFromTimeField(time: string): string {
  const dateStr = `2026-01-01T${time}`;
  return formatTimeIST(dateStr);
}

export function BillingHistoryTable({ invoices }: { invoices: BillingHistoryRow[] }) {
  const columns: Column<BillingHistoryRow>[] = [
    {
      key: 'invoice_number',
      header: 'Invoice #',
      render: (row) => (
        <span className="font-medium text-foreground">{row.invoice_number}</span>
      ),
    },
    {
      key: 'date',
      header: 'Date',
      render: (row) => <span>{formatDateIN(row.created_at)}</span>,
    },
    {
      key: 'total',
      header: 'Total',
      render: (row) => (
        <span className="font-medium text-foreground">{formatINR(row.total)}</span>
      ),
    },
    {
      key: 'payment_method',
      header: 'Payment',
      render: (row) => (
        <span className="text-muted-foreground uppercase text-xs">
          {row.payment_method}
        </span>
      ),
    },
    {
      key: 'delivery_status',
      header: 'Delivery',
      render: (row) => <DeliveryStatusBadge status={row.delivery_status} />,
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={invoices}
      getRowKey={(row) => row.id}
      emptyMessage="No billing history yet"
    />
  );
}

function DeliveryStatusBadge({ status }: { status: string }) {
  const completed = {
    label: 'Completed',
    className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  };
  const config: Record<string, { label: string; className: string }> = {
    // A generated bill is sent to the customer over WhatsApp at creation time,
    // so any non-failed delivery state is shown as "Completed".
    pending: completed,
    sent: completed,
    delivered: completed,
    read: completed,
    completed: completed,
    failed: {
      label: 'Failed',
      className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    },
  };

  const { label, className } = config[status] ?? {
    label: status,
    className: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400',
  };

  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${className}`}>
      {label}
    </span>
  );
}
