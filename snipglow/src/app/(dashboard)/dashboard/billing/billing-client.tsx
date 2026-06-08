'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { formatINR, formatDateIN } from '@/lib/utils';
import { DataTable, type Column } from '@/components/data-table';
import { Button } from '@/components/ui/button';
import { updateInvoicePayment } from './actions';
import { InvoiceDocumentModal } from './invoice-document';
import {
  Receipt,
  Plus,
  CreditCard,
  Banknote,
  Smartphone,
  Pencil,
  CheckCircle2,
  FileText,
} from 'lucide-react';
import type { PaymentMethod, PaymentStatus } from '@/types';

/** Invoice row shape (serialized-safe) */
export interface InvoiceRow {
  id: string;
  invoice_number: string;
  customer_name: string;
  customer_id: string;
  created_at: string;
  total: number;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
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
  const [editTarget, setEditTarget] = useState<InvoiceRow | null>(null);
  const [viewTarget, setViewTarget] = useState<InvoiceRow | null>(null);

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
        row.customer_id ? (
          <Link href={`/dashboard/customers/${row.customer_id}`} className="group flex items-center gap-2">
            <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-salon-rose/20 to-salon-gold/20 text-xs font-bold text-salon-rose">
              {row.customer_name.charAt(0).toUpperCase()}
            </div>
            <span className="text-foreground font-medium group-hover:text-salon-rose group-hover:underline transition-colors">{row.customer_name}</span>
          </Link>
        ) : (
          <div className="flex items-center gap-2">
            <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-salon-rose/20 to-salon-gold/20 text-xs font-bold text-salon-rose">
              {row.customer_name.charAt(0).toUpperCase()}
            </div>
            <span className="text-foreground font-medium">{row.customer_name}</span>
          </div>
        )
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
      key: 'payment_status',
      header: 'Status',
      render: (row) => <PaymentStatusBadge status={row.payment_status} />,
    },
    {
      key: 'actions',
      header: '',
      render: (row) => (
        <div className="flex items-center justify-end gap-1">
          <button
            onClick={() => setViewTarget(row)}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors"
            title="View & print invoice"
          >
            <FileText className="size-3.5" />
            Invoice
          </button>
          <button
            onClick={() => setEditTarget(row)}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            title="Edit invoice"
          >
            <Pencil className="size-3.5" />
            Edit
          </button>
        </div>
      ),
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
    <>
      <div className="rounded-xl border border-border overflow-hidden">
        <DataTable
          columns={columns}
          data={invoices}
          getRowKey={(row) => row.id}
          emptyMessage="No invoices yet"
        />
      </div>

      {editTarget && (
        <EditInvoiceModal invoice={editTarget} onClose={() => setEditTarget(null)} />
      )}

      {viewTarget && (
        <InvoiceDocumentModal invoiceId={viewTarget.id} onClose={() => setViewTarget(null)} />
      )}
    </>
  );
}

// =============================================================================
// Payment Status Badge
// =============================================================================

function PaymentStatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; className: string; dotColor: string }> = {
    paid: {
      label: 'Paid',
      className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
      dotColor: 'bg-emerald-500',
    },
    partial: {
      label: 'Partial',
      className: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
      dotColor: 'bg-yellow-500',
    },
    pending: {
      label: 'Pending',
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

// =============================================================================
// Edit Invoice Modal
// =============================================================================

function EditInvoiceModal({ invoice, onClose }: { invoice: InvoiceRow; onClose: () => void }) {
  const [isPending, startTransition] = useTransition();
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(invoice.payment_method);
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>(invoice.payment_status);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  function handleSave() {
    setError('');
    startTransition(async () => {
      const result = await updateInvoicePayment(invoice.id, {
        payment_method: paymentMethod,
        payment_status: paymentStatus,
      });
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
          {/* Header */}
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-full bg-violet-100 dark:bg-violet-900/20">
              <Pencil className="size-5 text-violet-600 dark:text-violet-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">Edit Invoice</h2>
              <p className="text-xs text-muted-foreground font-mono">{invoice.invoice_number}</p>
            </div>
          </div>

          {/* Summary */}
          <div className="rounded-xl bg-muted/50 p-4 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Customer</span>
              <span className="font-medium text-foreground">{invoice.customer_name}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Total</span>
              <span className="font-bold text-foreground">{formatINR(invoice.total)}</span>
            </div>
          </div>

          {success && (
            <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-900/50 dark:bg-emerald-900/20">
              <CheckCircle2 className="size-4 text-emerald-600" />
              <p className="text-sm text-emerald-800 dark:text-emerald-200">Invoice updated!</p>
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 dark:border-red-900/50 dark:bg-red-900/20">
              <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
            </div>
          )}

          {/* Payment Method */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">Payment Method</p>
            <div className="flex gap-2" role="radiogroup">
              {(['cash', 'upi', 'card'] as PaymentMethod[]).map((method) => (
                <label
                  key={method}
                  className={`inline-flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-sm transition-all ${
                    paymentMethod === method
                      ? 'border-primary bg-primary/5 text-primary font-medium shadow-sm'
                      : 'border-border text-muted-foreground hover:border-foreground/30'
                  }`}
                >
                  <input
                    type="radio"
                    name="edit-payment-method"
                    value={method}
                    checked={paymentMethod === method}
                    onChange={() => setPaymentMethod(method)}
                    className="sr-only"
                  />
                  {method === 'upi' ? 'UPI' : method.charAt(0).toUpperCase() + method.slice(1)}
                </label>
              ))}
            </div>
          </div>

          {/* Payment Status */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">Payment Status</p>
            <div className="flex gap-2" role="radiogroup">
              {(['paid', 'partial', 'pending'] as PaymentStatus[]).map((status) => (
                <label
                  key={status}
                  className={`inline-flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-sm transition-all capitalize ${
                    paymentStatus === status
                      ? 'border-primary bg-primary/5 text-primary font-medium shadow-sm'
                      : 'border-border text-muted-foreground hover:border-foreground/30'
                  }`}
                >
                  <input
                    type="radio"
                    name="edit-payment-status"
                    value={status}
                    checked={paymentStatus === status}
                    onChange={() => setPaymentStatus(status)}
                    className="sr-only"
                  />
                  {status}
                </label>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-2">
            <Button variant="outline" className="rounded-xl" onClick={onClose} disabled={isPending}>
              Cancel
            </Button>
            <Button className="rounded-xl" onClick={handleSave} disabled={isPending || success}>
              {isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
