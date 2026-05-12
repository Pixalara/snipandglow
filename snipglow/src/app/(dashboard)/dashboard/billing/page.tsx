import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { formatINR, formatDateIN } from '@/lib/utils';
import { DataTable, type Column } from '@/components/data-table';
import { RoleGuard } from '@/components/role-guard';
import type { DeliveryStatus, PaymentMethod, UserRole } from '@/types';

// =============================================================================
// Invoice List Page — Server Component
// =============================================================================

/** Row shape returned from the invoices query with joined customer name */
interface InvoiceRow {
  id: string;
  invoice_number: string;
  customer_name: string;
  created_at: string;
  total: number;
  payment_method: PaymentMethod;
  delivery_status: DeliveryStatus;
}

export default async function BillingPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect('/login');
  }

  const role = (user.user_metadata?.role as UserRole) ?? 'staff';

  try {
    // Fetch invoices (RLS enforces tenant/branch scoping)
    const { data: invoices, error } = await supabase
      .from('invoices')
      .select('id, invoice_number, created_at, total, payment_method, delivery_status, customer_id')
      .order('created_at', { ascending: false });

    if (error) {
      return (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-semibold text-foreground">Billing</h1>
          </div>
          <div className="flex items-center justify-center rounded-lg border border-border bg-card p-12">
            <p className="text-sm text-destructive">Failed to load invoices. Please try again.</p>
          </div>
        </div>
      );
    }

    // Fetch customer names separately to avoid join issues
    const customerIds = [...new Set((invoices ?? []).map((inv) => inv.customer_id).filter(Boolean))];
    const customerNameMap: Record<string, string> = {};

    if (customerIds.length > 0) {
      const { data: customers } = await supabase
        .from('customers')
        .select('id, name')
        .in('id', customerIds);

      if (customers) {
        for (const c of customers) {
          customerNameMap[c.id] = c.name;
        }
      }
    }

    // Map rows
    const rows: InvoiceRow[] = (invoices ?? []).map((inv) => ({
      id: inv.id,
      invoice_number: inv.invoice_number,
      customer_name: customerNameMap[inv.customer_id ?? ''] ?? '—',
      created_at: inv.created_at ?? '',
      total: inv.total,
      payment_method: inv.payment_method as PaymentMethod,
      delivery_status: inv.delivery_status as DeliveryStatus,
    }));

    return (
      <div className="space-y-4">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-xl font-semibold text-foreground">Billing</h1>
          <RoleGuard role={role} action="create" resource="billing">
            <Link
              href="/dashboard/billing/new"
              className="inline-flex h-8 shrink-0 items-center justify-center rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/80"
            >
              New Bill
            </Link>
          </RoleGuard>
        </div>

        {/* Invoice Table */}
        <InvoiceTable invoices={rows} />
      </div>
    );
  } catch {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold text-foreground">Billing</h1>
        </div>
        <div className="flex items-center justify-center rounded-lg border border-border bg-card p-12">
          <p className="text-sm text-destructive">Something went wrong loading billing. Please try again.</p>
        </div>
      </div>
    );
  }
}

// =============================================================================
// Invoice Table
// =============================================================================

function InvoiceTable({ invoices }: { invoices: InvoiceRow[] }) {
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

// =============================================================================
// Delivery Status Badge
// =============================================================================

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
