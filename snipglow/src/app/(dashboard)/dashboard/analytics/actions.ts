'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export type PeriodType = 'today' | 'week' | 'month' | '3months' | 'year';

export interface RevenueStats {
  totalRevenue: number;
  totalExpenses: number;
  netProfit: number;
  totalAppointments: number;
  completedAppointments: number;
  cancelledAppointments: number;
  avgRevenuePerAppointment: number;
  totalCustomers: number;
  newCustomers: number;
  totalInvoices: number;
}

export interface DailyRevenue {
  date: string;
  label: string;
  revenue: number;
  appointments: number;
  invoices: number;
}

export interface ServiceRevenue {
  name: string;
  revenue: number;
  count: number;
}

export interface PaymentBreakdown {
  method: string;
  amount: number;
  count: number;
}

export interface HourlyHeatmap {
  hour: number;
  label: string;
  count: number;
}

export interface RevenueData {
  stats: RevenueStats;
  dailyRevenue: DailyRevenue[];
  topServices: ServiceRevenue[];
  paymentBreakdown: PaymentBreakdown[];
  hourlyHeatmap: HourlyHeatmap[];
}

function getDateRange(period: PeriodType): { start: string; end: string } {
  const now = new Date();
  const todayIST = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  const endDate = todayIST.toISOString().split('T')[0];

  let startDate: string;

  switch (period) {
    case 'today':
      startDate = endDate;
      break;
    case 'week': {
      const weekAgo = new Date(todayIST);
      weekAgo.setDate(weekAgo.getDate() - 6);
      startDate = weekAgo.toISOString().split('T')[0];
      break;
    }
    case 'month': {
      const monthAgo = new Date(todayIST);
      monthAgo.setDate(monthAgo.getDate() - 29);
      startDate = monthAgo.toISOString().split('T')[0];
      break;
    }
    case '3months': {
      const threeMonthsAgo = new Date(todayIST);
      threeMonthsAgo.setDate(threeMonthsAgo.getDate() - 89);
      startDate = threeMonthsAgo.toISOString().split('T')[0];
      break;
    }
    case 'year': {
      const yearAgo = new Date(todayIST);
      yearAgo.setFullYear(yearAgo.getFullYear() - 1);
      startDate = yearAgo.toISOString().split('T')[0];
      break;
    }
    default:
      startDate = endDate;
  }

  return { start: startDate, end: endDate };
}

