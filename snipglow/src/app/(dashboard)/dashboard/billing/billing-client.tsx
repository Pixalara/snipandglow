'use client';

import Link from 'next/link';
import { formatINR, formatDateIN } from '@/lib/utils';
import { DataTable, type Column } from '@/components/data-table';
import { Button } from '@/components/ui/button';
import {
  Receipt,
  Plus,
  CreditCard,
  Banknote,
  Smartphone,
} from 'lucide-react';
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

/** Payment method icon mapping */
const paymentIcons: Record<string, typeof CreditCard> = {
  card: CreditCard,
  cash: Banknote,
  upi: Smartphone,
};

export function InvoicesTable({ invoices }: InvoicesTableProps) {
  const columns: Column<InvoiceRow>[] = [
    {
      key: 'invoice_number',
      header: 'Invoice #',
      render: (row) => (
        <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-xs font-mono font-medium text-foreground">
          {row.invoice_number}
        </span>
      ),
    },
    {
      key: 'customer_name',
      header: 'Customer',
      render: (row) => (
        <div className="flex items-center gap-2">
          <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-salon-rose/20 to-salon-gold/20 text-xs font-bold text-salon-rose">
            {row.customer_name.charAt(0).toUpperCase()}
          </div>
          <span className="text-foreground font-medium">{row.customer_name}</span>
        </div>
      ),
    },
    {
      key: 'created_at',
      header: 'Date',
      render: (row) => (
        <span className="text-muted-foreground text-sm">{formatDateIN(row.created_at)}</span>
      ),
    },
    {
      key: 'total',
      header: 'Total',
      render: (row) => <span className="font-bold text-foreground">{formatINR(row.total)}</span>,
    },
    {
      key: 'payment_method',
      header: 'Payment',
      render: (row) => {
        const Icon = paymentIcons[row.payment_method] ?? CreditCard;
        return (
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground uppercase">
            <Icon className="size-3.5" />
            {row.payment_method}
          </span>
        );
      },
    },
    {
      key: 'delivery_status',
      header: 'Delivery',
      render: (row) => <DeliveryStatusBadge status={row.delivery_status} />,
    },
  ];

  if (invoices.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-card p-12 text-center">
        <div className="flex size-14 items-center justify-center rounded-full bg-violet-50 dark:bg-violet-900/20 mb-4">
          <Receipt className="size-6 text-violet-500" />
        </div>
        <h3 className="text-base font-semibold text-foreground">No invoices yet</h3>
        <p className="text-sm text-muted-foreground mt-1 max-w-sm">
          Create your first invoice to start tracking billing and payments for your salon.
        </p>
        <Link href="/dashboard/billing/new">
          <Button className="mt-4 rounded-xl gap-1.5" variant="outline">
            <Plus className="size-4" />
            Create First Invoice
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <DataTable
        columns={columns}
        data={invoices}
        getRowKey={(row) => row.id}
        emptyMessage="No invoices yet"
      />
    </div>
  );
}

function DeliveryStatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; className: string; dotColor: string }> = {
    pending: {
      label: 'Pending',
      className: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
      dotColor: 'bg-yellow-500',
    },
    sent: {
      label: 'Sent',
      className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
      dotColor: 'bg-blue-500',
    },
    delivered: {
      label: 'Delivered',
      className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
      dotColor: 'bg-emerald-500',
    },
    read: {
      label: 'Read',
      className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
      dotColor: 'bg-emerald-500',
    },
    failed: {
      label: 'Failed',
      className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
      dotColor: 'bg-red-500',
    },
  };

  const { label, className, dotColor } = config[status] ?? {
    label: status,
    className: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400',
    dotColor: 'bg-gray-500',
  };

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${className}`}>
      <span className={`size-1.5 rounded-full ${dotColor}`} />
      {label}
    </span>
  );
}
