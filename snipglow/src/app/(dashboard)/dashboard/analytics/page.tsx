import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { formatINR } from '@/lib/utils';
import { AnalyticsCharts } from './analytics-charts';
import {
  TrendingUp,
  Calendar,
  IndianRupee,
  Users,
  BarChart3,
  ShieldAlert,
} from 'lucide-react';
import type { UserRole, AnalyticsSnapshot, TopServiceEntry } from '@/types';
import type { DailyDataPoint, TopServiceDataPoint } from './analytics-charts';

// =============================================================================
// Analytics Dashboard Page — Server Component
// Owner/Manager only (deny staff)
//
// Requirements: 10.1, 10.2, 10.3, 10.4, 10.6, 10.7
// =============================================================================

export default async function AnalyticsPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect('/login');
  }

  const role = (user.user_metadata?.role as UserRole) ?? 'staff';

  // Deny access to staff (Requirement 10.7)
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

  const branchId = user.user_metadata?.branch_id as string | undefined;

  // Fetch analytics snapshots for the last 30 days for the current branch
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0];

  let query = supabase
    .from('analytics_snapshots')
    .select('*')
    .gte('snapshot_date', thirtyDaysAgoStr)
    .order('snapshot_date', { ascending: true });

  if (branchId) {
    query = query.eq('branch_id', branchId);
  }

  const { data: snapshots, error } = await query;

  if (error) {
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

  const data = (snapshots ?? []) as unknown as AnalyticsSnapshot[];

  // Compute KPI values
  const totalRevenue = data.reduce((sum, s) => sum + (s.revenue || 0), 0);
  const totalAppointments = data.reduce((sum, s) => sum + (s.appointment_count || 0), 0);
  const avgRevenuePerAppointment = totalAppointments > 0
    ? Math.round(totalRevenue / totalAppointments)
    : 0;
  // Latest retention rate (most recent snapshot)
  const latestRetentionRate = data.length > 0
    ? data[data.length - 1].retention_rate
    : 0;

  // Prepare daily chart data
  const dailyData: DailyDataPoint[] = data.map((s) => ({
    date: formatShortDate(s.snapshot_date),
    revenue: s.revenue || 0,
    appointment_count: s.appointment_count || 0,
  }));

  // Aggregate top services across the period
  const serviceAggregation: Record<string, { name: string; total_revenue: number }> = {};
  for (const snapshot of data) {
    const services = (snapshot.top_services ?? []) as TopServiceEntry[];
    for (const svc of services) {
      if (!serviceAggregation[svc.name]) {
        serviceAggregation[svc.name] = { name: svc.name, total_revenue: 0 };
      }
      serviceAggregation[svc.name].total_revenue += svc.total_revenue || 0;
    }
  }

  const topServices: TopServiceDataPoint[] = Object.values(serviceAggregation)
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
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
          icon={<Calendar className="size-5" />}
          title="Total Appointments"
          value={totalAppointments.toLocaleString('en-IN')}
          subtitle="Last 30 days"
          gradient="from-blue-500/10 to-blue-600/5"
          iconColor="text-blue-600 dark:text-blue-400"
          iconBg="bg-blue-100 dark:bg-blue-900/30"
        />
        <KPICard
          icon={<TrendingUp className="size-5" />}
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
          value={`${latestRetentionRate.toFixed(1)}%`}
          subtitle="Current rate"
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
