'use client';

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { formatINR } from '@/lib/utils';
import type { DailyRevenue, ServiceRevenue, PaymentBreakdown, RevenueStats } from './actions';

interface RevenueChartsProps {
  stats: RevenueStats;
  dailyRevenue: DailyRevenue[];
  topServices: ServiceRevenue[];
  paymentBreakdown: PaymentBreakdown[];
}

type Segment = { name: string; value: number; color: string };

const PAYMENT_COLORS: Record<string, string> = {
  cash: '#10b981',
  upi: '#6366f1',
  card: '#f59e0b',
  other: '#94a3b8',
};

// Vibrant, cohesive palette for ranking the top services.
const SERVICE_COLORS = ['#8b5cf6', '#d946ef', '#6366f1', '#06b6d4', '#10b981', '#f59e0b', '#f43f5e', '#3b82f6'];

export function RevenueCharts({ stats, dailyRevenue, topServices, paymentBreakdown }: RevenueChartsProps) {
  // Where every rupee of revenue goes: profit + operating expenses + product cost.
  const moneyFlow: Segment[] = [
    { name: 'Net Profit', value: Math.max(0, stats.netProfit), color: '#10b981' },
    { name: 'Expenses', value: stats.totalExpenses, color: '#ef4444' },
    { name: 'Product Cost', value: stats.productCost, color: '#f59e0b' },
  ].filter((d) => d.value > 0);

  const apptDone = stats.completedAppointments;
  const apptCancelled = stats.cancelledAppointments;
  const apptOther = Math.max(0, stats.totalAppointments - apptDone - apptCancelled);
  const appointments: Segment[] = [
    { name: 'Completed', value: apptDone, color: '#10b981' },
    { name: 'Cancelled', value: apptCancelled, color: '#ef4444' },
    { name: 'Scheduled', value: apptOther, color: '#6366f1' },
  ].filter((d) => d.value > 0);
  const completionRate = stats.totalAppointments > 0 ? Math.round((apptDone / stats.totalAppointments) * 100) : 0;

  const returning = Math.max(0, stats.totalCustomers - stats.newCustomers);
  const customers: Segment[] = [
    { name: 'New', value: stats.newCustomers, color: '#8b5cf6' },
    { name: 'Existing', value: returning, color: '#3b82f6' },
  ].filter((d) => d.value > 0);

  const payments: Segment[] = paymentBreakdown.map((p) => ({
    name: p.method.toUpperCase(),
    value: p.amount,
    color: PAYMENT_COLORS[p.method] || PAYMENT_COLORS.other,
  }));

  const asMoney = (v: number) => formatINR(v);
  const asCount = (v: number) => v.toLocaleString('en-IN');

  return (
    <div className="space-y-6">
      {/* Revenue Over Time — hero chart */}
      <div className="rounded-xl border border-border bg-card p-4 sm:p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-foreground">Revenue Over Time</h3>
          <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
            {formatINR(stats.totalRevenue)}
          </span>
        </div>
        {dailyRevenue.length === 0 ? (
          <EmptyChart message="No revenue data for this period" />
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={dailyRevenue} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <defs>
                <linearGradient id="revAreaFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="revAreaStroke" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#6366f1" />
                  <stop offset="50%" stopColor="#8b5cf6" />
                  <stop offset="100%" stopColor="#d946ef" />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} className="text-muted-foreground" tickLine={false} axisLine={false} />
              <YAxis
                tick={{ fontSize: 11 }}
                className="text-muted-foreground"
                tickLine={false}
                axisLine={false}
                tickFormatter={(v: number) => (v >= 1000 ? `₹${(v / 1000).toFixed(0)}k` : `₹${v}`)}
              />
              <Tooltip content={<RevenueTooltip />} />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="url(#revAreaStroke)"
                strokeWidth={3}
                fill="url(#revAreaFill)"
                dot={false}
                activeDot={{ r: 5, strokeWidth: 2, fill: '#8b5cf6' }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Donut row — Money Flow (net profit), Appointments, Payment Methods */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        <DonutCard title="Money Flow" data={moneyFlow} format={asMoney} centerValue={formatINR(stats.netProfit)} centerLabel="Net Profit" />
        <DonutCard title="Appointments" data={appointments} format={asCount} centerValue={`${completionRate}%`} centerLabel="Completed" footnote={`Avg ${formatINR(stats.avgRevenuePerAppointment)} / visit`} />
        <DonutCard title="Payment Methods" data={payments} format={asMoney} />
      </div>

      {/* Top Services + New vs Returning customers */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-4 sm:p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4">Top Services</h3>
          {topServices.length === 0 ? (
            <EmptyChart message="No service data" />
          ) : (
            <div className="space-y-3">
              {topServices.map((svc, i) => {
                const maxRevenue = topServices[0]?.revenue || 1;
                const pct = Math.round((svc.revenue / maxRevenue) * 100);
                const color = SERVICE_COLORS[i % SERVICE_COLORS.length];
                return (
                  <div key={svc.name} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex min-w-0 items-center gap-2 font-medium text-foreground">
                        <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
                        <span className="truncate">{i + 1}. {svc.name}</span>
                      </span>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground shrink-0">
                        <span>{svc.count} bookings</span>
                        <span className="font-semibold text-foreground">{formatINR(svc.revenue)}</span>
                      </div>
                    </div>
                    <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${pct}%`, background: `linear-gradient(to right, ${color}b3, ${color})` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <DonutCard
          title="New vs Returning Customers"
          data={customers}
          format={asCount}
          centerValue={asCount(stats.newCustomers)}
          centerLabel="New this period"
        />
      </div>
    </div>
  );
}

// =============================================================================
// Reusable donut card — consistent premium look across all breakdowns.
// =============================================================================

function DonutCard({
  title,
  data,
  format,
  centerValue,
  centerLabel,
  footnote,
}: {
  title: string;
  data: Segment[];
  format: (v: number) => string;
  centerValue?: string;
  centerLabel?: string;
  footnote?: string;
}) {
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <div className="rounded-xl border border-border bg-card p-4 sm:p-5">
      <h3 className="text-sm font-semibold text-foreground mb-4">{title}</h3>
      {total <= 0 ? (
        <EmptyChart message="No data" />
      ) : (
        <div className="flex flex-col items-center gap-4">
          <div className="relative w-full" style={{ height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={82}
                  innerRadius={55}
                  paddingAngle={2}
                  cornerRadius={5}
                  stroke="none"
                >
                  {data.map((d) => (
                    <Cell key={d.name} fill={d.color} />
                  ))}
                </Pie>
                <Tooltip content={<DonutTooltip total={total} format={format} />} />
              </PieChart>
            </ResponsiveContainer>
            {(centerValue || centerLabel) && (
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                {centerValue && <span className="text-xl font-bold leading-none text-foreground">{centerValue}</span>}
                {centerLabel && <span className="mt-1 text-[11px] text-muted-foreground">{centerLabel}</span>}
              </div>
            )}
          </div>
          <div className="flex flex-wrap justify-center gap-x-3 gap-y-1.5">
            {data.map((d) => (
              <div key={d.name} className="flex items-center gap-1.5 text-xs">
                <span className="size-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                <span className="text-muted-foreground">{d.name}</span>
                <span className="font-medium text-foreground">{format(d.value)}</span>
              </div>
            ))}
          </div>
          {footnote && <p className="text-xs font-medium text-muted-foreground">{footnote}</p>}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Tooltips
// =============================================================================

function RevenueTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 shadow-lg">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold text-foreground">{formatINR(payload[0].value)}</p>
    </div>
  );
}

function DonutTooltip({ active, payload, total, format }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload as Segment;
  const pct = total > 0 ? Math.round((d.value / total) * 100) : 0;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 shadow-lg">
      <p className="text-xs text-muted-foreground">{d.name}</p>
      <p className="text-sm font-semibold text-foreground">{format(d.value)}</p>
      <p className="text-xs text-muted-foreground">{pct}% of total</p>
    </div>
  );
}

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="flex h-[200px] items-center justify-center">
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}
