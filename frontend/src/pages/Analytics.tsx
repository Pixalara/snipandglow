// PingFlow — Analytics Page (Pro Only)
// Revenue vs Expenses, Net Profit, Category Breakdown, Monthly Trends

import { useState, useEffect, useMemo } from 'react';
import { useAuthStore } from '@/store/authStore';
import { useResponsive } from '@/hooks/useResponsive';
import PlanGuard from '@/components/ui/PlanGuard';
import { subscribePayments } from '@/services/billing.service';
import { subscribeExpenses } from '@/services/expense.service';
import type { Payment, ExpenseEntry, ExpenseCategory } from '@/types';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const categoryColors: Record<ExpenseCategory, string> = {
  Rent: '#EA580C',
  Salary: '#059669',
  Utilities: '#2563EB',
  Equipment: '#7C3AED',
  'Repair & Maintenance': '#D97706',
  Other: '#64748B',
};

interface MonthlyData {
  month: string;
  revenue: number;
  expenses: number;
  profit: number;
}

function toDate(ts: any): Date {
  return ts?.toDate ? ts.toDate() : new Date(ts);
}

function getMonthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function AnalyticsContent() {
  const { user } = useAuthStore();
  const { isMobile } = useResponsive();
  const gymId = user?.uid;

  const [payments, setPayments] = useState<Payment[]>([]);
  const [expenses, setExpenses] = useState<ExpenseEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [, setLoadedCount] = useState(0);

  useEffect(() => {
    if (!gymId) return;
    setIsLoading(true);
    setLoadedCount(0);
    const unsub1 = subscribePayments(gymId, (data) => {
      setPayments(data);
      setLoadedCount(c => { const n = c + 1; if (n >= 2) setIsLoading(false); return n; });
    }, () => setLoadedCount(c => { const n = c + 1; if (n >= 2) setIsLoading(false); return n; }));
    const unsub2 = subscribeExpenses(gymId, (data) => {
      setExpenses(data);
      setLoadedCount(c => { const n = c + 1; if (n >= 2) setIsLoading(false); return n; });
    }, () => setLoadedCount(c => { const n = c + 1; if (n >= 2) setIsLoading(false); return n; }));
    return () => { unsub1(); unsub2(); };
  }, [gymId]);

  // Build last 6 months of data
  const monthlyData: MonthlyData[] = useMemo(() => {
    const now = new Date();
    const months: MonthlyData[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = getMonthKey(d);
      const label = `${MONTHS[d.getMonth()]} ${d.getFullYear() !== now.getFullYear() ? d.getFullYear() : ''}`.trim();

      const monthRevenue = payments
        .filter(p => { const pd = toDate(p.createdAt); return getMonthKey(pd) === key; })
        .reduce((sum, p) => sum + (p.paidAmount || 0), 0);

      const monthExpenses = expenses
        .filter(e => { const ed = toDate(e.date); return getMonthKey(ed) === key; })
        .reduce((sum, e) => sum + (e.amount || 0), 0);

      months.push({ month: label, revenue: monthRevenue, expenses: monthExpenses, profit: monthRevenue - monthExpenses });
    }
    return months;
  }, [payments, expenses]);

  // Current month totals
  const currentMonth = useMemo(() => {
    const now = new Date();
    const key = getMonthKey(now);
    const revenue = payments
      .filter(p => getMonthKey(toDate(p.createdAt)) === key)
      .reduce((sum, p) => sum + (p.paidAmount || 0), 0);
    const exp = expenses
      .filter(e => getMonthKey(toDate(e.date)) === key)
      .reduce((sum, e) => sum + (e.amount || 0), 0);
    return { revenue, expenses: exp, profit: revenue - exp };
  }, [payments, expenses]);

  // Category breakdown for current month
  const categoryBreakdown = useMemo(() => {
    const now = new Date();
    const key = getMonthKey(now);
    const filtered = expenses.filter(e => getMonthKey(toDate(e.date)) === key);
    const totals: Record<string, number> = {};
    filtered.forEach(e => { totals[e.category] = (totals[e.category] || 0) + e.amount; });
    const total = Object.values(totals).reduce((s, v) => s + v, 0);
    return Object.entries(totals)
      .sort((a, b) => b[1] - a[1])
      .map(([cat, amount]) => ({ category: cat as ExpenseCategory, amount, pct: total > 0 ? (amount / total) * 100 : 0 }));
  }, [expenses]);

  // Chart scaling
  const maxBarValue = useMemo(() => {
    const allValues = monthlyData.flatMap(m => [m.revenue, m.expenses]);
    return Math.max(...allValues, 1);
  }, [monthlyData]);

  const fmt = (n: number) => '₹' + n.toLocaleString('en-IN');

  if (isLoading) {
    return (
      <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
        <h1 style={{ fontFamily: "'Outfit', sans-serif", fontSize: isMobile ? '22px' : '28px', fontWeight: '800', color: '#0F172A', margin: '0 0 28px' }}>Analytics</h1>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap: '16px', marginBottom: '28px' }}>
          {[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: '100px', borderRadius: '16px' }} />)}
        </div>
        <div className="skeleton" style={{ height: '300px', borderRadius: '16px', marginBottom: '28px' }} />
        <div className="skeleton" style={{ height: '200px', borderRadius: '16px' }} />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ fontFamily: "'Outfit', sans-serif", fontSize: isMobile ? '22px' : '28px', fontWeight: '800', color: '#0F172A', margin: '0 0 4px', letterSpacing: '-0.02em' }}>Analytics</h1>
        <p style={{ fontSize: '13px', color: '#64748B', margin: 0, fontWeight: '500' }}>Revenue, expenses, and profit overview</p>
      </div>

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap: '16px', marginBottom: '28px' }}>
        {/* Revenue */}
        <div style={{ background: 'linear-gradient(135deg, #ECFDF5, #FFFFFF)', border: '1px solid #D1FAE5', borderRadius: '16px', padding: '20px 24px' }}>
          <p style={{ fontSize: '11px', fontWeight: '800', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 6px' }}>Revenue (This Month)</p>
          <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: '28px', fontWeight: '800', color: '#059669', margin: 0 }}>{fmt(currentMonth.revenue)}</p>
        </div>
        {/* Expenses */}
        <div style={{ background: 'linear-gradient(135deg, #FFF1F2, #FFFFFF)', border: '1px solid #FECDD3', borderRadius: '16px', padding: '20px 24px' }}>
          <p style={{ fontSize: '11px', fontWeight: '800', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 6px' }}>Expenses (This Month)</p>
          <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: '28px', fontWeight: '800', color: '#E11D48', margin: 0 }}>{fmt(currentMonth.expenses)}</p>
        </div>
        {/* Net Profit */}
        <div style={{ background: currentMonth.profit >= 0 ? 'linear-gradient(135deg, #EFF6FF, #FFFFFF)' : 'linear-gradient(135deg, #FEF2F2, #FFFFFF)', border: `1px solid ${currentMonth.profit >= 0 ? '#BFDBFE' : '#FECDD3'}`, borderRadius: '16px', padding: '20px 24px' }}>
          <p style={{ fontSize: '11px', fontWeight: '800', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 6px' }}>Net Profit (This Month)</p>
          <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: '28px', fontWeight: '800', color: currentMonth.profit >= 0 ? '#2563EB' : '#DC2626', margin: 0 }}>{fmt(currentMonth.profit)}</p>
        </div>
      </div>

      {/* Revenue vs Expenses Bar Chart */}
      <div style={{ backgroundColor: '#FFF', border: '1px solid #E2E8F0', borderRadius: '16px', padding: '24px', marginBottom: '28px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
          <div>
            <h2 style={{ fontFamily: "'Outfit', sans-serif", fontSize: '18px', fontWeight: '800', color: '#0F172A', margin: '0 0 2px' }}>Revenue vs Expenses</h2>
            <p style={{ fontSize: '12px', color: '#94A3B8', margin: 0 }}>Last 6 months</p>
          </div>
          <div style={{ display: 'flex', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ width: '10px', height: '10px', borderRadius: '3px', backgroundColor: '#10B981' }} />
              <span style={{ fontSize: '11px', fontWeight: '700', color: '#64748B' }}>Revenue</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ width: '10px', height: '10px', borderRadius: '3px', backgroundColor: '#E11D48' }} />
              <span style={{ fontSize: '11px', fontWeight: '700', color: '#64748B' }}>Expenses</span>
            </div>
          </div>
        </div>

        {/* Bar chart */}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: isMobile ? '4px' : '16px', height: '200px', paddingBottom: '30px', position: 'relative' }}>
          {/* Y-axis grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map(pct => (
            <div key={pct} style={{
              position: 'absolute', left: 0, right: 0,
              bottom: `${30 + pct * 170}px`,
              borderBottom: '1px dashed #F1F5F9',
            }} />
          ))}

          {monthlyData.map((m, i) => {
            const revH = maxBarValue > 0 ? (m.revenue / maxBarValue) * 170 : 0;
            const expH = maxBarValue > 0 ? (m.expenses / maxBarValue) * 170 : 0;
            return (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', position: 'relative', zIndex: 1 }}>
                <div style={{ display: 'flex', gap: isMobile ? '2px' : '3px', alignItems: 'flex-end', height: '170px' }}>
                  <div style={{
                    width: isMobile ? '10px' : '24px',
                    height: `${Math.max(revH, 2)}px`,
                    backgroundColor: '#10B981',
                    borderRadius: '4px 4px 0 0',
                    transition: 'height 500ms cubic-bezier(0.16, 1, 0.3, 1)',
                    position: 'relative',
                  }} title={`Revenue: ${fmt(m.revenue)}`} />
                  <div style={{
                    width: isMobile ? '10px' : '24px',
                    height: `${Math.max(expH, 2)}px`,
                    backgroundColor: '#E11D48',
                    borderRadius: '4px 4px 0 0',
                    transition: 'height 500ms cubic-bezier(0.16, 1, 0.3, 1)',
                  }} title={`Expenses: ${fmt(m.expenses)}`} />
                </div>
                <span style={{ fontSize: '10px', fontWeight: '700', color: '#94A3B8', whiteSpace: 'nowrap' }}>{m.month}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom row: Category Breakdown + Profit Trend */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '16px' }}>

        {/* Category Breakdown */}
        <div style={{ backgroundColor: '#FFF', border: '1px solid #E2E8F0', borderRadius: '16px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <h2 style={{ fontFamily: "'Outfit', sans-serif", fontSize: '16px', fontWeight: '800', color: '#0F172A', margin: '0 0 4px' }}>Expense Breakdown</h2>
          <p style={{ fontSize: '12px', color: '#94A3B8', margin: '0 0 20px' }}>This month by category</p>

          {categoryBreakdown.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '30px 0' }}>
              <div style={{ fontSize: '32px', marginBottom: '8px' }}>📊</div>
              <p style={{ fontSize: '13px', color: '#94A3B8', margin: 0 }}>No expenses this month</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {categoryBreakdown.map(item => (
                <div key={item.category}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ fontSize: '13px', fontWeight: '700', color: '#334155' }}>{item.category}</span>
                    <span style={{ fontSize: '13px', fontWeight: '800', color: '#0F172A', fontFamily: "'JetBrains Mono', monospace" }}>{fmt(item.amount)}</span>
                  </div>
                  <div style={{ height: '8px', backgroundColor: '#F1F5F9', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%',
                      width: `${item.pct}%`,
                      backgroundColor: categoryColors[item.category] || '#64748B',
                      borderRadius: '4px',
                      transition: 'width 500ms cubic-bezier(0.16, 1, 0.3, 1)',
                    }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Monthly Profit Trend */}
        <div style={{ backgroundColor: '#FFF', border: '1px solid #E2E8F0', borderRadius: '16px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <h2 style={{ fontFamily: "'Outfit', sans-serif", fontSize: '16px', fontWeight: '800', color: '#0F172A', margin: '0 0 4px' }}>Profit Trend</h2>
          <p style={{ fontSize: '12px', color: '#94A3B8', margin: '0 0 20px' }}>Net profit over last 6 months</p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {monthlyData.map((m, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '11px', fontWeight: '700', color: '#94A3B8', width: '36px', flexShrink: 0 }}>{m.month.split(' ')[0]}</span>
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{
                    height: '24px',
                    width: `${Math.max(Math.abs(m.profit) / (Math.max(...monthlyData.map(d => Math.abs(d.profit)), 1)) * 100, 4)}%`,
                    backgroundColor: m.profit >= 0 ? '#10B981' : '#EF4444',
                    borderRadius: '6px',
                    transition: 'width 500ms cubic-bezier(0.16, 1, 0.3, 1)',
                    minWidth: '4px',
                  }} />
                  <span style={{ fontSize: '12px', fontWeight: '800', color: m.profit >= 0 ? '#059669' : '#DC2626', whiteSpace: 'nowrap', fontFamily: "'JetBrains Mono', monospace" }}>
                    {m.profit >= 0 ? '+' : ''}{fmt(m.profit)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  return (
    <PlanGuard feature="analytics">
      <AnalyticsContent />
    </PlanGuard>
  );
}
