import { redirect } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { createClient } from '@/lib/supabase/server';
import { formatINR } from '@/lib/utils';
import { getDailyQuote } from '@/lib/daily-quote';
import { readLoyaltyConfig, getPointsTier } from '@/lib/loyalty-points';
import {
  Calendar,
  Users,
  Scissors,
  Receipt,
  Plus,
  TrendingUp,
  Clock,
  Coins,
} from 'lucide-react';
import type { UserRole } from '@/types';
import { WelcomeTour } from './welcome-tour';

const DashboardCharts = dynamic(() => import('./dashboard-charts').then(mod => ({ default: mod.DashboardCharts })), {
  loading: () => <div className="h-[200px] flex items-center justify-center text-sm text-muted-foreground">Loading charts...</div>,
});

export default async function DashboardPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect('/login');
  }

  const userName = user.user_metadata?.name ?? user.email ?? 'there';
  const tenantId = user.user_metadata?.tenant_id;
  const role = (user.user_metadata?.role as UserRole) ?? 'staff';

  // First-run tour: owners only, shown once per salon (recorded in
  // tenants.settings.tour_seen_at) AND only to salons that onboarded after the
  // tour shipped. Existing salons predate the tour, so they have no
  // tour_seen_at recorded — without the created-at cutoff every established
  // tenant would be shown the "getting started" tour on their next login.
  const TOUR_LAUNCH_CUTOFF = Date.parse('2026-08-27T00:00:00Z');
  let showTour = false;
  let salonName = '';
  if (tenantId && role === 'owner') {
    const { data: tenantRow } = await supabase
      .from('tenants')
      .select('name, settings, created_at')
      .eq('id', tenantId)
      .maybeSingle();
    salonName = (tenantRow?.name as string) ?? '';
    const tourSeen = !!((tenantRow?.settings as Record<string, unknown> | null)?.tour_seen_at);
    const createdAtMs = tenantRow?.created_at ? Date.parse(tenantRow.created_at as string) : NaN;
    const isNewSalon = Number.isFinite(createdAtMs) && createdAtMs >= TOUR_LAUNCH_CUTOFF;
    showTour = isNewSalon && !tourSeen;
  }

  // Fetch quick stats
  let customerCount = 0;
  let appointmentCount = 0;
  let serviceCount = 0;
  let todayAppointments = 0;
  let recentCustomers: { name: string; phone: string }[] = [];

  if (tenantId) {
    const today = new Date().toISOString().split('T')[0];

    const [custRes, apptRes, svcRes, todayRes, recentRes] = await Promise.all([
      supabase.from('customers').select('id', { count: 'exact', head: true }),
      supabase.from('appointments').select('id', { count: 'exact', head: true }),
      supabase.from('services').select('id', { count: 'exact', head: true }).eq('is_active', true),
      supabase.from('appointments').select('id', { count: 'exact', head: true }).eq('appointment_date', today).in('status', ['booked', 'confirmed']),
      supabase.from('customers').select('name, phone').order('created_at', { ascending: false }).limit(5),
    ]);

    customerCount = custRes.count ?? 0;
    appointmentCount = apptRes.count ?? 0;
    serviceCount = svcRes.count ?? 0;
    todayAppointments = todayRes.count ?? 0;
    recentCustomers = (recentRes.data ?? []) as { name: string; phone: string }[];
  }

  // Fetch last 7 days appointments for charts (peak hours + daily breakdown)
  let dailyAppointments: { label: string; count: number }[] = [];
  let peakHours: { hour: number; label: string; count: number }[] = [];

  if (tenantId) {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0];

    const { data: weekAppts } = await supabase
      .from('appointments')
      .select('appointment_date, start_time')
      .gte('appointment_date', sevenDaysAgoStr)
      .order('appointment_date', { ascending: true });

    const appts = weekAppts ?? [];

    // Daily breakdown
    const dailyMap: Record<string, number> = {};
    const hourMap: Record<number, number> = {};

    for (const a of appts) {
      // Daily
      const dateLabel = new Date(a.appointment_date + 'T12:00:00+05:30').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
      dailyMap[dateLabel] = (dailyMap[dateLabel] || 0) + 1;

      // Hourly
      if (a.start_time) {
        const hour = parseInt(a.start_time.split(':')[0], 10);
        hourMap[hour] = (hourMap[hour] || 0) + 1;
      }
    }

    dailyAppointments = Object.entries(dailyMap).map(([label, count]) => ({ label, count }));

    // Build peak hours (6 AM to 9 PM)
    for (let h = 6; h <= 21; h++) {
      const period = h >= 12 ? 'PM' : 'AM';
      const display = h % 12 || 12;
      peakHours.push({ hour: h, label: `${display} ${period}`, count: hourMap[h] || 0 });
    }
  }

  // Fetch recent feedback
  let recentFeedback: { customer_name: string; rating: number; created_at: string }[] = [];
  if (tenantId) {
    const { createAdminClient } = await import('@/lib/supabase/admin');
    const admin = createAdminClient();
    const { data: feedback } = await (admin
      .from('feedback' as any)
      .select('customer_name, rating, created_at')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(5) as any);
    recentFeedback = (feedback ?? []) as { customer_name: string; rating: number; created_at: string }[];
  }

  // Loyalty points summary — owner/manager only, and only when the programme is
  // enabled. Balances are RLS-scoped to this tenant.
  let loyaltySummary: {
    outstanding: number;
    liability: number;
    members: number;
    top: { name: string; points: number; lifetime: number }[];
  } | null = null;
  if (tenantId && (role === 'owner' || role === 'manager')) {
    const { data: tRow } = await supabase.from('tenants').select('settings').eq('id', tenantId).maybeSingle();
    const cfg = readLoyaltyConfig((tRow?.settings as Record<string, unknown>) ?? {});
    if (cfg.enabled) {
      const [allRes, topRes] = await Promise.all([
        (supabase as any).from('customer_loyalty').select('points_balance').eq('tenant_id', tenantId),
        (supabase as any)
          .from('customer_loyalty')
          .select('points_balance, lifetime_points, customers(name)')
          .eq('tenant_id', tenantId)
          .gt('points_balance', 0)
          .order('points_balance', { ascending: false })
          .limit(5),
      ]);
      const balances = (((allRes as any)?.data ?? []) as { points_balance: number }[]);
      const outstanding = balances.reduce((s, r) => s + Number(r.points_balance || 0), 0);
      const members = balances.filter((r) => Number(r.points_balance) > 0).length;
      const top = ((((topRes as any)?.data ?? []) as any[])).map((r) => ({
        name: (r.customers?.name as string) ?? '—',
        points: Number(r.points_balance || 0),
        lifetime: Number(r.lifetime_points || 0),
      }));
      loyaltySummary = { outstanding, liability: Math.round(outstanding * cfg.redeemValue), members, top };
    }
  }

  // Get greeting based on time (IST — server runs in UTC on Vercel)
  const istHourStr = new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata', hour: '2-digit', hour12: false });
  const hour = parseInt(istHourStr, 10) % 24;
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  // Get daily motivational quote (changes every day)
  const dailyQuote = getDailyQuote();

  return (
    <div className="space-y-8">
      {/* First-run guided tour (new salons only) */}
      {showTour && <WelcomeTour salonName={salonName} />}

      {/* Hero Welcome Section */}
      <div className="relative overflow-hidden rounded-3xl p-5 sm:p-7 md:p-9 shadow-lg animate-card-rise" style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 25%, #f093fb 50%, #f5576c 75%, #fda085 100%)' }}>
        {/* Decorative blurred orbs */}
        <div className="pointer-events-none absolute -top-16 -right-10 size-48 rounded-full bg-white/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 left-1/3 size-56 rounded-full bg-black/10 blur-3xl" />
        <div className="absolute inset-0 bg-black/25" />
        <div className="relative z-10 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-medium text-white/80">{greeting}</p>
            <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-white mt-1 tracking-tight">
              {userName.split(' ')[0]} 👋
            </h1>
            <p className="text-white/75 mt-2 max-w-md text-sm leading-relaxed">
              Here&apos;s your salon overview. Manage appointments, customers, and grow your business.
            </p>
          </div>
          <div className="hidden md:block max-w-xs rounded-2xl bg-white/10 p-4 backdrop-blur-sm ring-1 ring-white/15">
            <p className="text-white/90 text-sm italic leading-relaxed">
              &ldquo;{dailyQuote.text}&rdquo;
            </p>
            <p className="text-white/60 text-xs mt-2">— {dailyQuote.author}</p>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard
          icon={<Clock className="size-5" />}
          title="Today"
          value={String(todayAppointments)}
          subtitle="appointments"
          href="/dashboard/appointments"
          gradient="from-blue-500/10 to-blue-600/5"
          iconColor="text-blue-600 dark:text-blue-400"
          delay="stagger-1"
        />
        <StatCard
          icon={<Users className="size-5" />}
          title="Customers"
          value={String(customerCount)}
          subtitle="total"
          href="/dashboard/customers"
          gradient="from-emerald-500/10 to-emerald-600/5"
          iconColor="text-emerald-600 dark:text-emerald-400"
          delay="stagger-2"
        />
        <StatCard
          icon={<Calendar className="size-5" />}
          title="Appointments"
          value={String(appointmentCount)}
          subtitle="all time"
          href="/dashboard/appointments"
          gradient="from-violet-500/10 to-violet-600/5"
          iconColor="text-violet-600 dark:text-violet-400"
          delay="stagger-3"
        />
        <StatCard
          icon={<Scissors className="size-5" />}
          title="Services"
          value={String(serviceCount)}
          subtitle="active"
          href="/dashboard/services"
          gradient="from-amber-500/10 to-amber-600/5"
          iconColor="text-amber-600 dark:text-amber-400"
          delay="stagger-4"
        />
      </div>

      {/* Quick Actions + Recent Activity */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Quick Actions */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-lg font-semibold text-foreground">Quick Actions</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
            <QuickActionCard
              icon={<Calendar className="size-5" />}
              title="New Appointment"
              description="Book a slot"
              href="/dashboard/appointments/new"
              color="bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400"
            />
            <QuickActionCard
              icon={<Users className="size-5" />}
              title="New Customer"
              description="Add to database"
              href="/dashboard/customers/new"
              color="bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400"
            />
            <QuickActionCard
              icon={<Receipt className="size-5" />}
              title="Create Bill"
              description="Generate invoice"
              href="/dashboard/billing/new"
              color="bg-violet-50 text-violet-600 dark:bg-violet-900/20 dark:text-violet-400"
            />
          </div>

          {/* Recent Feedback */}
          <div className="mt-2">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold text-foreground">Recent Feedback</h2>
              <Link
                href="/dashboard/feedback"
                className="text-xs font-medium text-salon-rose hover:text-salon-rose/80 transition-colors"
              >
                View all →
              </Link>
            </div>
            <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
              {recentFeedback.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-8 text-center">
                  <div className="flex size-12 items-center justify-center rounded-full bg-muted mb-3">
                    <span className="text-xl">⭐</span>
                  </div>
                  <p className="text-sm text-muted-foreground">No feedback yet</p>
                </div>
              ) : (
                <ul className="divide-y divide-border">
                  {recentFeedback.map((fb, i) => (
                    <li key={i} className="flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-amber-50 dark:bg-amber-900/20 text-sm font-bold text-amber-600">
                          {fb.rating}★
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{fb.customer_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(fb.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                          </p>
                        </div>
                      </div>
                      <span className={`text-xs font-semibold shrink-0 ml-2 ${fb.rating >= 4 ? 'text-emerald-600 dark:text-emerald-400' : fb.rating >= 3 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'}`}>
                        {fb.rating}/5
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>

        {/* Recent Customers */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">Recent Customers</h2>
            <Link
              href="/dashboard/customers"
              className="text-xs font-medium text-salon-rose hover:text-salon-rose/80 transition-colors"
            >
              View all →
            </Link>
          </div>
          <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
            {recentCustomers.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-8 text-center">
                <div className="flex size-12 items-center justify-center rounded-full bg-muted mb-3">
                  <Users className="size-5 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground">No customers yet</p>
                <Link
                  href="/dashboard/customers/new"
                  className="mt-2 text-xs font-medium text-salon-rose hover:text-salon-rose/80"
                >
                  Add your first customer →
                </Link>
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {recentCustomers.map((customer, i) => (
                  <li key={i} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors">
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-salon-rose/20 to-salon-gold/20 text-xs font-semibold text-salon-rose">
                      {customer.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground truncate">{customer.name}</p>
                      <p className="text-xs text-muted-foreground">{customer.phone}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* Loyalty Points summary (owner/manager, when enabled) */}
      {loyaltySummary && <LoyaltyDashboardCard summary={loyaltySummary} />}

      {/* Peak Hours & Appointments by Day */}
      <DashboardCharts dailyAppointments={dailyAppointments} peakHours={peakHours} />
    </div>
  );
}

// =============================================================================
// Loyalty Points summary card (dashboard)
// =============================================================================

function LoyaltyDashboardCard({
  summary,
}: {
  summary: { outstanding: number; liability: number; members: number; top: { name: string; points: number; lifetime: number }[] };
}) {
  return (
    <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 sm:px-6 py-4 bg-gradient-to-r from-fuchsia-50 via-pink-50/60 to-transparent dark:from-fuchsia-950/20 dark:via-pink-950/10">
        <div className="flex items-center gap-2">
          <Coins className="size-4 text-fuchsia-600 dark:text-fuchsia-400" />
          <h2 className="text-sm font-semibold text-foreground">Loyalty Points</h2>
        </div>
        <Link href="/dashboard/settings" className="shrink-0 text-xs font-medium text-fuchsia-700 dark:text-fuchsia-400 hover:underline">
          Configure
        </Link>
      </div>
      <div className="p-4 sm:p-6 space-y-5">
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          <div className="rounded-xl border border-border bg-muted/30 p-3">
            <p className="text-lg sm:text-2xl font-bold text-foreground leading-tight">{summary.outstanding.toLocaleString('en-IN')}</p>
            <p className="mt-0.5 text-[11px] sm:text-xs text-muted-foreground">points outstanding</p>
          </div>
          <div className="rounded-xl border border-border bg-muted/30 p-3">
            <p className="text-lg sm:text-2xl font-bold text-foreground leading-tight">{formatINR(summary.liability)}</p>
            <p className="mt-0.5 text-[11px] sm:text-xs text-muted-foreground">est. liability</p>
          </div>
          <div className="rounded-xl border border-border bg-muted/30 p-3">
            <p className="text-lg sm:text-2xl font-bold text-foreground leading-tight">{summary.members.toLocaleString('en-IN')}</p>
            <p className="mt-0.5 text-[11px] sm:text-xs text-muted-foreground">members</p>
          </div>
        </div>

        {summary.top.length > 0 ? (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Top members</p>
            <ul className="space-y-1">
              {summary.top.map((c, i) => {
                const tier = getPointsTier(c.lifetime);
                return (
                  <li key={i} className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 hover:bg-muted/50 transition-colors">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="shrink-0 text-base" aria-hidden>{tier.emoji}</span>
                      <span className="truncate text-sm font-medium text-foreground">{c.name}</span>
                      <span className="hidden shrink-0 text-[11px] text-muted-foreground sm:inline">{tier.label}</span>
                    </div>
                    <span className="shrink-0 text-sm font-semibold text-foreground">{c.points.toLocaleString('en-IN')} pts</span>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No points issued yet — they start accruing as customers pay their bills.</p>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// Stat Card
// =============================================================================

function StatCard({
  icon,
  title,
  value,
  subtitle,
  href,
  gradient,
  iconColor,
  delay,
}: {
  icon: React.ReactNode;
  title: string;
  value: string;
  subtitle: string;
  href: string;
  gradient: string;
  iconColor: string;
  delay?: string;
}) {
  return (
    <Link
      href={href}
      className={`group card-lift animate-card-rise ${delay ?? ''} relative overflow-hidden rounded-2xl border border-border bg-card p-4 shadow-sm hover:shadow-lg hover:border-primary/30`}
    >
      <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-60 transition-opacity group-hover:opacity-100`} />
      <div className="relative">
        <div className={`flex size-10 items-center justify-center rounded-xl bg-background/80 shadow-sm ring-1 ring-border/50 ${iconColor}`}>
          {icon}
        </div>
        <p className="text-2xl sm:text-3xl font-bold text-foreground mt-3 tracking-tight">{value}</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          <span className="font-medium text-foreground/80">{title}</span> · {subtitle}
        </p>
      </div>
    </Link>
  );
}

// =============================================================================
// Quick Action Card
// =============================================================================

function QuickActionCard({
  icon,
  title,
  description,
  href,
  color,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  href: string;
  color: string;
}) {
  return (
    <Link
      href={href}
      className="group card-lift flex items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm hover:shadow-lg hover:border-primary/30"
    >
      <div className={`flex size-11 shrink-0 items-center justify-center rounded-xl transition-transform duration-200 group-hover:scale-105 ${color}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-foreground group-hover:text-salon-rose transition-colors">
          {title}
        </p>
        <p className="text-xs text-muted-foreground truncate">{description}</p>
      </div>
      <span className="ml-auto text-muted-foreground/40 transition-all duration-200 group-hover:translate-x-0.5 group-hover:text-salon-rose">→</span>
    </Link>
  );
}
