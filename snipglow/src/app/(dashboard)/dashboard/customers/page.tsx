import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { formatINR, formatDateIN } from '@/lib/utils';
import { DataTable, type Column } from '@/components/data-table';
import { RoleGuard } from '@/components/role-guard';
import { CustomerSearch } from './customer-search';
import type { Customer, UserRole } from '@/types';

// =============================================================================
// Customer List Page — Server Component
// =============================================================================

interface CustomersPageProps {
  searchParams: Promise<{ search?: string }>;
}

/** Customer row with optional active membership info */
interface CustomerRow extends Customer {
  has_active_membership: boolean;
}

export default async function CustomersPage({ searchParams }: CustomersPageProps) {
  const params = await searchParams;
  const search = params.search?.trim() ?? '';

  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect('/login');
  }

  const role = (user.user_metadata?.role as UserRole) ?? 'staff';

  // Fetch customers (RLS enforces tenant/branch scoping)
  let query = supabase
    .from('customers')
    .select('*')
    .order('name', { ascending: true });

  // Apply search filter (name or phone)
  if (search) {
    query = query.or(`name.ilike.%${search}%,phone.ilike.%${search}%`);
  }

  const { data: customers, error } = await query;

  if (error) {
    return (
      <div className="flex items-center justify-center rounded-lg border border-border bg-card p-12">
        <p className="text-sm text-destructive">Failed to load customers. Please try again.</p>
      </div>
    );
  }

  // Fetch active memberships to show badge
  const customerIds = (customers ?? []).map((c) => c.id);
  let activeMemberships: Record<string, boolean> = {};

  if (customerIds.length > 0) {
    const { data: memberships } = await supabase
      .from('customer_memberships')
      .select('customer_id')
      .in('customer_id', customerIds)
      .eq('status', 'active');

    if (memberships) {
      activeMemberships = memberships.reduce<Record<string, boolean>>((acc, m) => {
        acc[m.customer_id] = true;
        return acc;
      }, {});
    }
  }

  // Merge membership info into customer rows
  const rows: CustomerRow[] = (customers ?? []).map((c) => ({
    ...c,
    total_visits: c.total_visits ?? 0,
    total_spent: c.total_spent ?? 0,
    last_visit_at: c.last_visit_at ?? null,
    created_at: c.created_at ?? '',
    has_active_membership: !!activeMemberships[c.id],
  }));

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-semibold text-foreground">Customers</h1>
        <div className="flex items-center gap-3">
          <CustomerSearch defaultValue={search} />
          <RoleGuard role={role} action="create" resource="customers">
            <Link
              href="/dashboard/customers/new"
              className="inline-flex h-8 shrink-0 items-center justify-center rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/80"
            >
              New Customer
            </Link>
          </RoleGuard>
        </div>
      </div>

      {/* Customer Table */}
      <CustomerTable customers={rows} />
    </div>
  );
}

// =============================================================================
// Customer Table (Client-side for navigation)
// =============================================================================

function CustomerTable({ customers }: { customers: CustomerRow[] }) {
  const columns: Column<CustomerRow>[] = [
    {
      key: 'name',
      header: 'Name',
      render: (row) => (
        <Link
          href={`/dashboard/customers/${row.id}`}
          className="font-medium text-foreground hover:text-primary transition-colors"
        >
          {row.name}
        </Link>
      ),
    },
    {
      key: 'phone',
      header: 'Phone',
      render: (row) => <span className="text-muted-foreground">{row.phone}</span>,
    },
    {
      key: 'total_visits',
      header: 'Total Visits',
      render: (row) => <span>{row.total_visits}</span>,
    },
    {
      key: 'total_spent',
      header: 'Total Spent',
      render: (row) => <span>{formatINR(row.total_spent)}</span>,
    },
    {
      key: 'last_visit_at',
      header: 'Last Visit',
      render: (row) => (
        <span className="text-muted-foreground">
          {row.last_visit_at ? formatDateIN(row.last_visit_at) : '—'}
        </span>
      ),
    },
    {
      key: 'membership',
      header: 'Membership',
      render: (row) =>
        row.has_active_membership ? (
          <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
            Active
          </span>
        ) : (
          <span className="text-muted-foreground text-xs">—</span>
        ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={customers}
      getRowKey={(row) => row.id}
      emptyMessage="No customers found"
    />
  );
}
