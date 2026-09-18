'use client';

import { useMemo } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';
import { formatINR } from '@/lib/utils';
import type { ExpenseCategory } from '@/types';

// Minimal shape needed for the charts — ExpenseRow is assignable to this.
interface ExpenseChartRow {
  category: ExpenseCategory;
  amount: number;
  expense_date: string;
}

const CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  rent: 'Rent',
  supplies: 'Supplies',
  utilities: 'Utilities',
  marketing: 'Marketing',
  maintenance: 'Maintenance',
  other: 'Other',
};

const CATEGORY_HEX: Record<ExpenseCategory, string> = {
  rent: '#3b82f6',
  supplies: '#f59e0b',
  utilities: '#06b6d4',
  marketing: '#8b5cf6',
  maintenance: '#f97316',
  other: '#94a3b8',
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function ExpensesCharts({ expenses }: { expenses: ExpenseChartRow[] }) {
  // Totals per category (only non-zero), sorted biggest first.
  const byCategory = useMemo(() => {
    const totals = new Map<ExpenseCategory, number>();
    for (const e of expenses) {
      totals.set(e.category, (totals.get(e.category) || 0) + Number(e.amount));
    }
    return (Object.keys(CATEGORY_LABELS) as ExpenseCategory[])
      .map((cat) => ({ cat, name: CATEGORY_LABELS[cat], value: totals.get(cat) || 0, color: CATEGORY_HEX[cat] }))
      .filter((d) => d.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [expenses]);

  // Spending across the last 6 calendar months (including the current one).
  const monthly = useMemo(() => {
    const now = new Date();
    const buckets: { key: string; label: string; total: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      buckets.push({ key, label: MONTHS[d.getMonth()], total: 0 });
    }
    const idx = new Map(buckets.map((b, i) => [b.key, i] as const));
    for (const e of expenses) {
      const k = (e.expense_date || '').slice(0, 7);
      const i = idx.get(k);
      if (i !== undefined) buckets[i].total += Number(e.amount);
    }
    return buckets;
  }, [expenses]);

  const totalAll = byCategory.reduce((s, d) => s + d.value, 0);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {/* Spending by Category */}
      <div className="rounded-xl border border-border bg-card p-4 sm:p-5">
        <h3 className="text-sm font-semibold text-foreground mb-4">Spending by Category</h3>
        {byCategory.length === 0 ? (
          <EmptyChart message="No expenses yet" />
        ) : (
          <div className="flex flex-col items-center gap-4">
            <ResponsiveContainer width="100%" height={210}>
              <PieChart>
                <Pie
                  data={byCategory}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={82}
                  innerRadius={48}
                  paddingAngle={2}
                  cornerRadius={5}
                >
                  {byCategory.map((d) => (
                    <Cell key={d.cat} stroke="none" fill={d.color} />
                  ))}
                </Pie>
                <Tooltip content={<CategoryTooltip total={totalAll} />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-wrap justify-center gap-x-3 gap-y-1.5">
              {byCategory.map((d) => (
                <div key={d.cat} className="flex items-center gap-1.5 text-xs">
                  <span className="size-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                  <span className="text-muted-foreground">{d.name}</span>
                  <span className="font-medium text-foreground">{formatINR(d.value)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Monthly Spending */}
      <div className="rounded-xl border border-border bg-card p-4 sm:p-5">
        <h3 className="text-sm font-semibold text-foreground mb-4">Monthly Spending</h3>
        {monthly.every((m) => m.total === 0) ? (
          <EmptyChart message="No expenses in the last 6 months" />
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={monthly} margin={{ top: 8, right: 10, left: 0, bottom: 4 }}>
              <defs>
                <linearGradient id="expBarFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#fb923c" />
                  <stop offset="100%" stopColor="#f97316" />
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
              <Tooltip content={<MonthTooltip />} cursor={{ fill: 'rgba(148,163,184,0.08)' }} />
              <Bar dataKey="total" fill="url(#expBarFill)" radius={[6, 6, 0, 0]} maxBarSize={48} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

function CategoryTooltip({ active, payload, total }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  const pct = total > 0 ? Math.round((d.value / total) * 100) : 0;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 shadow-lg">
      <p className="text-xs text-muted-foreground">{d.name}</p>
      <p className="text-sm font-semibold text-foreground">{formatINR(d.value)}</p>
      <p className="text-xs text-muted-foreground">{pct}% of total</p>
    </div>
  );
}

function MonthTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 shadow-lg">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold text-foreground">{formatINR(payload[0].value)}</p>
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
