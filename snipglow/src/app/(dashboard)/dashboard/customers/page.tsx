import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Suspense } from 'react';
import { createClient } from '@/lib/supabase/server';
import { RoleGuard } from '@/components/role-guard';
import { CustomerSearch } from './customer-search';
import { CustomersTable, type CustomerRow } from './customers-client';
import type { UserRole } from '@/types';

// =============================================================================
// Customer List Page — Server Component
// =============================================================================

interface CustomersPageProps {
  searchParams: Promise<{ search?: string }>;
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
          <Suspense fallback={<div className="h-8 w-64 animate-pulse rounded-lg bg-muted" />}>
            <CustomerSearch defaultValue={search} />
          </Suspense>
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

      {/* Customer Table (Client Component) */}
      <CustomersTable customers={rows} />
    </div>
  );
}
