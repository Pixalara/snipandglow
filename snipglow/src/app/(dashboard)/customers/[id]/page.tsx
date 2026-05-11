import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { formatINR, formatDateIN, formatTimeIST } from '@/lib/utils';
import { DataTable, type Column } from '@/components/data-table';
import { ProfileTabs } from './profile-tabs';

// =============================================================================
// Customer Profile Page — Server Component
// =============================================================================

interface CustomerProfilePageProps {
  params: Promise<{ id: string }>;
}

/** Appointment row with joined service and employee names */
interface AppointmentRow {
  id: string;
  appointment_date: string;
  start_time: string;
  status: string;
  services: { name: string } | null;
  employees: { name: string } | null;
}

/** Invoice row for billing history */
interface InvoiceRow {
  id: string;
  invoice_number: string;
  total: number;
  payment_method: string;
  delivery_status: string;
  created_at: string;
}

/** Active membership with plan details */
interface ActiveMembership {
  id: string;
  end_date: string;
  memberships: { name: string; discount_pct: number } | null;
}

export default async function CustomerProfilePage({ params }: CustomerProfilePageProps) {
  const { id } = await params;

  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect('/login');
  }

  // Fetch customer by ID (RLS enforces tenant/branch scoping)
  const { data: customer, error } = await supabase
    .from('customers')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !customer) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-border bg-card p-12">
        <p className="text-sm text-muted-foreground">Customer not found</p>
        <Link
          href="/customers"
          className="text-sm font-medium text-primary hover:text-primary/80 transition-colors"
        >
          ← Back to Customers
        </Link>
      </div>
    );
  }

  // Fetch completed appointments with service and employee names
  const { data: appointments } = await supabase
    .from('appointments')
    .select('*, services(name), employees(name)')
    .eq('customer_id', id)
    .eq('status', 'completed')
    .order('appointment_date', { ascending: false });

  // Fetch invoices
  const { data: invoices } = await supabase
    .from('invoices')
    .select('*')
    .eq('customer_id', id)
    .order('created_at', { ascending: false });

  // Fetch active membership
  const { data: activeMembership } = await supabase
    .from('customer_memberships')
    .select('*, memberships(name, discount_pct)')
    .eq('customer_id', id)
    .eq('status', 'active')
    .single();

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <Link
        href="/customers"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        ← Back to Customers
      </Link>

      {/* Profile Header */}
      <CustomerProfileHeader
        customer={{
          ...customer,
          total_visits: customer.total_visits ?? 0,
          total_spent: customer.total_spent ?? 0,
          created_at: customer.created_at ?? '',
        }}
        activeMembership={activeMembership as ActiveMembership | null}
      />

      {/* Tabs: Visit History & Billing History */}
      <ProfileTabs
        visitHistory={
          <VisitHistoryTable appointments={(appointments ?? []) as AppointmentRow[]} />
        }
        billingHistory={
          <BillingHistoryTable invoices={(invoices ?? []) as InvoiceRow[]} />
        }
      />
    </div>
  );
}

// =============================================================================
// Profile Header
// =============================================================================

function CustomerProfileHeader({
  customer,
  activeMembership,
}: {
  customer: {
    name: string;
    phone: string;
    email: string | null;
    gender: string | null;
    notes: string | null;
    total_visits: number;
    total_spent: number;
    created_at: string;
  };
  activeMembership: ActiveMembership | null;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-6 space-y-4">
      {/* Name and Membership Badge */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-foreground">{customer.name}</h1>
        {activeMembership && (
          <div className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
            <span>🏅 {activeMembership.memberships?.name ?? 'Membership'}</span>
            <span className="text-emerald-600 dark:text-emerald-500">
              · Expires {formatDateIN(activeMembership.end_date)}
            </span>
          </div>
        )}
      </div>

      {/* Details Grid */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <DetailItem label="Phone" value={customer.phone} />
        {customer.email && <DetailItem label="Email" value={customer.email} />}
        {customer.gender && (
          <DetailItem label="Gender" value={capitalize(customer.gender)} />
        )}
        <DetailItem label="Total Visits" value={String(customer.total_visits)} />
        <DetailItem label="Total Spent" value={formatINR(customer.total_spent)} />
        <DetailItem label="Member Since" value={formatDateIN(customer.created_at)} />
      </div>

      {/* Notes */}
      {customer.notes && (
        <div className="border-t border-border pt-3">
          <p className="text-xs font-medium text-muted-foreground mb-1">Notes</p>
          <p className="text-sm text-foreground">{customer.notes}</p>
        </div>
      )}
    </div>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="text-sm text-foreground">{value}</p>
    </div>
  );
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

// =============================================================================
// Visit History Table
// =============================================================================

function VisitHistoryTable({ appointments }: { appointments: AppointmentRow[] }) {
  const columns: Column<AppointmentRow>[] = [
    {
      key: 'service',
      header: 'Service',
      render: (row) => (
        <span className="font-medium text-foreground">
          {row.services?.name ?? '—'}
        </span>
      ),
    },
    {
      key: 'stylist',
      header: 'Stylist',
      render: (row) => (
        <span className="text-muted-foreground">
          {row.employees?.name ?? '—'}
        </span>
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

/**
 * Format a time field (HH:MM:SS or HH:MM) to 12-hour format.
 * The start_time from appointments is a TIME field, not a full timestamp.
 */
function formatTimeFromTimeField(time: string): string {
  // Create a date with the time to use formatTimeIST
  // Use a fixed date since we only care about the time portion
  const dateStr = `2026-01-01T${time}`;
  return formatTimeIST(dateStr);
}

// =============================================================================
// Billing History Table
// =============================================================================

function BillingHistoryTable({ invoices }: { invoices: InvoiceRow[] }) {
  const columns: Column<InvoiceRow>[] = [
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
