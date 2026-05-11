import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { AppointmentsClient } from './appointments-client';
import type { AppointmentStatus, UserRole } from '@/types';

// =============================================================================
// Appointments Page — Server Component
// Fetches appointments with joined customer, service, and employee data.
// RLS enforces tenant/branch scoping automatically.
// =============================================================================

/** Appointment row with joined relation names */
export interface AppointmentRow {
  id: string;
  appointment_date: string;
  start_time: string;
  end_time: string;
  status: AppointmentStatus;
  source: string;
  customer_name: string;
  service_name: string;
  employee_name: string;
}

export default async function AppointmentsPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect('/login');
  }

  const role = (user.user_metadata?.role as UserRole) ?? 'staff';

  // Fetch appointments with joined customer, service, and employee names
  const { data: appointments, error } = await supabase
    .from('appointments')
    .select(`
      id,
      appointment_date,
      start_time,
      end_time,
      status,
      source,
      customers(name),
      services(name),
      employees(name)
    `)
    .order('appointment_date', { ascending: false })
    .order('start_time', { ascending: true });

  if (error) {
    return (
      <div className="flex items-center justify-center rounded-lg border border-border bg-card p-12">
        <p className="text-sm text-destructive">Failed to load appointments. Please try again.</p>
      </div>
    );
  }

  // Transform joined data into flat rows
  const rows: AppointmentRow[] = (appointments ?? []).map((apt) => ({
    id: apt.id,
    appointment_date: apt.appointment_date,
    start_time: apt.start_time,
    end_time: apt.end_time,
    status: apt.status as AppointmentStatus,
    source: apt.source ?? 'dashboard',
    customer_name: (apt.customers as unknown as { name: string })?.name ?? '—',
    service_name: (apt.services as unknown as { name: string })?.name ?? '—',
    employee_name: (apt.employees as unknown as { name: string })?.name ?? '—',
  }));

  return <AppointmentsClient appointments={rows} role={role} />;
}
