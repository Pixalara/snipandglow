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
import type { DailyRevenue, ServiceRevenue, PaymentBreakdown } from './actions';

interface RevenueChartsProps {
  dailyRevenue: DailyRevenue[];
  topServices: ServiceRevenue[];
  paymentBreakdown: PaymentBreakdown[];
}

const PAYMENT_COLORS: Record<string, string> = {
  cash: '#10b981',
  upi: '#6366f1',
  card: '#f59e0b',
  other: '#94a3b8',
};

// Vibrant, cohesive palette for ranking the top services.
const SERVICE_COLORS = ['#8b5cf6', '#d946ef', '#6366f1', '#06b6d4', '#10b981', '#f59e0b', '#f43f5e', '#3b82f6'];

export function RevenueCharts({ dailyRevenue, topServices, paymentBreakdown }: RevenueChartsProps) {
  return (
    <div className="space-y-6">
      {/* Revenue Over Time */}
      <div className="rounded-xl border border-border bg-card p-4 sm:p-5">
        <h3 className="text-sm font-semibold text-foreground mb-4">Revenue Over Time</h3>
        {dailyRevenue.length === 0 ? (
          <EmptyChart message="No revenue data for this period" />
        ) : (
          <ResponsiveContainer width="100%" height={280}>
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
                tickFormatter={(v: number) => v >= 1000 ? `₹${(v / 1000).toFixed(0)}k` : `₹${v}`}
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
                    outerRadius={82}
                    innerRadius={48}
                    paddingAngle={2}
                    cornerRadius={5}
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
