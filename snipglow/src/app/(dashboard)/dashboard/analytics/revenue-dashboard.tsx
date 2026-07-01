'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import * as XLSX from 'xlsx';
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
  this_month: 'This Month',
  mtd: 'Month to Date',
  ytd: 'Year to Date',
  custom: 'Custom Range',
  // Legacy
  month: 'Last 30 Days',
  '3months': 'Last 3 Months',
  year: 'Last Year',
};

// Presets shown as tabs (legacy values still resolve from URLs, just not listed).
// 'month' = rolling Last 30 Days (the default) so the dashboard always shows
// recent activity — even on the 1st of a month when "This Month" is still empty.
const periods: PeriodType[] = ['today', 'week', 'month', 'this_month', 'ytd', 'custom'];

function formatRangeLabel(start: string, end: string): string {
  const fmt = (s: string) =>
    new Date(s + 'T12:00:00+05:30').toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  return start === end ? fmt(start) : `${fmt(start)} – ${fmt(end)}`;
}

export function RevenueDashboardClient({ data, currentPeriod }: RevenueDashboardClientProps) {
  const router = useRouter();
  const { stats } = data;

  const [customStart, setCustomStart] = useState(data.range.start);
  const [customEnd, setCustomEnd] = useState(data.range.end);

  const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

  function handlePeriodChange(period: PeriodType) {
    if (period === 'custom') {
      router.push(
        `/dashboard/analytics?period=custom&start=${customStart}&end=${customEnd}`,
      );
      return;
    }
    router.push(`/dashboard/analytics?period=${period}`);
  }

  function applyCustomRange() {
    if (!customStart || !customEnd) return;
    const [s, e] = customStart <= customEnd ? [customStart, customEnd] : [customEnd, customStart];
    router.push(`/dashboard/analytics?period=custom&start=${s}&end=${e}`);
  }

  function handleExport() {
    const wb = XLSX.utils.book_new();
    const money = '"\u20B9"#,##0'; // ₹ formatted, thousands separated
    const rangeText = formatRangeLabel(data.range.start, data.range.end);
    const generatedOn = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

    // ─── Sheet 1: Summary ─────────────────────────────────────────────────
    const summaryAoa: (string | number)[][] = [
      ['Revenue Report'],
      ['Period', periodLabels[currentPeriod]],
      ['Date Range', rangeText],
      ['Generated', generatedOn],
      [],
      ['Metric', 'Value'],
      ['Total Revenue', stats.totalRevenue],
      ['Total Expenses', stats.totalExpenses],
      ['Net Profit (after expenses & product cost)', stats.netProfit],
      ['Total Appointments', stats.totalAppointments],
      ['Completed Appointments', stats.completedAppointments],
      ['Cancelled Appointments', stats.cancelledAppointments],
      ['Avg Revenue / Appointment', stats.avgRevenuePerAppointment],
      ['Total Invoices', stats.totalInvoices],
      ['Total Customers', stats.totalCustomers],
      ['New Customers (this period)', stats.newCustomers],
      ['Product Sales', stats.productSales],
      ['Product Cost', stats.productCost],
      ['Product Margin', stats.productMargin],
      ['Product Units Sold', stats.productUnitsSold],
    ];
    const wsSummary = XLSX.utils.aoa_to_sheet(summaryAoa);
    wsSummary['!cols'] = [{ wch: 42 }, { wch: 20 }];
    // Money rows (0-indexed by row in the sheet): revenue, expenses, profit, avg,
    // product sales, cost, margin.
    const moneyRows = [6, 7, 8, 12, 16, 17, 18];
    for (const r of moneyRows) {
      const cell = wsSummary[XLSX.utils.encode_cell({ r, c: 1 })];
      if (cell) cell.z = money;
    }
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');

    // ─── Sheet 2: Daily Revenue ───────────────────────────────────────────
    const dailyAoa: (string | number)[][] = [['Date', 'Revenue', 'Appointments', 'Invoices']];
    for (const d of data.dailyRevenue) {
      dailyAoa.push([d.date, d.revenue, d.appointments, d.invoices]);
    }
    const wsDaily = XLSX.utils.aoa_to_sheet(dailyAoa);
    wsDaily['!cols'] = [{ wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 12 }];
    for (let i = 0; i < data.dailyRevenue.length; i++) {
      const cell = wsDaily[XLSX.utils.encode_cell({ r: i + 1, c: 1 })];
      if (cell) cell.z = money;
    }
    XLSX.utils.book_append_sheet(wb, wsDaily, 'Daily Revenue');

    // ─── Sheet 3: Top Services ────────────────────────────────────────────
    const servicesAoa: (string | number)[][] = [['Service', 'Revenue', 'Bookings']];
    for (const s of data.topServices) {
      servicesAoa.push([s.name, s.revenue, s.count]);
    }
    const wsServices = XLSX.utils.aoa_to_sheet(servicesAoa);
    wsServices['!cols'] = [{ wch: 32 }, { wch: 14 }, { wch: 12 }];
    for (let i = 0; i < data.topServices.length; i++) {
      const cell = wsServices[XLSX.utils.encode_cell({ r: i + 1, c: 1 })];
      if (cell) cell.z = money;
    }
    XLSX.utils.book_append_sheet(wb, wsServices, 'Top Services');

    // ─── Sheet 4: Payment Methods ─────────────────────────────────────────
    const payAoa: (string | number)[][] = [['Method', 'Amount', 'Transactions']];
    for (const p of data.paymentBreakdown) {
      payAoa.push([p.method.toUpperCase(), p.amount, p.count]);
    }
    const wsPay = XLSX.utils.aoa_to_sheet(payAoa);
    wsPay['!cols'] = [{ wch: 18 }, { wch: 14 }, { wch: 14 }];
    for (let i = 0; i < data.paymentBreakdown.length; i++) {
      const cell = wsPay[XLSX.utils.encode_cell({ r: i + 1, c: 1 })];
      if (cell) cell.z = money;
    }
    XLSX.utils.book_append_sheet(wb, wsPay, 'Payment Methods');

    // ─── Sheet 5: Peak Hours ──────────────────────────────────────────────
    const hoursAoa: (string | number)[][] = [['Hour', 'Appointments']];
    for (const h of data.hourlyHeatmap) {
      hoursAoa.push([h.label, h.count]);
    }
    const wsHours = XLSX.utils.aoa_to_sheet(hoursAoa);
    wsHours['!cols'] = [{ wch: 12 }, { wch: 14 }];
    XLSX.utils.book_append_sheet(wb, wsHours, 'Peak Hours');

    const fileTag =
      currentPeriod === 'custom' ? `${data.range.start}_to_${data.range.end}` : currentPeriod;
    XLSX.writeFile(wb, `revenue-report-${fileTag}.xlsx`);
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
              <p className="text-sm text-muted-foreground">{formatRangeLabel(data.range.start, data.range.end)}</p>
            </div>
          </div>
          <button
            onClick={handleExport}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-border bg-card px-4 text-sm font-medium text-foreground hover:bg-muted transition-colors"
          >
            <Download className="size-4" />
            Export Excel
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

      {/* Custom Date Range Picker */}
      {currentPeriod === 'custom' && (
        <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-end">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">From</label>
            <input
              type="date"
              value={customStart}
              max={customEnd || todayStr}
              onChange={(e) => setCustomStart(e.target.value)}
              className="h-9 rounded-lg border border-border bg-background px-3 text-sm text-foreground"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">To</label>
            <input
              type="date"
              value={customEnd}
              min={customStart}
              max={todayStr}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="h-9 rounded-lg border border-border bg-background px-3 text-sm text-foreground"
            />
          </div>
          <button
            onClick={applyCustomRange}
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-4 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
          >
            <Calendar className="size-4" />
            Apply
          </button>
        </div>
      )}

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
          subtitle="After expenses & product cost"
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
