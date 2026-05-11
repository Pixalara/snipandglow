import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { formatINR } from '@/lib/utils';
import { AnalyticsCharts } from './analytics-charts';
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
      <div className="space-y-4">
        <h1 className="text-xl font-semibold text-foreground">Analytics</h1>
        <div className="flex items-center justify-center rounded-lg border border-border bg-card p-12">
          <p className="text-sm text-muted-foreground">
            Access denied. Analytics is available for owners and managers only.
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
      <div className="space-y-4">
        <h1 className="text-xl font-semibold text-foreground">Analytics</h1>
        <div className="flex items-center justify-center rounded-lg border border-border bg-card p-12">
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
      {/* Header */}
      <h1 className="text-xl font-semibold text-foreground">Analytics</h1>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPICard
          title="Total Revenue"
          value={formatINR(totalRevenue)}
          subtitle="Last 30 days"
        />
        <KPICard
          title="Total Appointments"
          value={totalAppointments.toLocaleString('en-IN')}
          subtitle="Last 30 days"
        />
        <KPICard
          title="Avg Revenue / Appointment"
          value={formatINR(avgRevenuePerAppointment)}
          subtitle="Last 30 days"
        />
        <KPICard
          title="Customer Retention"
          value={`${latestRetentionRate.toFixed(1)}%`}
          subtitle="Current rate"
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

function KPICard({ title, value, subtitle }: { title: string; value: string; subtitle: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-xs font-medium text-muted-foreground">{title}</p>
      <p className="mt-1 text-2xl font-bold text-foreground">{value}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
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
