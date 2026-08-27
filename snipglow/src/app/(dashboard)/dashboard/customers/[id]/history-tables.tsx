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

/** Serializable wallet ledger row */
export interface WalletTxRow {
  id: string;
  type: string;
  amount: number;
  balance_after: number;
  description: string | null;
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
      emptyHint="Completed appointments for this customer will appear here."
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
      emptyHint="Invoices raised for this customer will appear here."
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

// =============================================================================
// Wallet History Table
// =============================================================================

const WALLET_TYPE_META: Record<string, { label: string; className: string; sign: string }> = {
  credit: { label: 'Top-up', className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400', sign: '+' },
  refund: { label: 'Refund', className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400', sign: '+' },
  promo: { label: 'Bonus', className: 'bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-900/30 dark:text-fuchsia-400', sign: '+' },
  debit: { label: 'Used', className: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400', sign: '−' },
  adjustment: { label: 'Adjustment', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', sign: '' },
};

export function WalletHistoryTable({ transactions }: { transactions: WalletTxRow[] }) {
  const columns: Column<WalletTxRow>[] = [
    {
      key: 'type',
      header: 'Type',
      render: (row) => {
        const meta = WALLET_TYPE_META[row.type] ?? { label: row.type, className: 'bg-gray-100 text-gray-700', sign: '' };
        return (
          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${meta.className}`}>
            {meta.label}
          </span>
        );
      },
    },
    {
      key: 'amount',
      header: 'Amount',
      render: (row) => {
        const meta = WALLET_TYPE_META[row.type];
        const isCredit = row.type === 'credit' || row.type === 'refund' || row.type === 'promo';
        return (
          <span className={`font-medium ${isCredit ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
            {meta?.sign ?? ''}{formatINR(row.amount)}
          </span>
        );
      },
    },
    {
      key: 'balance_after',
      header: 'Balance',
      render: (row) => <span className="font-medium text-foreground">{formatINR(row.balance_after)}</span>,
    },
    {
      key: 'description',
      header: 'Note',
      render: (row) => <span className="text-muted-foreground">{row.description ?? '—'}</span>,
    },
    {
      key: 'date',
      header: 'Date',
      render: (row) => <span className="text-muted-foreground">{formatDateIN(row.created_at)}</span>,
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={transactions}
      getRowKey={(row) => row.id}
      emptyMessage="No wallet activity yet"
      emptyHint="Top-ups and wallet payments for this customer will appear here."
    />
  );
}
