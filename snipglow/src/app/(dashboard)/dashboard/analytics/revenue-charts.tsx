'use client';

import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { formatINR } from '@/lib/utils';
import type { DailyRevenue, ServiceRevenue, PaymentBreakdown, HourlyHeatmap } from './actions';

interface RevenueChartsProps {
  dailyRevenue: DailyRevenue[];
  topServices: ServiceRevenue[];
  paymentBreakdown: PaymentBreakdown[];
  hourlyHeatmap: HourlyHeatmap[];
}

const PAYMENT_COLORS: Record<string, string> = {
  cash: '#10b981',
  upi: '#6366f1',
  card: '#f59e0b',
  other: '#94a3b8',
};

export function RevenueCharts({ dailyRevenue, topServices, paymentBreakdown, hourlyHeatmap }: RevenueChartsProps) {
  const maxHourCount = Math.max(...hourlyHeatmap.map((h) => h.count), 1);

  return (
    <div className="space-y-6">
      {/* Revenue Over Time */}
      <div className="rounded-xl border border-border bg-card p-4 sm:p-5">
        <h3 className="text-sm font-semibold text-foreground mb-4">Revenue Over Time</h3>
        {dailyRevenue.length === 0 ? (
          <EmptyChart message="No revenue data for this period" />
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={dailyRevenue} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} className="text-muted-foreground" />
              <YAxis
                tick={{ fontSize: 11 }}
                className="text-muted-foreground"
                tickFormatter={(v: number) => v >= 1000 ? `₹${(v / 1000).toFixed(0)}k` : `₹${v}`}
              />
              <Tooltip content={<RevenueTooltip />} />
              <Line
                type="monotone"
                dataKey="revenue"
                stroke="hsl(var(--primary))"
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 5, strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Two-column layout: Top Services + Payment Breakdown */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Top Services */}
        <div className="rounded-xl border border-border bg-card p-4 sm:p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4">Top Services</h3>
          {topServices.length === 0 ? (
            <EmptyChart message="No service data" />
          ) : (
            <div className="space-y-3">
              {topServices.map((svc, i) => {
                const maxRevenue = topServices[0]?.revenue || 1;
                const pct = Math.round((svc.revenue / maxRevenue) * 100);
                return (
                  <div key={svc.name} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-foreground truncate max-w-[60%]">
                        {i + 1}. {svc.name}
                      </span>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground shrink-0">
                        <span>{svc.count} bookings</span>
                        <span className="font-semibold text-foreground">{formatINR(svc.revenue)}</span>
                      </div>
                    </div>
                    <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-primary/70 to-primary transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Payment Method Breakdown */}
        <div className="rounded-xl border border-border bg-card p-4 sm:p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4">Payment Methods</h3>
          {paymentBreakdown.length === 0 ? (
            <EmptyChart message="No payment data" />
          ) : (
            <div className="flex flex-col items-center gap-4">
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={paymentBreakdown}
                    dataKey="amount"
                    nameKey="method"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    innerRadius={45}
                    paddingAngle={2}
                    label={({ method, percent }: any) => `${(method || '').toUpperCase()} ${((percent || 0) * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {paymentBreakdown.map((entry) => (
                      <Cell key={entry.method} fill={PAYMENT_COLORS[entry.method] || PAYMENT_COLORS.other} />
                    ))}
                  </Pie>
                  <Tooltip content={<PaymentTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap justify-center gap-3">
                {paymentBreakdown.map((p) => (
                  <div key={p.method} className="flex items-center gap-1.5 text-xs">
                    <div
                      className="size-2.5 rounded-full"
                      style={{ backgroundColor: PAYMENT_COLORS[p.method] || PAYMENT_COLORS.other }}
                    />
                    <span className="text-muted-foreground uppercase">{p.method}</span>
                    <span className="font-medium text-foreground">{formatINR(p.amount)}</span>
                    <span className="text-muted-foreground">({p.count})</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Peak Hours Heatmap */}
      <div className="rounded-xl border border-border bg-card p-4 sm:p-5">
        <h3 className="text-sm font-semibold text-foreground mb-4">Peak Hours</h3>
        {hourlyHeatmap.every((h) => h.count === 0) ? (
          <EmptyChart message="No appointment data for peak hours" />
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-4 sm:grid-cols-8 lg:grid-cols-16 gap-1.5">
              {hourlyHeatmap.map((slot) => {
                const intensity = slot.count / maxHourCount;
                const bg = intensity === 0
                  ? 'bg-muted'
                  : intensity < 0.25
                    ? 'bg-emerald-100 dark:bg-emerald-900/30'
                    : intensity < 0.5
                      ? 'bg-emerald-200 dark:bg-emerald-800/40'
                      : intensity < 0.75
                        ? 'bg-emerald-400 dark:bg-emerald-700/60'
                        : 'bg-emerald-600 dark:bg-emerald-500';
                const textColor = intensity >= 0.75 ? 'text-white' : 'text-foreground';

                return (
                  <div
                    key={slot.hour}
                    className={`flex flex-col items-center justify-center rounded-lg p-2 ${bg} transition-colors`}
                    title={`${slot.label}: ${slot.count} appointments`}
                  >
                    <span className={`text-xs font-medium ${textColor}`}>{slot.label}</span>
                    <span className={`text-sm font-bold ${textColor}`}>{slot.count}</span>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center justify-end gap-2 text-xs text-muted-foreground">
              <span>Less</span>
              <div className="flex gap-0.5">
                <div className="size-3 rounded-sm bg-muted" />
                <div className="size-3 rounded-sm bg-emerald-100 dark:bg-emerald-900/30" />
                <div className="size-3 rounded-sm bg-emerald-200 dark:bg-emerald-800/40" />
                <div className="size-3 rounded-sm bg-emerald-400 dark:bg-emerald-700/60" />
                <div className="size-3 rounded-sm bg-emerald-600 dark:bg-emerald-500" />
              </div>
              <span>More</span>
            </div>
          </div>
        )}
      </div>

      {/* Appointments by Day — Bar Chart */}
      <div className="rounded-xl border border-border bg-card p-4 sm:p-5">
        <h3 className="text-sm font-semibold text-foreground mb-4">Appointments by Day</h3>
        {dailyRevenue.length === 0 ? (
          <EmptyChart message="No appointment data" />
        ) : (
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={dailyRevenue} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} className="text-muted-foreground" />
              <YAxis tick={{ fontSize: 11 }} className="text-muted-foreground" allowDecimals={false} />
              <Tooltip content={<AppointmentsTooltip />} />
              <Bar dataKey="appointments" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} maxBarSize={40} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// Custom Tooltips
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

function AppointmentsTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 shadow-lg">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold text-foreground">{payload[0].value} appointments</p>
    </div>
  );
}

function PaymentTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const data = payload[0].payload as PaymentBreakdown;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 shadow-lg">
      <p className="text-xs text-muted-foreground uppercase">{data.method}</p>
      <p className="text-sm font-semibold text-foreground">{formatINR(data.amount)}</p>
      <p className="text-xs text-muted-foreground">{data.count} transactions</p>
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
