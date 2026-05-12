'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import type {
  ActionResult,
  Appointment,
  AppointmentStatus,
  CreateAppointmentInput,
  Service,
  Employee,
  TimeSlot,
} from '@/types';

// =============================================================================
// Appointment Status Machine
// =============================================================================

const VALID_TRANSITIONS: Record<AppointmentStatus, AppointmentStatus[]> = {
  booked: ['confirmed', 'cancelled'],
  confirmed: ['completed', 'cancelled'],
  completed: [], // terminal state
  cancelled: [], // terminal state
};

// =============================================================================
// Appointment Server Actions
// =============================================================================

/**
 * Create a new appointment.
 * Validates required fields, sets tenant/branch from user metadata,
 * and inserts with status 'booked'.
 */
export async function createAppointment(
  input: CreateAppointmentInput
): Promise<ActionResult<Appointment>> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not authenticated' };

  const tenantId = user.user_metadata?.tenant_id;
  const branchId = user.user_metadata?.branch_id;
  if (!tenantId || !branchId) {
    return { success: false, error: 'No tenant or branch context found.' };
  }

  // Validate required fields
  if (!input.customer_id || !input.service_id || !input.employee_id) {
    return { success: false, error: 'Customer, service, and employee are required.' };
  }
  if (!input.appointment_date || !input.start_time || !input.end_time) {
    return { success: false, error: 'Date and time slot are required.' };
  }

  const { data, error } = await supabase
    .from('appointments')
    .insert({
      tenant_id: tenantId,
      branch_id: branchId,
      customer_id: input.customer_id,
      service_id: input.service_id,
      employee_id: input.employee_id,
      appointment_date: input.appointment_date,
      start_time: input.start_time,
      end_time: input.end_time,
      status: 'booked',
      source: input.source ?? 'dashboard',
      whatsapp_flow_ref: input.whatsapp_flow_ref ?? null,
    })
    .select()
    .single();

  if (error) {
    // Handle overlap constraint violation
    if (error.code === '23P01') {
      return {
        success: false,
        error: 'This time slot overlaps with an existing appointment for the selected stylist.',
      };
    }
    return { success: false, error: 'Failed to create appointment. Please try again.' };
  }

  revalidatePath('/dashboard/appointments');
  return { success: true, data: data as Appointment };
}

/**
 * Update appointment status with valid state machine transitions.
 * Valid transitions:
 * - booked → confirmed
 * - booked → cancelled
 * - confirmed → completed
 * - confirmed → cancelled
 *
 * Any other transition is rejected.
 */
export async function updateAppointmentStatus(
  id: string,
  newStatus: AppointmentStatus
): Promise<ActionResult<void>> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not authenticated' };

  // 1. Fetch current appointment status
  const { data: appointment, error: fetchError } = await supabase
    .from('appointments')
    .select('id, status')
    .eq('id', id)
    .single();

  if (fetchError || !appointment) {
    return { success: false, error: 'Appointment not found.' };
  }

  const currentStatus = appointment.status as AppointmentStatus;

  // 2. Validate the transition is allowed
  const allowedTransitions = VALID_TRANSITIONS[currentStatus];
  if (!allowedTransitions || !allowedTransitions.includes(newStatus)) {
    return {
      success: false,
      error: `Cannot transition from "${currentStatus}" to "${newStatus}".`,
    };
  }

  // 3. Update the status (and set completed_at if completed)
  const updatePayload: { status: typeof newStatus; completed_at?: string } = { status: newStatus };
  if (newStatus === 'completed') {
    updatePayload.completed_at = new Date().toISOString();
  }

  const { error: updateError } = await supabase
    .from('appointments')
    .update(updatePayload as any)
    .eq('id', id);

  if (updateError) {
    return { success: false, error: 'Failed to update appointment status. Please try again.' };
  }

  // 5. Revalidate /appointments path
  revalidatePath('/dashboard/appointments');
  return { success: true, data: undefined };
}

/**
 * Get available time slots for a given employee on a specific date.
 * Generates slots based on branch operating hours and excludes booked appointments.
 */
