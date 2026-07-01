import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { RoleGuard } from '@/components/role-guard';
import { InvoicesTable, type InvoiceRow } from './billing-client';
import { BillingMonthFilter } from './billing-month-filter';
import { formatINR } from '@/lib/utils';
import { Receipt, Plus, IndianRupee, CalendarDays, CalendarRange, Package, Scissors, Smartphone, Banknote, CreditCard, Wallet } from 'lucide-react';
import type { PaymentMethod, PaymentStatus, UserRole } from '@/types';

// =============================================================================
// Invoice List Page — Server Component
// =============================================================================

interface BillingPageProps {
  searchParams: Promise<{ month?: string }>;
}

/** e.g. "2026-07" → "Jul 2026" */
function formatMonthLabel(ym: string): string {
  return new Date(`${ym}-01T12:00:00+05:30`).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
}

export default async function BillingPage({ searchParams }: BillingPageProps) {
  const params = await searchParams;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect('/login');
  }

  const role = (user.user_metadata?.role as UserRole) ?? 'staff';

  // Fetch invoices (RLS enforces tenant/branch scoping)
  const { data: invoices, error } = await (supabase as any)
    .from('invoices')
    .select('id, invoice_number, created_at, total, payment_method, payment_status, customer_id, invoice_type, wallet_amount')
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
  const customerIds = [...new Set(((invoices ?? []) as any[]).map((inv: any) => inv.customer_id).filter(Boolean))] as string[];
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
  const rows: InvoiceRow[] = (invoices ?? []).map((inv: any) => ({
    id: inv.id,
    invoice_number: inv.invoice_number,
    customer_name: customerNameMap[inv.customer_id ?? ''] ?? '—',
    customer_id: inv.customer_id ?? '',
    created_at: inv.created_at ?? '',
    total: inv.total,
    wallet_amount: Number(inv.wallet_amount ?? 0),
    payment_method: inv.payment_method as PaymentMethod,
    payment_status: (inv.payment_status as PaymentStatus) ?? 'paid',
  }));

  // ─── Billing statistics ──────────────────────────────────────────────────
  // All dates handled in IST so "today" / the selected month match the salon's clock.
  const istToday = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }); // YYYY-MM-DD
  const currentMonth = istToday.slice(0, 7); // YYYY-MM
  const selectedMonth = params.month && /^\d{4}-\d{2}$/.test(params.month) ? params.month : currentMonth;
  const monthLabel = formatMonthLabel(selectedMonth);

  // Closed range [monthStart, nextMonthStart) for the selected month.
  const monthStart = `${selectedMonth}-01`;
  const [selY, selM] = selectedMonth.split('-').map(Number);
  const nextMonthStart = selM === 12 ? `${selY + 1}-01-01` : `${selY}-${String(selM + 1).padStart(2, '0')}-01`;

  const istDateOf = (ts: string) =>
    ts ? new Date(ts).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }) : '';
  const inSelectedMonth = (ts: string) => {
    const d = istDateOf(ts);
    return d >= monthStart && d < nextMonthStart;
  };

  let todayCount = 0;
  let todayAmount = 0;
  let monthCount = 0;
  let monthAmount = 0;
  let totalAmount = 0;
  const monthInvoiceIds: string[] = [];

  for (const inv of invoices ?? []) {
    // Wallet top-ups are deposits, not service/product sales — exclude from the
    // revenue/sales stats (they still appear in the invoice list below).
    if ((inv as any).invoice_type === 'wallet_recharge') continue;
    const d = istDateOf(inv.created_at ?? '');
    const amt = inv.total ?? 0;
    totalAmount += amt;
    if (d === istToday) {
      todayCount += 1;
      todayAmount += amt;
    }
    if (d >= monthStart && d < nextMonthStart) {
      monthCount += 1;
      monthAmount += amt;
      monthInvoiceIds.push(inv.id);
    }
  }

  // Split this month's billed value into product vs service sales.
  let monthProductSales = 0;
  let monthServiceSales = 0;
  if (monthInvoiceIds.length > 0) {
    const { data: items } = await supabase
      .from('invoice_items')
      .select('line_total, item_type, invoice_id')
      .in('invoice_id', monthInvoiceIds);
    for (const it of items ?? []) {
      const line = (it as { line_total: number | null }).line_total ?? 0;
      if ((it as { item_type: string | null }).item_type === 'product') monthProductSales += line;
      else monthServiceSales += line;
    }
  }

  const totalCount = rows.length;

  // ─── Payment-method split (by invoiced value, selected month) ────────────
  // Split each service/product bill into its wallet portion + the external
  // (cash/upi/card) portion. Wallet top-up invoices are excluded — they're
  // deposits that show as "Wallet" when the balance is later spent. Scoped to
  // the selected month so the bar reflects that month's payment mix.
  let upiAmount = 0;
  let cashAmount = 0;
  let cardAmount = 0;
  let walletAmount = 0;
  for (const inv of invoices ?? []) {
    if ((inv as any).invoice_type === 'wallet_recharge') continue;
    if (!inSelectedMonth(inv.created_at ?? '')) continue;
    const t = inv.total ?? 0;
    const wallet = Number((inv as any).wallet_amount ?? 0);
    const external = Math.max(0, t - wallet);
    walletAmount += wallet;
    if (inv.payment_method === 'upi') upiAmount += external;
    else if (inv.payment_method === 'cash') cashAmount += external;
    else if (inv.payment_method === 'card') cardAmount += external;
  }

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
          <div className="flex w-full items-center gap-2 sm:w-auto">
            <BillingMonthFilter selectedMonth={selectedMonth} />
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
        </div>
        <div className="absolute -right-6 -top-6 h-32 w-32 rounded-full bg-violet-500/5" />
        <div className="absolute -right-2 top-10 h-20 w-20 rounded-full bg-violet-400/5" />
      </div>

      {/* Billing Statistics */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {/* Hero — Total invoiced (spans 2) */}
        <div className="col-span-2 relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-600 to-fuchsia-600 p-5 text-white shadow-lg shadow-violet-500/20">
          <div className="relative z-10">
            <div className="flex items-center gap-2 text-violet-100">
              <IndianRupee className="size-4" />
              <span className="text-xs font-medium uppercase tracking-wide">Total Amount Invoiced</span>
            </div>
            <p className="mt-2 text-2xl sm:text-3xl font-bold leading-tight">{formatINR(totalAmount)}</p>
            <p className="mt-1 text-xs text-violet-100/90">{totalCount} invoice{totalCount !== 1 ? 's' : ''} all time</p>
          </div>
          <div className="absolute -right-5 -bottom-6 opacity-20">
            <IndianRupee className="size-24" />
          </div>
        </div>

        <StatCard
          icon={<CalendarDays className="size-4" />}
          label="Today"
          value={formatINR(todayAmount)}
          sub={`${todayCount} invoice${todayCount !== 1 ? 's' : ''}`}
          iconBg="bg-emerald-100 dark:bg-emerald-900/30"
          iconColor="text-emerald-600 dark:text-emerald-400"
        />
        <StatCard
          icon={<CalendarRange className="size-4" />}
          label={monthLabel}
          value={formatINR(monthAmount)}
          sub={`${monthCount} invoice${monthCount !== 1 ? 's' : ''}`}
          iconBg="bg-blue-100 dark:bg-blue-900/30"
          iconColor="text-blue-600 dark:text-blue-400"
        />
        <StatCard
          icon={<Package className="size-4" />}
          label="Product Sales"
          value={formatINR(monthProductSales)}
          sub={monthLabel}
          iconBg="bg-amber-100 dark:bg-amber-900/30"
          iconColor="text-amber-600 dark:text-amber-400"
        />
        <StatCard
          icon={<Scissors className="size-4" />}
          label="Service Sales"
          value={formatINR(monthServiceSales)}
          sub={monthLabel}
          iconBg="bg-pink-100 dark:bg-pink-900/30"
          iconColor="text-pink-600 dark:text-pink-400"
        />
      </div>

      {/* Payment Methods Breakdown */}
      <PaymentMethodsCard upi={upiAmount} cash={cashAmount} card={cardAmount} wallet={walletAmount} monthLabel={monthLabel} />

      {/* Invoice Table (Client Component) */}
      <InvoicesTable invoices={rows} />
    </div>
  );
}

