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
      customer_id,
      service_id,
      employee_id
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

  // Fetch related names separately to avoid join issues
  const appts = appointments ?? [];
  const custIds = [...new Set(appts.map((a) => a.customer_id).filter(Boolean))];
  const svcIds = [...new Set(appts.map((a) => a.service_id).filter(Boolean))];
  const empIds = [...new Set(appts.map((a) => a.employee_id).filter(Boolean))];

  const [custRes, svcRes, empRes] = await Promise.all([
    custIds.length > 0 ? supabase.from('customers').select('id, name').in('id', custIds) : { data: [] },
    svcIds.length > 0 ? supabase.from('services').select('id, name').in('id', svcIds) : { data: [] },
    empIds.length > 0 ? supabase.from('employees').select('id, name').in('id', empIds) : { data: [] },
  ]);

  const custMap: Record<string, string> = {};
  const svcMap: Record<string, string> = {};
  const empMap: Record<string, string> = {};
  for (const c of custRes.data ?? []) custMap[c.id] = c.name;
  for (const s of svcRes.data ?? []) svcMap[s.id] = s.name;
  for (const e of empRes.data ?? []) empMap[e.id] = e.name;

  // Transform joined data into flat rows
  const rows: AppointmentRow[] = appts.map((apt) => ({
    id: apt.id,
    appointment_date: apt.appointment_date,
    start_time: apt.start_time,
    end_time: apt.end_time,
    status: apt.status as AppointmentStatus,
    source: apt.source ?? 'dashboard',
    customer_name: custMap[apt.customer_id ?? ''] ?? '—',
    service_name: svcMap[apt.service_id ?? ''] ?? '—',
    employee_name: empMap[apt.employee_id ?? ''] ?? '—',
  }));

  return <AppointmentsClient appointments={rows} role={role} />;
}
