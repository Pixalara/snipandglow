import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { formatINR } from '@/lib/utils';
import type { UserRole } from '@/types';

export default async function DashboardPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect('/login');
  }

  const userName = user.user_metadata?.name ?? user.email ?? 'there';
  const tenantId = user.user_metadata?.tenant_id;
  const branchId = user.user_metadata?.branch_id;

  // Fetch quick stats
  let customerCount = 0;
  let appointmentCount = 0;
  let serviceCount = 0;
  let todayAppointments = 0;

  if (tenantId) {
    const today = new Date().toISOString().split('T')[0];

    const [custRes, apptRes, svcRes, todayRes] = await Promise.all([
      supabase.from('customers').select('id', { count: 'exact', head: true }),
      supabase.from('appointments').select('id', { count: 'exact', head: true }),
      supabase.from('services').select('id', { count: 'exact', head: true }).eq('is_active', true),
      supabase.from('appointments').select('id', { count: 'exact', head: true }).eq('appointment_date', today).in('status', ['booked', 'confirmed']),
    ]);

    customerCount = custRes.count ?? 0;
    appointmentCount = apptRes.count ?? 0;
    serviceCount = svcRes.count ?? 0;
    todayAppointments = todayRes.count ?? 0;
  }

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          Welcome back, {userName.split(' ')[0]}!
        </h1>
        <p className="text-muted-foreground mt-1">
          Here&apos;s what&apos;s happening at your salon today.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Today's Appointments"
          value={String(todayAppointments)}
          href="/dashboard/appointments"
        />
        <StatCard
          title="Total Customers"
          value={String(customerCount)}
          href="/dashboard/customers"
        />
        <StatCard
          title="Total Appointments"
          value={String(appointmentCount)}
          href="/dashboard/appointments"
        />
        <StatCard
          title="Active Services"
          value={String(serviceCount)}
          href="/dashboard/services"
        />
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-3">Quick Actions</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <QuickAction
            title="New Appointment"
            description="Book a new appointment"
            href="/dashboard/appointments/new"
          />
          <QuickAction
            title="New Customer"
            description="Add a new customer"
            href="/dashboard/customers/new"
          />
          <QuickAction
            title="Create Bill"
            description="Generate a new invoice"
            href="/dashboard/billing/new"
          />
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, href }: { title: string; value: string; href: string }) {
  return (
    <Link
      href={href}
      className="rounded-lg border border-border bg-card p-4 transition-colors hover:bg-muted/50"
    >
      <p className="text-sm text-muted-foreground">{title}</p>
      <p className="text-2xl font-bold text-foreground mt-1">{value}</p>
    </Link>
  );
}

function QuickAction({ title, description, href }: { title: string; description: string; href: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-lg border border-border bg-card p-4 transition-colors hover:bg-muted/50"
    >
      <div>
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </Link>
  );
}
