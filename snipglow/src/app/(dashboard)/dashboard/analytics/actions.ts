'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export type PeriodType =
  | 'today'
  | 'week'
  | 'this_month'
  | 'mtd'
  | 'ytd'
  | 'custom'
  // Legacy values kept for backward-compatible URLs
  | 'month'
  | '3months'
  | 'year';

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
  // Product (retail) metrics — separate from service totals.
  productSales: number;
  productCost: number;
  productMargin: number;
  productUnitsSold: number;
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
  range: { start: string; end: string };
}

// Validate a YYYY-MM-DD string.
function isValidDateStr(s: string | undefined): s is string {
  return !!s && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(new Date(s + 'T00:00:00').getTime());
}

function getDateRange(
  period: PeriodType,
  customStart?: string,
  customEnd?: string,
): { start: string; end: string } {
  const now = new Date();
  // Reliable IST calendar date (YYYY-MM-DD) without UTC drift.
  const todayStr = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  const [year, month] = todayStr.split('-').map(Number);
  const endDate = todayStr;

  // Helper to subtract days from the IST "now" and return YYYY-MM-DD.
  const todayIST = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  const minusDays = (n: number): string => {
    const d = new Date(todayIST);
    d.setDate(d.getDate() - n);
    return d.toLocaleDateString('en-CA');
  };

  let startDate: string;

  switch (period) {
    case 'today':
      startDate = endDate;
      break;
    case 'week':
      startDate = minusDays(6);
      break;
    case 'this_month':
    case 'mtd':
      // 1st of the current calendar month → today (month-till-date).
      startDate = `${year}-${String(month).padStart(2, '0')}-01`;
      break;
    case 'ytd': {
      // Indian financial year: 1 April → today. Jan–Mar belong to the prior FY.
      const fyStartYear = month >= 4 ? year : year - 1;
      startDate = `${fyStartYear}-04-01`;
      break;
    }
    case 'custom': {
      const s = isValidDateStr(customStart) ? customStart : endDate;
      const e = isValidDateStr(customEnd) ? customEnd : endDate;
      // Guard against reversed ranges.
      return s <= e ? { start: s, end: e } : { start: e, end: s };
    }
    // ─── Legacy windows (backward-compatible URLs) ──────────────────────────
    case 'month':
      startDate = minusDays(29);
      break;
    case '3months':
      startDate = minusDays(89);
      break;
    case 'year': {
      const yearAgo = new Date(todayIST);
      yearAgo.setFullYear(yearAgo.getFullYear() - 1);
      startDate = yearAgo.toLocaleDateString('en-CA');
      break;
    }
    default:
      startDate = endDate;
  }

  return { start: startDate, end: endDate };
}

export async function getRevenueData(
  period: PeriodType,
  customStart?: string,
  customEnd?: string,
): Promise<RevenueData | null> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const tenantId = user.user_metadata?.tenant_id;
  const branchId = user.user_metadata?.branch_id;
  if (!tenantId || !branchId) return null;

  const admin = createAdminClient();
  const { start, end } = getDateRange(period, customStart, customEnd);

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
    const { data: items } = await (admin as any)
      .from('invoice_items')
      .select('service_name, line_total, quantity, item_type, product_id')
      .in('invoice_id', invoiceIds);
    invoiceItems = items ?? [];
  }

  // ─── Product (retail) metrics ───────────────────────────────────────────────
  // Product line items carry item_type='product' + product_id. Sales = sum of
  // their line totals; Cost = purchase_price × qty (looked up from products);
  // Margin = Sales − Cost. Kept separate from the service-inclusive totals.
  const productItems = invoiceItems.filter((it) => it.item_type === 'product' && it.product_id);
  const productSales = productItems.reduce((s, it) => s + (it.line_total || 0), 0);
  const productUnitsSold = productItems.reduce((s, it) => s + (it.quantity || 0), 0);
  let productCost = 0;
  if (productItems.length > 0) {
    const productIds = Array.from(new Set(productItems.map((it) => it.product_id)));
    const { data: prods } = await (admin as any)
      .from('products')
      .select('id, purchase_price')
      .in('id', productIds);
    const priceMap = new Map<string, number>(
      (prods ?? []).map((p: any) => [p.id as string, Number(p.purchase_price) || 0])
    );
    for (const it of productItems) {
      productCost += (priceMap.get(it.product_id) ?? 0) * (it.quantity || 0);
    }
  }
  const productMargin = productSales - productCost;

  // ─── Stats ────────────────────────────────────────────────────────────────
  const totalRevenue = invoices.reduce((sum, inv) => sum + (inv.total || 0), 0);
  const totalExpenses = expenses.reduce((sum, exp) => sum + ((exp as any).amount || 0), 0);
  const completedAppointments = appointments.filter((a) => a.status === 'completed').length;
  const cancelledAppointments = appointments.filter((a) => a.status === 'cancelled').length;

  const stats: RevenueStats = {
    totalRevenue,
    totalExpenses,
    // Net profit = revenue − running expenses − cost of products sold (COGS).
    // Product revenue is already inside totalRevenue (invoice totals), but the
    // buying cost of those products lives only here, so subtract it once.
    netProfit: totalRevenue - totalExpenses - productCost,
    totalAppointments: appointments.length,
    completedAppointments,
    cancelledAppointments,
    avgRevenuePerAppointment: completedAppointments > 0 ? Math.round(totalRevenue / completedAppointments) : 0,
    totalCustomers: customersRes.count ?? 0,
    newCustomers: newCustomersRes.count ?? 0,
    totalInvoices: invoices.length,
    productSales,
    productCost,
    productMargin,
    productUnitsSold,
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
    range: { start, end },
  };
}
