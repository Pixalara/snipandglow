import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { formatINR, formatDateIN } from '@/lib/utils';
import { ProfileTabs } from './profile-tabs';
import {
  VisitHistoryTable,
  BillingHistoryTable,
  type VisitRow,
  type BillingHistoryRow,
} from './history-tables';

// =============================================================================
// Customer Profile Page — Server Component
// =============================================================================

interface CustomerProfilePageProps {
  params: Promise<{ id: string }>;
}

/** Active membership with plan details */
interface ActiveMembership {
  id: string;
  end_date: string;
  membership_name: string;
  discount_pct: number;
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
          href="/dashboard/customers"
          className="text-sm font-medium text-primary hover:text-primary/80 transition-colors"
        >
          ← Back to Customers
        </Link>
      </div>
    );
  }

  // Fetch all data in parallel
  const [appointmentsRes, invoicesRes, membershipRes] = await Promise.all([
    supabase
      .from('appointments')
      .select('id, appointment_date, start_time, service_id, employee_id')
      .eq('customer_id', id)
      .eq('status', 'completed')
      .order('appointment_date', { ascending: false })
      .limit(50),
    supabase
      .from('invoices')
      .select('id, invoice_number, total, payment_method, delivery_status, created_at')
      .eq('customer_id', id)
      .order('created_at', { ascending: false })
      .limit(50),
    supabase
      .from('customer_memberships')
      .select('id, end_date, membership_id, memberships(name, discount_pct)')
      .eq('customer_id', id)
      .eq('status', 'active')
      .maybeSingle(),
  ]);

  const apptList = appointmentsRes.data ?? [];
  const svcIds = [...new Set(apptList.map((a) => a.service_id).filter(Boolean))];
  const empIds = [...new Set(apptList.map((a) => a.employee_id).filter(Boolean))];

  const [svcRes, empRes] = await Promise.all([
    svcIds.length > 0 ? supabase.from('services').select('id, name').in('id', svcIds) : { data: [] },
    empIds.length > 0 ? supabase.from('employees').select('id, name').in('id', empIds) : { data: [] },
  ]);

  const svcMap: Record<string, string> = {};
  const empMap: Record<string, string> = {};
  for (const s of svcRes.data ?? []) svcMap[s.id] = s.name;
  for (const e of empRes.data ?? []) empMap[e.id] = e.name;

  const visitRows: VisitRow[] = apptList.map((a) => ({
    id: a.id,
    appointment_date: a.appointment_date,
    start_time: a.start_time,
    service_name: svcMap[a.service_id ?? ''] ?? '—',
    employee_name: empMap[a.employee_id ?? ''] ?? '—',
  }));

  const billingRows: BillingHistoryRow[] = (invoicesRes.data ?? []).map((inv) => ({
    id: inv.id,
    invoice_number: inv.invoice_number,
    total: inv.total,
    payment_method: inv.payment_method,
    delivery_status: inv.delivery_status ?? 'pending',
    created_at: inv.created_at ?? '',
  }));

  let activeMembership: ActiveMembership | null = null;
  if (membershipRes.data) {
    const m = membershipRes.data as any;
    activeMembership = {
      id: m.id,
      end_date: m.end_date,
      membership_name: m.memberships?.name ?? 'Membership',
      discount_pct: m.memberships?.discount_pct ?? 0,
    };
  }

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <Link
        href="/dashboard/customers"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        ← Back to Customers
      </Link>

      {/* Profile Header */}
      <CustomerProfileHeader
        customer={{
          name: customer.name,
          phone: customer.phone,
          email: customer.email,
          gender: customer.gender,
          notes: customer.notes,
          total_visits: customer.total_visits ?? 0,
          total_spent: customer.total_spent ?? 0,
          created_at: customer.created_at ?? '',
        }}
        activeMembership={activeMembership}
      />

      {/* Tabs: Visit History & Billing History (Client Components) */}
      <ProfileTabs
        visitHistory={<VisitHistoryTable appointments={visitRows} />}
        billingHistory={<BillingHistoryTable invoices={billingRows} />}
      />
    </div>
  );
}

// =============================================================================
// Profile Header (Server Component — no function props passed)
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
            <span>🏅 {activeMembership.membership_name}</span>
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