// =============================================================================
// Stat Card — compact billing metric tile
// =============================================================================

function StatCard({
  icon,
  label,
  value,
  sub,
  iconBg,
  iconColor,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  iconBg: string;
  iconColor: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 transition-all hover:shadow-sm">
      <div className={`flex size-8 items-center justify-center rounded-lg ${iconBg} ${iconColor}`}>
        {icon}
      </div>
      <p className="mt-2.5 text-lg font-bold text-foreground leading-tight">{value}</p>
      <p className="text-xs font-medium text-foreground/80 mt-0.5">{label}</p>
      <p className="text-xs text-muted-foreground">{sub}</p>
    </div>
  );
}

// =============================================================================
// Payment Methods Card — segmented bar with Google-color gradients
// =============================================================================

function PaymentMethodsCard({ upi, cash, card, wallet, monthLabel }: { upi: number; cash: number; card: number; wallet: number; monthLabel: string }) {
  const total = upi + cash + card + wallet;

  const methods = [
    {
      key: 'upi',
      label: 'UPI',
      amount: upi,
      icon: <Smartphone className="size-3.5" />,
      bar: 'bg-gradient-to-r from-[#34A853] to-[#1e8e3e]',
      dot: 'bg-gradient-to-br from-[#34A853] to-[#1e8e3e]',
      text: 'text-[#1e8e3e]',
    },
    {
      key: 'cash',
      label: 'Cash',
      amount: cash,
      icon: <Banknote className="size-3.5" />,
      bar: 'bg-gradient-to-r from-[#FBBC05] to-[#F59E0B]',
      dot: 'bg-gradient-to-br from-[#FBBC05] to-[#F59E0B]',
      text: 'text-[#d97706]',
    },
    {
      key: 'card',
      label: 'Card',
      amount: card,
      icon: <CreditCard className="size-3.5" />,
      bar: 'bg-gradient-to-r from-[#4285F4] to-[#1a73e8]',
      dot: 'bg-gradient-to-br from-[#4285F4] to-[#1a73e8]',
      text: 'text-[#1a73e8]',
    },
    {
      key: 'wallet',
      label: 'Wallet',
      amount: wallet,
      icon: <Wallet className="size-3.5" />,
      bar: 'bg-gradient-to-r from-[#EC4899] to-[#DB2777]',
      dot: 'bg-gradient-to-br from-[#EC4899] to-[#DB2777]',
      text: 'text-[#DB2777]',
    },
  ];

  const pct = (v: number) => (total > 0 ? (v / total) * 100 : 0);

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Payment Methods</h3>
          <p className="text-xs text-muted-foreground">Share of invoiced value · {monthLabel}</p>
        </div>
        <span className="text-sm font-bold text-foreground">{formatINR(total)}</span>
      </div>

      {/* Segmented gradient bar */}
      {total > 0 ? (
        <div className="flex h-4 w-full overflow-hidden rounded-full bg-muted gap-0.5">
          {methods
            .filter((m) => m.amount > 0)
            .map((m) => (
              <div
                key={m.key}
                className={`h-full ${m.bar} transition-all`}
                style={{ width: `${pct(m.amount)}%`, minWidth: '6px' }}
                title={`${m.label}: ${formatINR(m.amount)}`}
              />
            ))}
        </div>
      ) : (
        <div className="flex h-4 w-full items-center justify-center rounded-full bg-muted">
          <span className="text-[10px] text-muted-foreground">No payments recorded yet</span>
        </div>
      )}

      {/* Legend */}
      <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4 sm:gap-3">
        {methods.map((m) => (
          <div key={m.key} className="flex items-center gap-2.5 rounded-xl border border-border/60 bg-muted/30 p-2.5">
            <div className={`flex size-8 shrink-0 items-center justify-center rounded-lg text-white ${m.dot}`}>
              {m.icon}
            </div>
            <div className="min-w-0">
              <div className="flex items-baseline gap-1.5">
                <span className="text-sm font-bold text-foreground">{Math.round(pct(m.amount))}%</span>
                <span className="text-xs font-medium text-muted-foreground">{m.label}</span>
              </div>
              <p className={`text-xs font-medium truncate ${m.text}`}>{formatINR(m.amount)}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}


