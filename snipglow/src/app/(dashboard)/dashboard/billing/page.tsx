import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { RoleGuard } from '@/components/role-guard';
import { InvoicesTable, type InvoiceRow } from './billing-client';
import { Receipt, Plus } from 'lucide-react';
import type { PaymentMethod, PaymentStatus, UserRole } from '@/types';

// =============================================================================
// Invoice List Page — Server Component
// =============================================================================

export default async function BillingPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect('/login');
  }

  const role = (user.user_metadata?.role as UserRole) ?? 'staff';

  // Fetch invoices (RLS enforces tenant/branch scoping)
  const { data: invoices, error } = await supabase
    .from('invoices')
    .select('id, invoice_number, created_at, total, payment_method, payment_status, customer_id')
    .order('created_at', { ascending: false });

  if (error) {
    return (
      <div className="space-y-6">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-500/10 via-violet-500/5 to-transparent border border-violet-200/50 dark:border-violet-800/30 p-6">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-xl bg-violet-100 dark:bg-violet-900/30">
              <Receipt className="size-5 text-violet-600 dark:text-violet-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">Billing</h1>
              <p className="text-sm text-destructive">Failed to load invoices</p>
            </div>
          </div>
        </div>
        <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-card p-12 text-center">
          <p className="text-sm text-destructive">Failed to load invoices. Please try again.</p>
        </div>
      </div>
    );
  }

  // Fetch customer names separately
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

  // Map rows (all serializable)
  const rows: InvoiceRow[] = (invoices ?? []).map((inv) => ({
    id: inv.id,
    invoice_number: inv.invoice_number,
    customer_name: customerNameMap[inv.customer_id ?? ''] ?? '—',
    created_at: inv.created_at ?? '',
    total: inv.total,
    payment_method: inv.payment_method as PaymentMethod,
    payment_status: (inv.payment_status as PaymentStatus) ?? 'paid',
  }));

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-500/10 via-violet-500/5 to-transparent border border-violet-200/50 dark:border-violet-800/30 p-6">
        <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-xl bg-violet-100 dark:bg-violet-900/30">
              <Receipt className="size-5 text-violet-600 dark:text-violet-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">Billing</h1>
              <p className="text-sm text-muted-foreground">
                {rows.length} invoice{rows.length !== 1 ? 's' : ''} generated
              </p>
            </div>
          </div>
          <RoleGuard role={role} action="create" resource="billing">
            <Link
              href="/dashboard/billing/new"
              className="inline-flex h-11 sm:h-9 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <Plus className="size-4" />
              New Bill
            </Link>
          </RoleGuard>
        </div>
        <div className="absolute -right-6 -top-6 h-32 w-32 rounded-full bg-violet-500/5" />
        <div className="absolute -right-2 top-10 h-20 w-20 rounded-full bg-violet-400/5" />
      </div>

      {/* Invoice Table (Client Component) */}
      <InvoicesTable invoices={rows} />
    </div>
  );
}
