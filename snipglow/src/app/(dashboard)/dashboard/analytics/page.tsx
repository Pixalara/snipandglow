import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { BarChart3, ShieldAlert } from 'lucide-react';
import type { UserRole } from '@/types';
import { getRevenueData } from './actions';
import { RevenueDashboardClient } from './revenue-dashboard';
import type { PeriodType } from './actions';

// =============================================================================
// Revenue Dashboard & Reports — Server Component
// Owner/Manager only (deny staff)
// =============================================================================

interface AnalyticsPageProps {
  searchParams: Promise<{ period?: string; start?: string; end?: string }>;
}

export default async function AnalyticsPage({ searchParams }: AnalyticsPageProps) {
  const params = await searchParams;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const role = (user.user_metadata?.role as UserRole) ?? 'staff';

  if (role === 'staff') {
    return (
      <div className="space-y-6">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-red-500/10 via-red-500/5 to-transparent border border-red-200/50 dark:border-red-800/30 p-6">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-xl bg-red-100 dark:bg-red-900/30">
              <ShieldAlert className="size-5 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">Revenue Dashboard</h1>
              <p className="text-sm text-muted-foreground">Access restricted</p>
            </div>
          </div>
        </div>
        <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-card p-12 text-center">
          <ShieldAlert className="size-6 text-red-500 mb-4" />
          <h3 className="text-base font-semibold text-foreground">Access Denied</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm">
            Revenue reports are available for owners and managers only.
          </p>
        </div>
      </div>
    );
  }

  const period = (params.period as PeriodType) || 'month';
  const data = await getRevenueData(period, params.start, params.end);

  if (!data) {
    return (
      <div className="space-y-6">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent border border-amber-200/50 dark:border-amber-800/30 p-6">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-900/30">
              <BarChart3 className="size-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">Revenue Dashboard</h1>
              <p className="text-sm text-destructive">Failed to load data</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return <RevenueDashboardClient data={data} currentPeriod={period} />;
}
