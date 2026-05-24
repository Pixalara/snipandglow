'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';
import { getPlatformCredentials } from '@/lib/whatsapp/config';
import { sendMessage } from '@/lib/whatsapp/templates';
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
      whatsapp_flow_ref: input.extra_service_ids ? JSON.stringify(input.extra_service_ids) : (input.whatsapp_flow_ref ?? null),
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

  // Send WhatsApp booking confirmation to customer
  try {
    const admin = createAdminClient();
    const { data: customer } = await admin.from('customers').select('name, phone').eq('id', input.customer_id).single();
    if (customer?.phone) {
      const credentials = getPlatformCredentials();
      if (credentials) {
        // Get service names
        const svcIds = input.extra_service_ids || [input.service_id];
        const { data: svcs } = await admin.from('services').select('name').in('id', svcIds);
        const serviceNames = svcs?.map((s: any) => s.name).join(', ') || '';

        // Get salon name
        const { data: tenantInfo } = await (admin.from('tenants' as any).select('name').eq('id', tenantId).single() as any);
        const salonName = ((tenantInfo?.name as string) || '').trim();

        // Format date/time
        const dateLabel = new Date(input.appointment_date + 'T12:00:00+05:30').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
        const [h, m] = input.start_time.split(':').map(Number);
        const period = h >= 12 ? 'PM' : 'AM';
        const timeLabel = `${h % 12 || 12}:${String(m).padStart(2, '0')} ${period}`;
        const dateTimeFormatted = `${dateLabel}, ${timeLabel}`;

        // Build calendar token
        const calendarToken = Buffer.from(
          [serviceNames + ' at ' + salonName, input.appointment_date, input.start_time, input.end_time, salonName].join('|')
        ).toString('base64url');

        const phone = customer.phone.replace(/\D/g, '');

        // Send booking_confirmation_v2 template
        await sendMessage(credentials, phone, {
          type: 'template',
          template: {
            name: 'booking_confirmation_v2',
            language: { code: 'en' },
            components: [
              {
                type: 'body',
                parameters: [
                  { type: 'text', text: customer.name },
                  { type: 'text', text: serviceNames },
                  { type: 'text', text: dateTimeFormatted },
                  { type: 'text', text: salonName },
                ],
              },
              {
                type: 'button',
                sub_type: 'url',
                index: '2',
                parameters: [{ type: 'text', text: calendarToken }],
              },
            ],
          },
        });
      }
    }
  } catch (err) {
    console.error('[CreateAppointment] WhatsApp notification failed:', err);
    // Don't fail the appointment creation if notification fails
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
 * Sends WhatsApp notification to customer on cancel.
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

  // 1. Fetch current appointment with customer details for notification
  const { data: appointment, error: fetchError } = await supabase
    .from('appointments')
    .select('id, status, customer_id, service_id, appointment_date, start_time, tenant_id, whatsapp_flow_ref')
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

  // 4. Send WhatsApp notification to customer on cancellation
  if (newStatus === 'cancelled') {
    await notifyCustomerCancellation(appointment);
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
  serviceIds?: string[],
  customDiscountPct?: number
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
    .select('id, status, customer_id, service_id, employee_id, whatsapp_flow_ref')
    .eq('id', appointmentId)
    .single();

  if (fetchError || !appointment) {
    return { success: false, error: 'Appointment not found.' };
  }

  if (appointment.status !== 'confirmed' && appointment.status !== 'booked') {
    return { success: false, error: 'Only booked or confirmed appointments can be completed.' };
  }

  // 2. Fetch all services for the bill
  // Try to get all service IDs from whatsapp_flow_ref (stores extra_service_ids as JSON)
  let allServiceIds: string[] = [appointment.service_id];
  try {
    const extraIds = appointment.whatsapp_flow_ref ? JSON.parse(appointment.whatsapp_flow_ref) : null;
    if (Array.isArray(extraIds) && extraIds.length > 0) {
      allServiceIds = extraIds;
    }
  } catch {
    // Not JSON, use just the primary service_id
  }

  // Use provided serviceIds override, or the stored ones
  const idsToFetch = serviceIds && serviceIds.length > 0 ? serviceIds : allServiceIds;
  const { data: services } = await supabase
    .from('services')
    .select('id, name, price')
    .in('id', idsToFetch);

  if (!services || services.length === 0) {
    return { success: false, error: 'Services not found.' };
  }

  // 3. Check for active membership discount or use custom discount
  let discountPct = customDiscountPct ?? 0;
  if (!customDiscountPct || customDiscountPct === 0) {
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

  // 8. Send bill receipt to customer via WhatsApp
  await notifyCustomerBillReceipt(tenantId, appointment.customer_id, services, invoice.invoice_number, subtotal, discountPct, discountAmount, total, paymentMethod);

  revalidatePath('/dashboard/appointments');
  revalidatePath('/dashboard/billing');
  return { success: true, data: { invoiceId: invoice.id, invoiceNumber: invoice.invoice_number } };
}

/**
 * Reschedule an existing appointment to a new date and time.
 * Only works for booked or confirmed appointments.
 * Sends WhatsApp notification to customer with new date/time.
 */
export async function rescheduleAppointment(
  appointmentId: string,
  newSchedule: { appointment_date: string; start_time: string; end_time: string }
): Promise<ActionResult<void>> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not authenticated' };

  // Fetch the appointment with customer details for notification
  const { data: appointment, error: fetchError } = await supabase
    .from('appointments')
    .select('id, status, customer_id, service_id, tenant_id, appointment_date, start_time, whatsapp_flow_ref')
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

  // Send WhatsApp notification to customer
  await notifyCustomerReschedule(appointment, newSchedule);

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

  // Get the appointment's employee and service in one query
  const { data: appointment } = await supabase
    .from('appointments')
    .select('employee_id, service_id, services(duration_minutes)')
    .eq('id', appointmentId)
    .single();

  if (!appointment) return [];

  const duration = (appointment.services as any)?.duration_minutes ?? 30;

  return getAvailableSlots(appointment.employee_id, date, duration);
}

/**
 * Get available time slots for a given employee on a specific date.
 * Generates slots based on branch operating hours and excludes booked appointments
 * and admin-blocked slots from tenant settings.
 */
export async function getAvailableSlots(
  employeeId: string,
  date: string,
  serviceDuration: number
): Promise<TimeSlot[]> {
  const supabase = await createClient();

  // 1. Get employee's branch_id and tenant_id
  const { data: employee } = await supabase
    .from('employees')
    .select('branch_id, tenant_id')
    .eq('id', employeeId)
    .single();

  if (!employee) return [];

  // 2. Fetch branch hours, existing appointments, AND tenant blocked slots in parallel
  const [branchRes, apptsRes, tenantRes] = await Promise.all([
    supabase
      .from('branches')
      .select('operating_hours')
      .eq('id', employee.branch_id)
      .single(),
    supabase
      .from('appointments')
      .select('start_time, end_time')
      .eq('employee_id', employeeId)
      .eq('appointment_date', date)
      .neq('status', 'cancelled'),
    supabase
      .from('tenants')
      .select('settings')
      .eq('id', (employee as any).tenant_id)
      .single(),
  ]);

  const branch = branchRes.data;
  if (!branch || !branch.operating_hours) return [];

  // 3. Determine the day name from the date (use IST to avoid timezone day shift)
  const dateObj = new Date(date + 'T12:00:00+05:30');
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const dayName = dayNames[dateObj.getUTCDay()];

  // Try multiple key formats (full name, 3-letter abbreviation)
  const hours = branch.operating_hours as Record<string, { open?: string; close?: string } | undefined>;
  const dayHours = hours[dayName] ?? hours[dayName.slice(0, 3)] ?? null;

  if (!dayHours || !dayHours.open || !dayHours.close) return [];

  const openTime = dayHours.open;
  const closeTime = dayHours.close;

  // 4. Get blocked slots and capacity settings from tenant settings
  const tenantSettings = (tenantRes.data?.settings as any) ?? {};
  const blockedSlotEntries: Array<{ date: string; slots: string[] }> = tenantSettings.blocked_slots || [];
  const blockedForDate = blockedSlotEntries.find((b) => b.date === date);
  const blockedTimes = new Set(blockedForDate?.slots || []); // Set<"HH:MM">

  // Capacity: how many appointments allowed per slot (default 1)
  const maxPerSlot: number = tenantSettings.max_appointments_per_slot || 1;

  // 5. Generate all possible slots at 30-minute intervals
  const slots: TimeSlot[] = [];
  const [openH, openM] = openTime.split(':').map(Number);
  const [closeH, closeM] = closeTime.split(':').map(Number);
  const openMinutes = openH * 60 + openM;
  const closeMinutes = closeH * 60 + closeM;

  // If booking for today, skip past time slots (use IST timezone)
  const nowIST = new Date().toLocaleString('en-CA', { timeZone: 'Asia/Kolkata', hour12: false });
  const [todayIST, todayTimeStr] = nowIST.split(', ');
  const [nowH, nowM] = (todayTimeStr || '00:00:00').split(':').map(Number);
  const currentISTMinutes = nowH * 60 + nowM;
  const isToday = date === todayIST;

  for (let start = openMinutes; start + serviceDuration <= closeMinutes; start += 30) {
    if (isToday && start <= currentISTMinutes) continue;

    // Skip admin-blocked slots
    const slotHH = String(Math.floor(start / 60)).padStart(2, '0');
    const slotMM = String(start % 60).padStart(2, '0');
    if (blockedTimes.has(`${slotHH}:${slotMM}`)) continue;

    const end = start + serviceDuration;
    const startStr = `${slotHH}:${slotMM}:00`;
    const endStr = `${String(Math.floor(end / 60)).padStart(2, '0')}:${String(end % 60).padStart(2, '0')}:00`;
    slots.push({ slot_start: startStr, slot_end: endStr });
  }

  // 6. Filter out slots that exceed capacity (count overlapping appointments per slot)
  const existingAppts = apptsRes.data;
  if (!existingAppts || existingAppts.length === 0) return slots;

  const available = slots.filter((slot) => {
    const slotStart = timeToMinutes(slot.slot_start);
    const slotEnd = timeToMinutes(slot.slot_end);

    // Count how many existing appointments overlap this slot
    const overlappingCount = existingAppts.filter((appt) => {
      const apptStart = timeToMinutes(appt.start_time);
      const apptEnd = timeToMinutes(appt.end_time);
      return slotStart < apptEnd && slotEnd > apptStart;
    }).length;

    // Slot is available if current bookings are below capacity
    return overlappingCount < maxPerSlot;
  });

  return available;
}

/** Convert HH:MM:SS or HH:MM time string to minutes since midnight */
function timeToMinutes(time: string): number {
  const parts = time.split(':').map(Number);
  return parts[0] * 60 + parts[1];
}

/**
 * Update the services on an existing appointment.
 * Stores all service IDs in whatsapp_flow_ref as JSON array.
 */
export async function updateAppointmentServices(
  appointmentId: string,
  serviceIds: string[]
): Promise<ActionResult<void>> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not authenticated' };

  if (!serviceIds || serviceIds.length === 0) {
    return { success: false, error: 'At least one service is required.' };
  }

  const { error } = await supabase
    .from('appointments')
    .update({
      service_id: serviceIds[0],
      whatsapp_flow_ref: JSON.stringify(serviceIds),
    })
    .eq('id', appointmentId);

  if (error) {
    return { success: false, error: 'Failed to update services.' };
  }

  revalidatePath('/dashboard/appointments');
  return { success: true, data: undefined };
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

/**
 * Get the membership discount for a customer (used by Complete & Bill modal).
 * Returns the discount percentage if customer has an active membership, 0 otherwise.
 */
export async function getCustomerMembershipDiscount(customerId: string): Promise<{ discountPct: number; membershipName: string } | null> {
  const supabase = await createClient();

  const today = new Date().toISOString().split('T')[0];

  const { data } = await supabase
    .from('customer_memberships')
    .select('membership_id, memberships(name, discount_pct)')
    .eq('customer_id', customerId)
    .eq('status', 'active')
    .gte('end_date', today)
    .limit(1)
    .maybeSingle() as any;

  if (!data) return null;

  const membership = data.memberships as { name: string; discount_pct: number } | null;
  if (!membership) return null;

  return {
    discountPct: membership.discount_pct,
    membershipName: membership.name,
  };
}

// =============================================================================
// WhatsApp Notification Helpers (Dashboard → Customer)
// =============================================================================

/** Format time to 12-hour display */
function formatTime12h(time: string): string {
  const [h, m] = time.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${period}`;
}

/**
 * Notify customer via WhatsApp when salon cancels their appointment.
 */
async function notifyCustomerCancellation(appointment: any) {
  try {
    const admin = createAdminClient();
    const credentials = getPlatformCredentials();
    if (!credentials) return;

    // Get customer phone
    const { data: customer } = await admin
      .from('customers')
      .select('name, phone')
      .eq('id', appointment.customer_id)
      .single();

    if (!customer?.phone) return;

    // Get service names
    let serviceNames = '';
    try {
      const extraIds = appointment.whatsapp_flow_ref ? JSON.parse(appointment.whatsapp_flow_ref) : null;
      const svcIds = Array.isArray(extraIds) && extraIds.length > 0 ? extraIds : [appointment.service_id];
      const { data: services } = await admin.from('services').select('name').in('id', svcIds);
      serviceNames = services?.map((s: any) => s.name).join(', ') || '';
    } catch {
      const { data: svc } = await admin.from('services').select('name').eq('id', appointment.service_id).single();
      serviceNames = svc?.name || 'your service';
    }

    // Get salon name
    const { data: tenant } = await admin.from('tenants').select('name').eq('id', appointment.tenant_id).single();
    const salonName = tenant?.name || 'the salon';

    // Format date
    const dateLabel = new Date(appointment.appointment_date + 'T00:00:00+05:30')
      .toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    const timeLabel = formatTime12h(appointment.start_time);

    // Send cancellation message
    const phone = customer.phone.replace(/\D/g, '');
    await sendMessage(credentials, phone, {
      type: 'interactive',
      interactive: {
        type: 'button',
        body: {
          text: `❌ *Appointment Cancelled*\n\nHi ${customer.name}, your appointment at *${salonName}* has been cancelled by the salon.\n\n✂️ ${serviceNames}\n📅 ${dateLabel}, ${timeLabel}\n\nWe apologize for the inconvenience. Would you like to rebook?`,
        },
        action: {
          buttons: [
            { type: 'reply', reply: { id: 'book_appointment', title: 'Book Again' } },
          ],
        },
      },
    });

    // Log to whatsapp_sessions
    await (admin.from('whatsapp_sessions').insert({
      tenant_id: appointment.tenant_id,
      message_id: `cancel_${Date.now()}`,
      phone,
      direction: 'outbound',
      template_name: 'appointment_cancelled',
      status: 'sent',
      metadata: { customer_name: customer.name },
    } as any) as any);
  } catch (err) {
    console.error('[Actions] Failed to notify customer cancellation:', err);
  }
}

/**
 * Notify customer via WhatsApp when salon reschedules their appointment.
 */
async function notifyCustomerReschedule(
  appointment: any,
  newSchedule: { appointment_date: string; start_time: string; end_time: string }
) {
  try {
    const admin = createAdminClient();
    const credentials = getPlatformCredentials();
    if (!credentials) return;

    // Get customer phone
    const { data: customer } = await admin
      .from('customers')
      .select('name, phone')
      .eq('id', appointment.customer_id)
      .single();

    if (!customer?.phone) return;

    // Get service names
    let serviceNames = '';
    try {
      const extraIds = appointment.whatsapp_flow_ref ? JSON.parse(appointment.whatsapp_flow_ref) : null;
      const svcIds = Array.isArray(extraIds) && extraIds.length > 0 ? extraIds : [appointment.service_id];
      const { data: services } = await admin.from('services').select('name').in('id', svcIds);
      serviceNames = services?.map((s: any) => s.name).join(', ') || '';
    } catch {
      const { data: svc } = await admin.from('services').select('name').eq('id', appointment.service_id).single();
      serviceNames = svc?.name || 'your service';
    }

    // Get salon name
    const { data: tenant } = await admin.from('tenants').select('name').eq('id', appointment.tenant_id).single();
    const salonName = tenant?.name || 'the salon';

    // Format old and new dates
    const oldDateLabel = new Date(appointment.appointment_date + 'T00:00:00+05:30')
      .toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    const oldTimeLabel = formatTime12h(appointment.start_time);

    const newDateLabel = new Date(newSchedule.appointment_date + 'T00:00:00+05:30')
      .toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    const newTimeLabel = formatTime12h(newSchedule.start_time);

    // Send reschedule message
    const phone = customer.phone.replace(/\D/g, '');
    await sendMessage(credentials, phone, {
      type: 'interactive',
      interactive: {
        type: 'button',
        body: {
          text: `📅 *Appointment Rescheduled*\n\nHi ${customer.name}, your appointment at *${salonName}* has been rescheduled.\n\n✂️ ${serviceNames}\n\n❌ Old: ${oldDateLabel}, ${oldTimeLabel}\n✅ New: ${newDateLabel}, ${newTimeLabel}\n\nSee you at the new time! 😊`,
        },
        action: {
          buttons: [
            { type: 'reply', reply: { id: 'reschedule_appointment', title: 'Change Again' } },
            { type: 'reply', reply: { id: 'cancel_appointment', title: 'Cancel' } },
          ],
        },
      },
    });

    // Log to whatsapp_sessions
    await (admin.from('whatsapp_sessions').insert({
      tenant_id: appointment.tenant_id,
      message_id: `resched_${Date.now()}`,
      phone,
      direction: 'outbound',
      template_name: 'appointment_rescheduled',
      status: 'sent',
      metadata: { customer_name: customer.name },
    } as any) as any);
  } catch (err) {
    console.error('[Actions] Failed to notify customer reschedule:', err);
  }
}

/**
 * Send bill/receipt to customer via WhatsApp after completing appointment.
 */
async function notifyCustomerBillReceipt(
  tenantId: string,
  customerId: string,
  services: { id: string; name: string; price: number }[],
  invoiceNumber: string,
  subtotal: number,
  discountPct: number,
  discountAmount: number,
  total: number,
  paymentMethod: string
) {
  try {
    const admin = createAdminClient();
    const credentials = getPlatformCredentials();
    if (!credentials) return;

    // Get customer phone and name
    const { data: customer } = await admin
      .from('customers')
      .select('name, phone')
      .eq('id', customerId)
      .single();

    if (!customer?.phone) return;

    // Get salon name and tenant code for booking link
    const { data: tenant } = await (admin.from('tenants' as any).select('name, tenant_code').eq('id', tenantId).single() as any);
    const salonName = ((tenant?.name as string) || 'the salon').trim();

    const phone = customer.phone.replace(/\D/g, '');

    // Build service list for template
    const serviceList = services.map((s) => s.name).join(', ');

    // Send bill_receipt_v1 template (works outside 24-hour window)
    await sendMessage(credentials, phone, {
      type: 'template',
      template: {
        name: 'bill_receipt_v1',
        language: { code: 'en' },
        components: [
          {
            type: 'body',
            parameters: [
              { type: 'text', text: customer.name },
              { type: 'text', text: salonName },
              { type: 'text', text: invoiceNumber },
              { type: 'text', text: serviceList },
              { type: 'text', text: String(total) },
              { type: 'text', text: paymentMethod.toUpperCase() },
            ],
          },
        ],
      },
    });

    // Log bill receipt to whatsapp_sessions
    await (admin.from('whatsapp_sessions').insert({
      tenant_id: tenantId,
      message_id: `bill_${Date.now()}`,
      phone,
      direction: 'outbound',
      template_name: 'bill_receipt_v1',
      status: 'sent',
      metadata: { customer_name: customer.name },
    } as any) as any);

    // Send feedback_request_v1 template (works outside 24-hour window)
    await sendMessage(credentials, phone, {
      type: 'template',
      template: {
        name: 'feedback_request_v1',
        language: { code: 'en' },
        components: [
          {
            type: 'body',
            parameters: [
              { type: 'text', text: customer.name },
              { type: 'text', text: salonName },
            ],
          },
        ],
      },
    });

    // Log feedback request to whatsapp_sessions
    await (admin.from('whatsapp_sessions').insert({
      tenant_id: tenantId,
      message_id: `feedback_req_${Date.now()}`,
      phone,
      direction: 'outbound',
      template_name: 'feedback_request_v1',
      status: 'sent',
      metadata: { customer_name: customer.name },
    } as any) as any);
  } catch (err) {
    console.error('[Actions] Failed to send bill receipt:', err);
  }
}
