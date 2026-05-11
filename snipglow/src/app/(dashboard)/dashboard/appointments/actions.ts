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

  revalidatePath('/appointments');
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
  revalidatePath('/appointments');
  return { success: true, data: undefined };
}

/**
 * Get available time slots for a given employee on a specific date.
 * Calls the `get_available_slots` PostgreSQL function via supabase.rpc().
 */
export async function getAvailableSlots(
  employeeId: string,
  date: string,
  serviceDuration: number
): Promise<TimeSlot[]> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc('get_available_slots', {
    p_employee_id: employeeId,
    p_date: date,
    p_duration: serviceDuration,
  });

  if (error) {
    console.error('Error fetching available slots:', error);
    return [];
  }

  return (data ?? []) as TimeSlot[];
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