export async function getAvailableSlots(
  employeeId: string,
  date: string,
  serviceDuration: number
): Promise<TimeSlot[]> {
  const supabase = await createClient();

  // 1. Get employee's branch
  const { data: employee } = await supabase
    .from('employees')
    .select('branch_id')
    .eq('id', employeeId)
    .single();

  if (!employee) return [];

  // 2. Get branch operating hours
  const { data: branch } = await supabase
    .from('branches')
    .select('operating_hours')
    .eq('id', employee.branch_id)
    .single();

  if (!branch || !branch.operating_hours) return [];

  // 3. Determine the day name from the date
  const dateObj = new Date(date + 'T00:00:00');
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const dayName = dayNames[dateObj.getDay()];

  // Try multiple key formats (full name, 3-letter abbreviation)
  const hours = branch.operating_hours as Record<string, { open?: string; close?: string } | undefined>;
  const dayHours = hours[dayName] ?? hours[dayName.slice(0, 3)] ?? null;

  if (!dayHours || !dayHours.open || !dayHours.close) return [];

  const openTime = dayHours.open; // e.g. "09:00"
  const closeTime = dayHours.close; // e.g. "21:00"

  // 4. Generate all possible slots at 30-minute intervals
  const slots: TimeSlot[] = [];
  const [openH, openM] = openTime.split(':').map(Number);
  const [closeH, closeM] = closeTime.split(':').map(Number);
  const openMinutes = openH * 60 + openM;
  const closeMinutes = closeH * 60 + closeM;

  // If booking for today, skip past time slots (use IST timezone)
  const now = new Date();
  const istOffset = 5.5 * 60; // IST is UTC+5:30
  const utcMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  const currentISTMinutes = utcMinutes + istOffset;
  const todayIST = new Date(now.getTime() + istOffset * 60000).toISOString().split('T')[0];
  const isToday = date === todayIST;

  for (let start = openMinutes; start + serviceDuration <= closeMinutes; start += 30) {
    // Skip slots that have already passed today
    if (isToday && start <= currentISTMinutes) continue;

    const end = start + serviceDuration;
    const startStr = `${String(Math.floor(start / 60)).padStart(2, '0')}:${String(start % 60).padStart(2, '0')}:00`;
    const endStr = `${String(Math.floor(end / 60)).padStart(2, '0')}:${String(end % 60).padStart(2, '0')}:00`;
    slots.push({ slot_start: startStr, slot_end: endStr });
  }

  // 5. Fetch existing appointments for this employee on this date (non-cancelled)
  const { data: existingAppts } = await supabase
    .from('appointments')
    .select('start_time, end_time')
    .eq('employee_id', employeeId)
    .eq('appointment_date', date)
    .neq('status', 'cancelled');

  if (!existingAppts || existingAppts.length === 0) return slots;

  // 6. Filter out slots that overlap with existing appointments
  const available = slots.filter((slot) => {
    const slotStart = timeToMinutes(slot.slot_start);
    const slotEnd = timeToMinutes(slot.slot_end);

    return !existingAppts.some((appt) => {
      const apptStart = timeToMinutes(appt.start_time);
      const apptEnd = timeToMinutes(appt.end_time);
      // Overlap check: slot overlaps if it starts before appt ends AND ends after appt starts
      return slotStart < apptEnd && slotEnd > apptStart;
    });
  });

  return available;
}

/** Convert HH:MM:SS or HH:MM time string to minutes since midnight */
function timeToMinutes(time: string): number {
  const parts = time.split(':').map(Number);
  return parts[0] * 60 + parts[1];
}

/**
 * Fetch active services for the current tenant/branch.
 */
export async function getActiveServices(): Promise<Service[]> {
  const supabase = await createClient();

  const { data } = await supabase
    .from('services')
    .select('*')
    .eq('is_active', true)
    .order('category')
    .order('name');

  return (data ?? []) as Service[];
}

/**
 * Fetch active employees for the current tenant/branch.
 */
export async function getActiveEmployees(): Promise<Employee[]> {
  const supabase = await createClient();

  const { data } = await supabase
    .from('employees')
    .select('*')
    .eq('is_active', true)
    .order('name');

  return (data ?? []) as Employee[];
}

/**
 * Search customers by name or phone.
 * Returns up to 10 results for autocomplete.
 */
export async function searchCustomers(query: string): Promise<{ id: string; name: string; phone: string }[]> {
  if (!query.trim()) return [];

  const supabase = await createClient();

  const { data } = await supabase
    .from('customers')
    .select('id, name, phone')
    .or(`name.ilike.%${query.trim()}%,phone.ilike.%${query.trim()}%`)
    .order('name')
    .limit(10);

  return (data ?? []) as { id: string; name: string; phone: string }[];
}
