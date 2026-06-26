import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { formatINR, formatDateIN } from '@/lib/utils';
import { getLoyaltyTier, getAverageSpend, getVisitFrequency, getDaysSinceLastVisit } from '@/lib/loyalty';
import { ProfileTabs } from './profile-tabs';
import { EditCustomerButton } from './edit-customer-button';
import { WalletSection } from './wallet-section';
import {
  VisitHistoryTable,
  BillingHistoryTable,
  WalletHistoryTable,
  type VisitRow,
  type BillingHistoryRow,
  type WalletTxRow,
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
  const [appointmentsRes, invoicesRes, membershipRes, walletRes, walletTxRes] = await Promise.all([
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
    (supabase as any)
      .from('customer_wallets')
      .select('balance')
      .eq('customer_id', id)
      .maybeSingle(),
    (supabase as any)
      .from('wallet_transactions')
      .select('id, type, amount, balance_after, description, created_at')
      .eq('customer_id', id)
      .order('created_at', { ascending: false })
      .limit(100),
  ]);

  const walletBalance = (walletRes as any)?.data ? Number((walletRes as any).data.balance) || 0 : 0;
  const walletRows: WalletTxRow[] = ((walletTxRes as any)?.data ?? []).map((t: any) => ({
    id: t.id,
    type: t.type,
    amount: t.amount,
    balance_after: t.balance_after,
    description: t.description ?? null,
    created_at: t.created_at ?? '',
  }));

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
      {/* Back Button + Book Appointment */}
      <div className="flex items-center justify-between">
        <Link
          href="/dashboard/customers"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Back to Customers
        </Link>
        <div className="flex items-center gap-2">
          <EditCustomerButton
            customer={{
              id,
              tenant_id: customer.tenant_id,
              branch_id: customer.branch_id,
              name: customer.name,
              phone: customer.phone,
              email: customer.email,
              gender: customer.gender,
              date_of_birth: customer.date_of_birth ?? null,
              notes: customer.notes,
              total_visits: customer.total_visits ?? 0,
              total_spent: customer.total_spent ?? 0,
              last_visit_at: customer.last_visit_at ?? null,
              created_at: customer.created_at ?? '',
              has_active_membership: activeMembership !== null,
            }}
          />
          <Link
            href={`/dashboard/appointments/new?customer_id=${id}&customer_name=${encodeURIComponent(customer.name)}`}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <svg className="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
            Book Appointment
          </Link>
        </div>
      </div>

      {/* Profile Header */}
      <CustomerProfileHeader
        customer={{
          name: customer.name,
          phone: customer.phone,
          email: customer.email,
          gender: customer.gender,
          date_of_birth: customer.date_of_birth ?? null,
          notes: customer.notes,
          total_visits: customer.total_visits ?? 0,
          total_spent: customer.total_spent ?? 0,
          last_visit_at: customer.last_visit_at ?? null,
          created_at: customer.created_at ?? '',
        }}
        activeMembership={activeMembership}
      />

      {/* Loyalty & Stats Card */}
      <LoyaltyStatsCard
        totalVisits={customer.total_visits ?? 0}
        totalSpent={customer.total_spent ?? 0}
        lastVisitAt={customer.last_visit_at ?? null}
        createdAt={customer.created_at ?? ''}
      />

      {/* Wallet balance + Add Balance */}
      <WalletSection customerId={id} customerName={customer.name} balance={walletBalance} />

      {/* Tabs: Visit History, Billing History & Wallet (Client Components) */}
      <ProfileTabs
        visitHistory={<VisitHistoryTable appointments={visitRows} />}
        billingHistory={<BillingHistoryTable invoices={billingRows} />}
        walletHistory={<WalletHistoryTable transactions={walletRows} />}
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
    date_of_birth: string | null;
    notes: string | null;
    total_visits: number;
    total_spent: number;
    last_visit_at: string | null;
    created_at: string;
  };
  activeMembership: ActiveMembership | null;
}) {
  const loyalty = getLoyaltyTier(customer.total_visits);

  return (
    <div className="rounded-lg border border-border bg-card p-6 space-y-4">
      {/* Name, Loyalty Badge, and Membership Badge */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-foreground">{customer.name}</h1>
          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${loyalty.color} ${loyalty.textColor}`}>
            {loyalty.emoji} {loyalty.label}
          </span>
        </div>
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
        {customer.date_of_birth && (
          <DetailItem label="Date of Birth" value={formatDateIN(customer.date_of_birth)} />
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
// Loyalty Stats Card — Shows tier progress, avg spend, frequency, last visit
// =============================================================================

function LoyaltyStatsCard({
  totalVisits,
  totalSpent,
  lastVisitAt,
  createdAt,
}: {
  totalVisits: number;
  totalSpent: number;
  lastVisitAt: string | null;
  createdAt: string;
}) {
  const loyalty = getLoyaltyTier(totalVisits);
  const avgSpend = getAverageSpend(totalSpent, totalVisits);
  const frequency = getVisitFrequency(totalVisits, createdAt);
  const daysSince = getDaysSinceLastVisit(lastVisitAt);

  // Progress to next tier
  const tierThresholds: Record<string, number> = { new: 0, regular: 1, silver: 5, gold: 10, vip: 25 };
  const currentThreshold = tierThresholds[loyalty.tier] ?? 0;
  const nextThreshold = loyalty.nextTier ? tierThresholds[loyalty.nextTier] : totalVisits;
  const progressPct = loyalty.nextTier
    ? Math.min(100, Math.round(((totalVisits - currentThreshold) / (nextThreshold - currentThreshold)) * 100))
    : 100;

  return (
    <div className="rounded-lg border border-border bg-card p-5 space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-lg">{loyalty.emoji}</span>
        <h2 className="text-sm font-semibold text-foreground">Loyalty Status</h2>
        <span className={`ml-auto inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${loyalty.color} ${loyalty.textColor}`}>
          {loyalty.label}
        </span>
      </div>

      {/* Progress to next tier */}
      {loyalty.nextTier && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{totalVisits} visits</span>
            <span>{loyalty.visitsToNextTier} more to {loyalty.nextTier.charAt(0).toUpperCase() + loyalty.nextTier.slice(1)}</span>
          </div>
          <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-primary/70 to-primary transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      )}
      {!loyalty.nextTier && (
        <p className="text-xs text-muted-foreground">🎉 Highest tier reached! Thank you for being a loyal customer.</p>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatBox label="Avg. Spend" value={avgSpend > 0 ? formatINR(avgSpend) : '—'} />
        <StatBox label="Frequency" value={frequency} />
        <StatBox
          label="Last Visit"
          value={daysSince !== null ? (daysSince === 0 ? 'Today' : `${daysSince}d ago`) : '—'}
        />
        <StatBox label="Total Visits" value={String(totalVisits)} />
      </div>
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-muted/50 p-3 text-center">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold text-foreground mt-0.5">{value}</p>
    </div>
  );
}