export async function getRevenueData(period: PeriodType): Promise<RevenueData | null> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const tenantId = user.user_metadata?.tenant_id;
  const branchId = user.user_metadata?.branch_id;
  if (!tenantId || !branchId) return null;

  const admin = createAdminClient();
  const { start, end } = getDateRange(period);

  // Convert date range to ISO timestamps for created_at comparisons
  const startISO = `${start}T00:00:00+05:30`;
  const endISO = `${end}T23:59:59+05:30`;

  // Fetch all data in parallel
  const [invoicesRes, appointmentsRes, customersRes, expensesRes, newCustomersRes] = await Promise.all([
    admin
      .from('invoices')
      .select('id, total, payment_method, payment_status, created_at')
      .eq('tenant_id', tenantId)
      .eq('branch_id', branchId)
      .gte('created_at', startISO)
      .lte('created_at', endISO)
      .eq('payment_status', 'paid'),
    admin
      .from('appointments')
      .select('id, appointment_date, start_time, status, customer_id')
      .eq('tenant_id', tenantId)
      .eq('branch_id', branchId)
      .gte('appointment_date', start)
      .lte('appointment_date', end),
    admin
      .from('customers')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('branch_id', branchId),
    admin
      .from('expenses' as any)
      .select('amount, expense_date')
      .eq('tenant_id', tenantId)
      .eq('branch_id', branchId)
      .gte('expense_date', start)
      .lte('expense_date', end),
    admin
      .from('customers')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('branch_id', branchId)
      .gte('created_at', startISO)
      .lte('created_at', endISO),
  ]);

  const invoices = (invoicesRes.data ?? []) as any[];
  const appointments = (appointmentsRes.data ?? []) as any[];
  const expenses = (expensesRes.data ?? []) as any[];

  // Fetch invoice items for service breakdown
  const invoiceIds = invoices.map((inv) => inv.id);
  let invoiceItems: any[] = [];
  if (invoiceIds.length > 0) {
    const { data: items } = await admin
      .from('invoice_items')
      .select('service_name, line_total, quantity')
      .in('invoice_id', invoiceIds);
    invoiceItems = items ?? [];
  }

  // ─── Stats ────────────────────────────────────────────────────────────────
  const totalRevenue = invoices.reduce((sum, inv) => sum + (inv.total || 0), 0);
  const totalExpenses = expenses.reduce((sum, exp) => sum + ((exp as any).amount || 0), 0);
  const completedAppointments = appointments.filter((a) => a.status === 'completed').length;
  const cancelledAppointments = appointments.filter((a) => a.status === 'cancelled').length;

  const stats: RevenueStats = {
    totalRevenue,
    totalExpenses,
    netProfit: totalRevenue - totalExpenses,
    totalAppointments: appointments.length,
    completedAppointments,
    cancelledAppointments,
    avgRevenuePerAppointment: completedAppointments > 0 ? Math.round(totalRevenue / completedAppointments) : 0,
    totalCustomers: customersRes.count ?? 0,
    newCustomers: newCustomersRes.count ?? 0,
    totalInvoices: invoices.length,
  };

  // ─── Daily Revenue ────────────────────────────────────────────────────────
  const dailyMap: Record<string, { revenue: number; appointments: number; invoices: number }> = {};

  for (const inv of invoices) {
    const dateKey = new Date(inv.created_at).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    if (!dailyMap[dateKey]) dailyMap[dateKey] = { revenue: 0, appointments: 0, invoices: 0 };
    dailyMap[dateKey].revenue += inv.total || 0;
    dailyMap[dateKey].invoices += 1;
  }

  for (const appt of appointments) {
    const dateKey = appt.appointment_date;
    if (!dailyMap[dateKey]) dailyMap[dateKey] = { revenue: 0, appointments: 0, invoices: 0 };
    dailyMap[dateKey].appointments += 1;
  }

  const dailyRevenue: DailyRevenue[] = Object.entries(dailyMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dateStr, values]) => ({
      date: dateStr,
      label: new Date(dateStr + 'T12:00:00+05:30').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
      revenue: values.revenue,
      appointments: values.appointments,
      invoices: values.invoices,
    }));

  // ─── Top Services ─────────────────────────────────────────────────────────
  const serviceMap: Record<string, { revenue: number; count: number }> = {};
  for (const item of invoiceItems) {
    const name = item.service_name || 'Unknown';
    if (!serviceMap[name]) serviceMap[name] = { revenue: 0, count: 0 };
    serviceMap[name].revenue += item.line_total || 0;
    serviceMap[name].count += item.quantity || 1;
  }

  const topServices: ServiceRevenue[] = Object.entries(serviceMap)
    .map(([name, data]) => ({ name, revenue: data.revenue, count: data.count }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);

  // ─── Payment Breakdown ────────────────────────────────────────────────────
  const paymentMap: Record<string, { amount: number; count: number }> = {};
  for (const inv of invoices) {
    const method = inv.payment_method || 'other';
    if (!paymentMap[method]) paymentMap[method] = { amount: 0, count: 0 };
    paymentMap[method].amount += inv.total || 0;
    paymentMap[method].count += 1;
  }

  const paymentBreakdown: PaymentBreakdown[] = Object.entries(paymentMap)
    .map(([method, data]) => ({ method, amount: data.amount, count: data.count }))
    .sort((a, b) => b.amount - a.amount);

  // ─── Hourly Heatmap (Peak Hours) ─────────────────────────────────────────
  const hourMap: Record<number, number> = {};
  for (const appt of appointments) {
    if (appt.start_time) {
      const hour = parseInt(appt.start_time.split(':')[0], 10);
      hourMap[hour] = (hourMap[hour] || 0) + 1;
    }
  }

  const hourlyHeatmap: HourlyHeatmap[] = [];
  for (let h = 6; h <= 21; h++) {
    const period = h >= 12 ? 'PM' : 'AM';
    const display = h % 12 || 12;
    hourlyHeatmap.push({
      hour: h,
      label: `${display} ${period}`,
      count: hourMap[h] || 0,
    });
  }

  return {
    stats,
    dailyRevenue,
    topServices,
    paymentBreakdown,
    hourlyHeatmap,
  };
}
