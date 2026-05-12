import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { RoleGuard } from '@/components/role-guard';
import { InvoicesTable, type InvoiceRow } from './billing-client';
import type { DeliveryStatus, PaymentMethod, UserRole } from '@/types';

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

      {/* Invoice Table (Client Component) */}
      <InvoicesTable invoices={rows} />
    </div>
  );
}
