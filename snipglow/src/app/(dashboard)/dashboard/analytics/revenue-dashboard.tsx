'use client';

import { useRouter } from 'next/navigation';
import { formatINR } from '@/lib/utils';
import {
  IndianRupee,
  TrendingUp,
  TrendingDown,
  Calendar,
  Users,
  Receipt,
  Wallet,
  UserPlus,
  XCircle,
  BarChart3,
  Download,
  Package,
  Percent,
} from 'lucide-react';
import type { RevenueData, PeriodType } from './actions';
import { RevenueCharts } from './revenue-charts';

interface RevenueDashboardClientProps {
  data: RevenueData;
  currentPeriod: PeriodType;
}

const periodLabels: Record<PeriodType, string> = {
  today: 'Today',
  week: 'This Week',
  month: 'Last 30 Days',
  '3months': 'Last 3 Months',
  year: 'Last Year',
};

const periods: PeriodType[] = ['today', 'week', 'month', '3months', 'year'];

export function RevenueDashboardClient({ data, currentPeriod }: RevenueDashboardClientProps) {
  const router = useRouter();
  const { stats } = data;

  function handlePeriodChange(period: PeriodType) {
    router.push(`/dashboard/analytics?period=${period}`);
  }

  function handleExport() {
    // Build CSV content
    const lines: string[] = [];
    lines.push('Revenue Report - ' + periodLabels[currentPeriod]);
    lines.push('');
    lines.push('Summary');
    lines.push(`Total Revenue,${stats.totalRevenue}`);
    lines.push(`Total Expenses,${stats.totalExpenses}`);
    lines.push(`Net Profit,${stats.netProfit}`);
    lines.push(`Total Appointments,${stats.totalAppointments}`);
    lines.push(`Completed,${stats.completedAppointments}`);
    lines.push(`Cancelled,${stats.cancelledAppointments}`);
    lines.push(`Avg Revenue/Appointment,${stats.avgRevenuePerAppointment}`);
    lines.push(`New Customers,${stats.newCustomers}`);
    lines.push(`Total Invoices,${stats.totalInvoices}`);
    lines.push(`Product Sales,${stats.productSales}`);
    lines.push(`Product Cost,${stats.productCost}`);
    lines.push(`Product Margin,${stats.productMargin}`);
    lines.push(`Product Units Sold,${stats.productUnitsSold}`);
    lines.push('');
    lines.push('Daily Revenue');
    lines.push('Date,Revenue,Appointments,Invoices');
    for (const d of data.dailyRevenue) {
      lines.push(`${d.date},${d.revenue},${d.appointments},${d.invoices}`);
    }
    lines.push('');
    lines.push('Top Services');
    lines.push('Service,Revenue,Bookings');
    for (const s of data.topServices) {
      lines.push(`${s.name},${s.revenue},${s.count}`);
    }
    lines.push('');
    lines.push('Payment Methods');
    lines.push('Method,Amount,Count');
    for (const p of data.paymentBreakdown) {
      lines.push(`${p.method},${p.amount},${p.count}`);
    }
    lines.push('');
    lines.push('Peak Hours');
    lines.push('Hour,Appointments');
    for (const h of data.hourlyHeatmap) {
      lines.push(`${h.label},${h.count}`);
    }

    const csv = lines.join('\r\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `revenue-report-${currentPeriod}-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-500/10 via-indigo-500/5 to-transparent border border-indigo-200/50 dark:border-indigo-800/30 p-6">
        <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-xl bg-indigo-100 dark:bg-indigo-900/30">
              <BarChart3 className="size-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">Revenue Dashboard</h1>
              <p className="text-sm text-muted-foreground">{periodLabels[currentPeriod]} performance overview</p>
            </div>
          </div>
          <button
            onClick={handleExport}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-border bg-card px-4 text-sm font-medium text-foreground hover:bg-muted transition-colors"
          >
            <Download className="size-4" />
            Export CSV
          </button>
        </div>
        <div className="absolute -right-6 -top-6 h-32 w-32 rounded-full bg-indigo-500/5" />
      </div>

      {/* Period Selector */}
      <div className="flex gap-1 rounded-xl border border-border bg-muted/50 p-1 overflow-x-auto">
        {periods.map((p) => (
          <button
            key={p}
            onClick={() => handlePeriodChange(p)}
            className={`flex-shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              currentPeriod === p
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {periodLabels[p]}
          </button>
        ))}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        <KPICard
          icon={<IndianRupee className="size-4" />}
          title="Revenue"
          value={formatINR(stats.totalRevenue)}
          iconBg="bg-emerald-100 dark:bg-emerald-900/30"
          iconColor="text-emerald-600 dark:text-emerald-400"
        />
        <KPICard
          icon={<Wallet className="size-4" />}
          title="Expenses"
          value={formatINR(stats.totalExpenses)}
          iconBg="bg-red-100 dark:bg-red-900/30"
          iconColor="text-red-600 dark:text-red-400"
        />
        <KPICard
          icon={stats.netProfit >= 0 ? <TrendingUp className="size-4" /> : <TrendingDown className="size-4" />}
          title="Net Profit"
          value={formatINR(stats.netProfit)}
          iconBg={stats.netProfit >= 0 ? 'bg-emerald-100 dark:bg-emerald-900/30' : 'bg-red-100 dark:bg-red-900/30'}
          iconColor={stats.netProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}
        />
        <KPICard
          icon={<Calendar className="size-4" />}
          title="Appointments"
          value={String(stats.totalAppointments)}
          subtitle={`${stats.completedAppointments} done`}
          iconBg="bg-blue-100 dark:bg-blue-900/30"
          iconColor="text-blue-600 dark:text-blue-400"
        />
        <KPICard
          icon={<XCircle className="size-4" />}
          title="Cancelled"
          value={String(stats.cancelledAppointments)}
          iconBg="bg-orange-100 dark:bg-orange-900/30"
          iconColor="text-orange-600 dark:text-orange-400"
        />
        <KPICard
          icon={<Receipt className="size-4" />}
          title="Invoices"
          value={String(stats.totalInvoices)}
          iconBg="bg-violet-100 dark:bg-violet-900/30"
          iconColor="text-violet-600 dark:text-violet-400"
        />
        <KPICard
          icon={<IndianRupee className="size-4" />}
          title="Avg / Visit"
          value={formatINR(stats.avgRevenuePerAppointment)}
          iconBg="bg-cyan-100 dark:bg-cyan-900/30"
          iconColor="text-cyan-600 dark:text-cyan-400"
        />
        <KPICard
          icon={<Users className="size-4" />}
          title="Total Customers"
          value={String(stats.totalCustomers)}
          iconBg="bg-pink-100 dark:bg-pink-900/30"
          iconColor="text-pink-600 dark:text-pink-400"
        />
        <KPICard
          icon={<UserPlus className="size-4" />}
          title="New Customers"
          value={String(stats.newCustomers)}
          subtitle="This period"
          iconBg="bg-teal-100 dark:bg-teal-900/30"
          iconColor="text-teal-600 dark:text-teal-400"
        />
        <KPICard
          icon={<Package className="size-4" />}
          title="Product Sales"
          value={formatINR(stats.productSales)}
          subtitle={`${stats.productUnitsSold} sold`}
          iconBg="bg-amber-100 dark:bg-amber-900/30"
          iconColor="text-amber-600 dark:text-amber-400"
        />
        <KPICard
          icon={<Wallet className="size-4" />}
          title="Product Cost"
          value={formatINR(stats.productCost)}
          subtitle="Buying cost of sold products"
          iconBg="bg-rose-100 dark:bg-rose-900/30"
          iconColor="text-rose-600 dark:text-rose-400"
        />
        <KPICard
          icon={<Percent className="size-4" />}
          title="Product Margin"
          value={formatINR(stats.productMargin)}
          subtitle={stats.productSales > 0 ? `${Math.round((stats.productMargin / stats.productSales) * 100)}% margin` : 'No sales'}
          iconBg={stats.productMargin >= 0 ? 'bg-emerald-100 dark:bg-emerald-900/30' : 'bg-red-100 dark:bg-red-900/30'}
          iconColor={stats.productMargin >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}
        />
      </div>

      {/* Charts */}
      <RevenueCharts
        dailyRevenue={data.dailyRevenue}
        topServices={data.topServices}
        paymentBreakdown={data.paymentBreakdown}
      />
    </div>
  );
}

// =============================================================================
// KPI Card
// =============================================================================

function KPICard({
  icon,
  title,
  value,
  subtitle,
  iconBg,
  iconColor,
}: {
  icon: React.ReactNode;
  title: string;
  value: string;
  subtitle?: string;
  iconBg: string;
  iconColor: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-3.5 transition-all hover:shadow-sm">
      <div className={`flex size-8 items-center justify-center rounded-lg ${iconBg} ${iconColor}`}>
        {icon}
      </div>
      <p className="text-lg font-bold text-foreground mt-2 leading-tight">{value}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{title}</p>
      {subtitle && <p className="text-xs text-muted-foreground/70">{subtitle}</p>}
    </div>
  );
}
