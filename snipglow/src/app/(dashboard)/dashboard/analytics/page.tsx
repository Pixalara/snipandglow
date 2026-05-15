import { redirect } from 'next/navigation';
import dynamic from 'next/dynamic';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { formatINR } from '@/lib/utils';
import {
  TrendingUp,
  Calendar,
  IndianRupee,
  Users,
  BarChart3,
  ShieldAlert,
  Wallet,
} from 'lucide-react';
import type { UserRole } from '@/types';
import type { DailyDataPoint, TopServiceDataPoint } from './analytics-charts';

// Lazy load the heavy recharts component
const AnalyticsCharts = dynamic(() => import('./analytics-charts').then(mod => ({ default: mod.AnalyticsCharts })), {
  loading: () => <div className="h-[300px] flex items-center justify-center text-sm text-muted-foreground">Loading charts...</div>,
});

// =============================================================================
// Analytics Dashboard Page — Server Component
// Calculates stats in real-time from invoices & appointments tables.
// Owner/Manager only (deny staff)
// =============================================================================

export default async function AnalyticsPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect('/login');
  }

  const role = (user.user_metadata?.role as UserRole) ?? 'staff';

  // Deny access to staff
  if (role === 'staff') {
    return (
      <div className="space-y-6">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-red-500/10 via-red-500/5 to-transparent border border-red-200/50 dark:border-red-800/30 p-6">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-xl bg-red-100 dark:bg-red-900/30">
              <ShieldAlert className="size-5 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">Analytics</h1>
              <p className="text-sm text-muted-foreground">Access restricted</p>
            </div>
          </div>
        </div>
        <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-card p-12 text-center">
          <div className="flex size-14 items-center justify-center rounded-full bg-red-50 dark:bg-red-900/20 mb-4">
            <ShieldAlert className="size-6 text-red-500" />
          </div>
          <h3 className="text-base font-semibold text-foreground">Access Denied</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm">
            Analytics is available for owners and managers only. Contact your salon owner for access.
          </p>
        </div>
      </div>
    );
  }

  const tenantId = user.user_metadata?.tenant_id as string | undefined;
  const branchId = user.user_metadata?.branch_id as string | undefined;

  if (!tenantId || !branchId) {
    return (
      <div className="space-y-6">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent border border-amber-200/50 dark:border-amber-800/30 p-6">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-900/30">
              <BarChart3 className="size-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">Analytics</h1>
              <p className="text-sm text-destructive">Missing tenant context</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Use admin client to bypass RLS
  const admin = createAdminClient();

  // Date range: last 30 days
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const thirtyDaysAgoStr = thirtyDaysAgo.toISOString();

  // Fetch invoices, appointments, expenses, and customer count in parallel
  const [invoicesRes, appointmentsRes, customersRes, expensesRes] = await Promise.all([
    admin
      .from('invoices')
      .select('id, total, payment_status, created_at')
      .eq('tenant_id', tenantId)
      .eq('branch_id', branchId)
      .gte('created_at', thirtyDaysAgoStr)
      .order('created_at', { ascending: true }),
    admin
      .from('appointments')
      .select('id, appointment_date, status, customer_id, created_at')
      .eq('tenant_id', tenantId)
      .eq('branch_id', branchId)
      .gte('created_at', thirtyDaysAgoStr)
      .order('created_at', { ascending: true }),
    admin
      .from('customers')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('branch_id', branchId),
    admin
      .from('expenses' as any)
      .select('amount, expense_date, created_at')
      .eq('tenant_id', tenantId)
      .eq('branch_id', branchId)
      .gte('expense_date', thirtyDaysAgo.toISOString().split('T')[0])
      .order('expense_date', { ascending: true }),
  ]);

  const { data: invoices, error: invoicesError } = invoicesRes;
  const { data: appointments, error: appointmentsError } = appointmentsRes;
  const { count: totalCustomers } = customersRes;
  const { data: expenses } = expensesRes;

  // Fetch invoice items for top services (depends on invoices result)
  const invoiceIds = (invoices ?? []).map((inv: any) => inv.id);
  let invoiceItems: any[] = [];
  if (invoiceIds.length > 0) {
    const { data: items } = await admin
      .from('invoice_items')
      .select('service_name, line_total')
      .in('invoice_id', invoiceIds);
    invoiceItems = items ?? [];
  }

  if (invoicesError || appointmentsError) {
    return (
      <div className="space-y-6">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent border border-amber-200/50 dark:border-amber-800/30 p-6">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-900/30">
              <BarChart3 className="size-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">Analytics</h1>
              <p className="text-sm text-destructive">Failed to load data</p>
            </div>
          </div>
        </div>
        <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-card p-12 text-center">
          <p className="text-sm text-destructive">Failed to load analytics data. Please try again.</p>
        </div>
      </div>
    );
  }

  const invoiceData = (invoices ?? []) as any[];
  const appointmentData = (appointments ?? []) as any[];
  const expenseData = (expenses ?? []) as any[];

  // ─── KPI Calculations ───────────────────────────────────────────────────────

  // Total Revenue (sum of all invoice totals with payment_status = 'paid')
  const totalRevenue = invoiceData
    .filter((inv) => inv.payment_status === 'paid')
    .reduce((sum, inv) => sum + (inv.total || 0), 0);

  // Total Expenses
  const totalExpenses = expenseData.reduce((sum, exp) => sum + (exp.amount || 0), 0);

  // Net Profit
  const netProfit = totalRevenue - totalExpenses;

  // Total Appointments
  const totalAppointments = appointmentData.length;

  // Avg Revenue per Appointment
  const avgRevenuePerAppointment = totalAppointments > 0
    ? Math.round(totalRevenue / totalAppointments)
    : 0;

  // Customer Retention: unique customers with appointments / total customers
  const uniqueCustomerIds = new Set(appointmentData.map((a) => a.customer_id));
  const retentionRate = totalCustomers && totalCustomers > 0
    ? Math.round((uniqueCustomerIds.size / totalCustomers) * 100 * 10) / 10
    : 0;

  // ─── Daily Chart Data ───────────────────────────────────────────────────────

  // Group invoices by date
  const dailyMap: Record<string, { revenue: number; appointment_count: number }> = {};

  for (const inv of invoiceData) {
    if (inv.payment_status !== 'paid') continue;
    const dateKey = new Date(inv.created_at).toISOString().split('T')[0];
    if (!dailyMap[dateKey]) {
      dailyMap[dateKey] = { revenue: 0, appointment_count: 0 };
    }
    dailyMap[dateKey].revenue += inv.total || 0;
  }

  for (const appt of appointmentData) {
    const dateKey = appt.appointment_date; // already in YYYY-MM-DD format
    if (!dailyMap[dateKey]) {
      dailyMap[dateKey] = { revenue: 0, appointment_count: 0 };
    }
    dailyMap[dateKey].appointment_count += 1;
  }

  // Sort by date and format
  const dailyData: DailyDataPoint[] = Object.entries(dailyMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dateStr, values]) => ({
      date: formatShortDate(dateStr),
      revenue: values.revenue,
      appointment_count: values.appointment_count,
    }));

  // ─── Top Services ───────────────────────────────────────────────────────────

  const serviceAgg: Record<string, number> = {};
  for (const item of invoiceItems) {
    const name = item.service_name || 'Unknown';
    serviceAgg[name] = (serviceAgg[name] || 0) + (item.line_total || 0);
  }

  const topServices: TopServiceDataPoint[] = Object.entries(serviceAgg)
    .map(([name, total_revenue]) => ({ name, total_revenue }))
    .sort((a, b) => b.total_revenue - a.total_revenue)
    .slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-500/10 via-indigo-500/5 to-transparent border border-indigo-200/50 dark:border-indigo-800/30 p-6">
        <div className="relative z-10 flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-xl bg-indigo-100 dark:bg-indigo-900/30">
            <BarChart3 className="size-5 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Analytics</h1>
            <p className="text-sm text-muted-foreground">Last 30 days performance overview</p>
          </div>
        </div>
        <div className="absolute -right-6 -top-6 h-32 w-32 rounded-full bg-indigo-500/5" />
        <div className="absolute -right-2 top-10 h-20 w-20 rounded-full bg-indigo-400/5" />
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <KPICard
          icon={<IndianRupee className="size-5" />}
          title="Total Revenue"
          value={formatINR(totalRevenue)}
          subtitle="Last 30 days"
          gradient="from-emerald-500/10 to-emerald-600/5"
          iconColor="text-emerald-600 dark:text-emerald-400"
          iconBg="bg-emerald-100 dark:bg-emerald-900/30"
        />
        <KPICard
          icon={<Wallet className="size-5" />}
          title="Total Expenses"
          value={formatINR(totalExpenses)}
          subtitle="Last 30 days"
          gradient="from-red-500/10 to-red-600/5"
          iconColor="text-red-600 dark:text-red-400"
          iconBg="bg-red-100 dark:bg-red-900/30"
        />
        <KPICard
          icon={<TrendingUp className="size-5" />}
          title="Net Profit"
          value={formatINR(netProfit)}
          subtitle={netProfit >= 0 ? 'Profit' : 'Loss'}
          gradient={netProfit >= 0 ? "from-emerald-500/10 to-emerald-600/5" : "from-red-500/10 to-red-600/5"}
          iconColor={netProfit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}
          iconBg={netProfit >= 0 ? "bg-emerald-100 dark:bg-emerald-900/30" : "bg-red-100 dark:bg-red-900/30"}
        />
        <KPICard
          icon={<Calendar className="size-5" />}
          title="Total Appointments"
          value={totalAppointments.toLocaleString('en-IN')}
          subtitle="Last 30 days"
          gradient="from-blue-500/10 to-blue-600/5"
          iconColor="text-blue-600 dark:text-blue-400"
          iconBg="bg-blue-100 dark:bg-blue-900/30"
        />
        <KPICard
          icon={<IndianRupee className="size-5" />}
          title="Avg Revenue / Appt"
          value={formatINR(avgRevenuePerAppointment)}
          subtitle="Last 30 days"
          gradient="from-violet-500/10 to-violet-600/5"
          iconColor="text-violet-600 dark:text-violet-400"
          iconBg="bg-violet-100 dark:bg-violet-900/30"
        />
        <KPICard
          icon={<Users className="size-5" />}
          title="Customer Retention"
          value={`${retentionRate}%`}
          subtitle="Active customers"
          gradient="from-amber-500/10 to-amber-600/5"
          iconColor="text-amber-600 dark:text-amber-400"
          iconBg="bg-amber-100 dark:bg-amber-900/30"
        />
      </div>

      {/* Charts */}
      <AnalyticsCharts dailyData={dailyData} topServices={topServices} />
    </div>
  );
}

// =============================================================================
// KPI Card Component
// =============================================================================

function KPICard({
  icon,
  title,
  value,
  subtitle,
  gradient,
  iconColor,
  iconBg,
}: {
  icon: React.ReactNode;
  title: string;
  value: string;
  subtitle: string;
  gradient: string;
  iconColor: string;
  iconBg: string;
}) {
  return (
    <div className="group relative overflow-hidden rounded-xl border border-border bg-card p-4 transition-all hover:shadow-md hover:-translate-y-0.5">
      <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-50`} />
      <div className="relative">
        <div className={`flex size-9 items-center justify-center rounded-lg ${iconBg} ${iconColor}`}>
          {icon}
        </div>
        <p className="text-2xl font-bold text-foreground mt-3">{value}</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          <span className="font-medium">{title}</span>
        </p>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </div>
    </div>
  );
}

// =============================================================================
// Helper: Format date as short label for charts (e.g., "29 Apr")
// =============================================================================

function formatShortDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00+05:30');
  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    timeZone: 'Asia/Kolkata',
  });
}
