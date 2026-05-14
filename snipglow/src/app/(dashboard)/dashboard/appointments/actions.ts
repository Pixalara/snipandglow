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
 * Complete an appointment AND generate an invoice for it.
 * Marks appointment as completed, creates invoice with all service line items.
 */
export async function completeAndGenerateBill(
  appointmentId: string,
  paymentMethod: 'cash' | 'upi' | 'card',
  serviceIds?: string[]
): Promise<ActionResult<{ invoiceId: string; invoiceNumber: string }>> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not authenticated' };

  const tenantId = user.user_metadata?.tenant_id;
  const branchId = user.user_metadata?.branch_id;
  if (!tenantId || !branchId) {
    return { success: false, error: 'No tenant or branch context found.' };
  }

  // 1. Fetch the appointment
  const { data: appointment, error: fetchError } = await supabase
    .from('appointments')
    .select('id, status, customer_id, service_id, employee_id')
    .eq('id', appointmentId)
    .single();

  if (fetchError || !appointment) {
    return { success: false, error: 'Appointment not found.' };
  }

  if (appointment.status !== 'confirmed' && appointment.status !== 'booked') {
    return { success: false, error: 'Only booked or confirmed appointments can be completed.' };
  }

  // 2. Fetch all services for the bill (use provided IDs or fall back to appointment's service)
  const idsToFetch = serviceIds && serviceIds.length > 0 ? serviceIds : [appointment.service_id];
  const { data: services } = await supabase
    .from('services')
    .select('id, name, price')
    .in('id', idsToFetch);

  if (!services || services.length === 0) {
    return { success: false, error: 'Services not found.' };
  }

  // 3. Check for active membership discount
  let discountPct = 0;
  const today = new Date().toISOString().split('T')[0];
  const { data: activeMembership } = await supabase
    .from('customer_memberships')
    .select('membership_id, memberships(discount_pct)')
    .eq('customer_id', appointment.customer_id)
    .eq('status', 'active')
    .gte('end_date', today)
    .limit(1)
    .maybeSingle();

  if (activeMembership) {
    const membership = activeMembership.memberships as unknown as { discount_pct: number } | null;
    discountPct = membership?.discount_pct ?? 0;
  }

  // 4. Calculate totals from all services
  const subtotal = services.reduce((sum, svc) => sum + svc.price, 0);
  const discountAmount = Math.round((subtotal * discountPct) / 100);
  const taxableAmount = subtotal - discountAmount;
  const total = taxableAmount;

  // 5. Mark appointment as completed
  const { error: updateError } = await supabase
    .from('appointments')
    .update({ status: 'completed' })
    .eq('id', appointmentId);

  if (updateError) {
    return { success: false, error: 'Failed to complete appointment.' };
  }

  // 6. Create invoice
  const { data: invoice, error: invoiceError } = await supabase
    .from('invoices')
    .insert({
      tenant_id: tenantId,
      branch_id: branchId,
      customer_id: appointment.customer_id,
      appointment_id: appointmentId,
      invoice_number: '',
      subtotal,
      discount_amount: discountAmount,
      discount_pct: discountPct,
      gst_amount: 0,
      gst_rate: 0,
      total,
      payment_method: paymentMethod,
      payment_status: 'paid',
      delivery_status: 'pending',
    })
    .select('id, invoice_number')
    .single();

  if (invoiceError) {
    console.error('Invoice creation error:', invoiceError);
    return { success: false, error: 'Appointment completed but failed to generate bill.' };
  }

  // 7. Create invoice line items for ALL services
  const lineItems = services.map((svc) => ({
    invoice_id: invoice.id,
    service_id: svc.id,
    service_name: svc.name,
    unit_price: svc.price,
    quantity: 1,
    line_total: svc.price,
  }));

  await supabase.from('invoice_items').insert(lineItems);

  revalidatePath('/dashboard/appointments');
  revalidatePath('/dashboard/billing');
  return { success: true, data: { invoiceId: invoice.id, invoiceNumber: invoice.invoice_number } };
}

/**
 * Reschedule an existing appointment to a new date and time.
 * Only works for booked or confirmed appointments.
 */
export async function rescheduleAppointment(
  appointmentId: string,
  newSchedule: { appointment_date: string; start_time: string; end_time: string }
): Promise<ActionResult<void>> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not authenticated' };

  // Fetch the appointment to verify it can be rescheduled
  const { data: appointment, error: fetchError } = await supabase
    .from('appointments')
    .select('id, status')
    .eq('id', appointmentId)
    .single();

  if (fetchError || !appointment) {
    return { success: false, error: 'Appointment not found.' };
  }

  if (appointment.status !== 'booked' && appointment.status !== 'confirmed') {
    return { success: false, error: 'Only booked or confirmed appointments can be rescheduled.' };
  }

  // Update the appointment date and time
  const { error: updateError } = await supabase
    .from('appointments')
    .update({
      appointment_date: newSchedule.appointment_date,
      start_time: newSchedule.start_time,
      end_time: newSchedule.end_time,
    })
    .eq('id', appointmentId);

  if (updateError) {
    if (updateError.code === '23P01') {
      return { success: false, error: 'This time slot overlaps with another appointment.' };
    }
    return { success: false, error: 'Failed to reschedule. Please try again.' };
  }

  revalidatePath('/dashboard/appointments');
  return { success: true, data: undefined };
}

/**
 * Get available slots for rescheduling — resolves employee and duration from the appointment.
 */
export async function getSlotsForReschedule(
  appointmentId: string,
  date: string
): Promise<TimeSlot[]> {
  const supabase = await createClient();

  // Get the appointment's employee and service
  const { data: appointment } = await supabase
    .from('appointments')
    .select('employee_id, service_id')
    .eq('id', appointmentId)
    .single();

  if (!appointment) return [];

  // Get service duration
  const { data: service } = await supabase
    .from('services')
    .select('duration_minutes')
    .eq('id', appointment.service_id)
    .single();

  const duration = service?.duration_minutes ?? 30;

  return getAvailableSlots(appointment.employee_id, date, duration);
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
