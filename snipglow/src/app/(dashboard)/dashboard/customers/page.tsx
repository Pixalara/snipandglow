import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Suspense } from 'react';
import { createClient } from '@/lib/supabase/server';
import { RoleGuard } from '@/components/role-guard';
import { CustomerSearch } from './customer-search';
import { CustomersTable, type CustomerRow } from './customers-client';
import { Users, UserPlus, Search } from 'lucide-react';
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

  // Fetch customers with only needed columns + limit for performance
  let query = supabase
    .from('customers')
    .select('id, name, phone, email, gender, notes, total_visits, total_spent, last_visit_at, created_at, tenant_id, branch_id')
    .order('name', { ascending: true })
    .limit(200);

  if (search) {
    query = query.or(`name.ilike.%${search}%,phone.ilike.%${search}%`);
  }

  const [{ data: customers, error }, membershipsRes] = await Promise.all([
    query,
    supabase.from('customer_memberships').select('customer_id').eq('status', 'active'),
  ]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-card p-12 text-center">
        <p className="text-sm text-destructive">Failed to load customers. Please try again.</p>
      </div>
    );
  }

  const activeMemberships: Record<string, boolean> = {};
  for (const m of membershipsRes.data ?? []) activeMemberships[m.customer_id] = true;

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
    <div className="space-y-6">
      {/* Page Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent border border-emerald-200/50 dark:border-emerald-800/30 p-6">
        <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-900/30">
              <Users className="size-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">Customers</h1>
              <p className="text-sm text-muted-foreground">
                {rows.length} customer{rows.length !== 1 ? 's' : ''} in your database
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            <Suspense fallback={<div className="h-9 w-full sm:w-64 animate-pulse rounded-xl bg-muted" />}>
              <CustomerSearch defaultValue={search} />
            </Suspense>
            <RoleGuard role={role} action="create" resource="customers">
              <Link
                href="/dashboard/customers/new"
                className="inline-flex h-11 sm:h-9 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                <UserPlus className="size-4" />
                <span className="hidden sm:inline">New Customer</span>
                <span className="sm:hidden">Add</span>
              </Link>
            </RoleGuard>
          </div>
        </div>
        <div className="absolute -right-6 -top-6 h-32 w-32 rounded-full bg-emerald-500/5" />
        <div className="absolute -right-2 top-10 h-20 w-20 rounded-full bg-emerald-400/5" />
      </div>

      {/* Loyalty Tier Legend */}
      <div className="rounded-xl border border-border bg-card px-4 py-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Loyalty Tiers — based on total visits</p>
        <div className="flex flex-wrap gap-2">
          {[
            { emoji: '🆕', label: 'New', range: '0 visits', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400', border: 'border-blue-200 dark:border-blue-800/30' },
            { emoji: '👤', label: 'Regular', range: '1–4 visits', color: 'bg-slate-100 text-slate-700 dark:bg-slate-800/50 dark:text-slate-300', border: 'border-slate-200 dark:border-slate-700/30' },
            { emoji: '🥈', label: 'Silver', range: '5–9 visits', color: 'bg-gray-100 text-gray-700 dark:bg-gray-800/50 dark:text-gray-300', border: 'border-gray-200 dark:border-gray-700/30' },
            { emoji: '🥇', label: 'Gold', range: '10–24 visits', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', border: 'border-amber-200 dark:border-amber-800/30' },
            { emoji: '💎', label: 'VIP', range: '25+ visits', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400', border: 'border-purple-200 dark:border-purple-800/30' },
          ].map(({ emoji, label, range, color, border }) => (
            <div key={label} className={`flex items-center gap-2 rounded-xl border ${border} ${color} px-3 py-2`}>
              <span className="text-base">{emoji}</span>
              <div>
                <p className="text-xs font-bold leading-tight">{label}</p>
                <p className="text-[10px] opacity-70 leading-tight">{range}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Customer Table (Client Component) */}
      <CustomersTable customers={rows} />
    </div>
  );
}
