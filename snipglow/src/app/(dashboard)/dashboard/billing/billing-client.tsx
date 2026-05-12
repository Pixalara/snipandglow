'use client';

import { formatINR, formatDateIN } from '@/lib/utils';
import { DataTable, type Column } from '@/components/data-table';
import type { DeliveryStatus, PaymentMethod } from '@/types';

/** Invoice row shape (serialized-safe) */
export interface InvoiceRow {
  id: string;
  invoice_number: string;
  customer_name: string;
  created_at: string;
  total: number;
  payment_method: PaymentMethod;
  delivery_status: DeliveryStatus;
}

interface InvoicesTableProps {
  invoices: InvoiceRow[];
}

export function InvoicesTable({ invoices }: InvoicesTableProps) {
  const columns: Column<InvoiceRow>[] = [
    {
      key: 'invoice_number',
      header: 'Invoice #',
      render: (row) => (
        <span className="font-medium text-foreground">{row.invoice_number}</span>
      ),
    },
    {
      key: 'customer_name',
      header: 'Customer',
      render: (row) => <span className="text-muted-foreground">{row.customer_name}</span>,
    },
    {
      key: 'created_at',
      header: 'Date',
      render: (row) => (
        <span className="text-muted-foreground">{formatDateIN(row.created_at)}</span>
      ),
    },
    {
      key: 'total',
      header: 'Total',
      render: (row) => <span className="font-medium">{formatINR(row.total)}</span>,
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
      emptyMessage="No invoices yet"
    />
  );
}

function DeliveryStatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; className: string }> = {
    pending: {
      label: 'Pending',
      className: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    },
    sent: {
      label: 'Sent',
      className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    },
    delivered: {
      label: 'Delivered',
      className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    },
    read: {
      label: 'Read',
      className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    },
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
