import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getPlatformCredentials, WA_BASE_URL } from '@/lib/whatsapp/config';
import crypto from 'crypto';

// =============================================================================
// WhatsApp Flow Data Exchange Endpoint
// Handles the data exchange between WhatsApp Flows and our backend.
// When a customer fills the booking form in WhatsApp, Meta sends the data here.
// =============================================================================

/**
 * POST /api/whatsapp/flow
 * Receives encrypted flow data from Meta, decrypts, processes booking,
 * and returns the next screen or completion response.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // The flow sends action + data
    const { action, screen, data, flow_token } = body;

    console.log('[WhatsApp Flow] Received:', { action, screen, flow_token });

    // INIT action — return initial screen data
    if (action === 'INIT') {
      return NextResponse.json(await handleFlowInit(data));
    }

    // DATA_EXCHANGE — handle screen submissions
    if (action === 'data_exchange') {
      return NextResponse.json(await handleDataExchange(screen, data, flow_token));
    }

    // BACK — handle back navigation
    if (action === 'BACK') {
      return NextResponse.json({ screen: 'BOOKING_SCREEN', data: {} });
    }

    return NextResponse.json({ version: '3.0', screen: 'BOOKING_SCREEN', data: {} });
  } catch (err) {
    console.error('[WhatsApp Flow] Error:', err);
    return NextResponse.json({ version: '3.0', screen: 'BOOKING_SCREEN', data: {} });
  }
}

/**
 * Handle INIT — provide initial data for the booking form.
 * Returns available services, stylists, and dates.
 */
async function handleFlowInit(data: any) {
  const admin = createAdminClient();

  // Use tenant_id from flow payload if available, otherwise fetch all
  const tenantId = data?.tenant_id;
  const branchId = data?.branch_id;

  // Fetch active services for this tenant
  let serviceQuery = admin
    .from('services')
    .select('id, name, price, duration_minutes')
    .eq('is_active', true)
    .order('name')
    .limit(20);

  if (tenantId) {
    serviceQuery = serviceQuery.eq('tenant_id', tenantId);
  }
  if (branchId) {
    serviceQuery = serviceQuery.eq('branch_id', branchId);
  }

  const { data: services } = await serviceQuery;

  // Fetch active employees/stylists for this tenant
  let empQuery = admin
    .from('employees')
    .select('id, name')
    .eq('is_active', true)
    .order('name')
    .limit(20);

  if (tenantId) {
    empQuery = empQuery.eq('tenant_id', tenantId);
  }
  if (branchId) {
    empQuery = empQuery.eq('branch_id', branchId);
  }

  const { data: employees } = await empQuery;

  // Generate next 14 days as available dates
  const dates: Array<{ id: string; title: string }> = [];
  for (let i = 0; i < 14; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    const dateStr = d.toISOString().split('T')[0];
    const label = d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
    dates.push({ id: dateStr, title: label });
  }

  // Generate time slots (9 AM to 8 PM, 30-min intervals)
  const timeSlots: Array<{ id: string; title: string }> = [];
  for (let hour = 9; hour < 20; hour++) {
    for (const min of [0, 30]) {
      const h = hour % 12 || 12;
      const period = hour >= 12 ? 'PM' : 'AM';
      const timeStr = `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}:00`;
      const label = `${h}:${String(min).padStart(2, '0')} ${period}`;
      timeSlots.push({ id: timeStr, title: label });
    }
  }

  return {
    version: '3.0',
    screen: 'BOOKING_SCREEN',
    data: {
      services: (services ?? []).map((s: any) => ({
        id: s.id,
        title: `${s.name} — ₹${s.price} (${s.duration_minutes} min)`,
      })),
      stylists: (employees ?? []).map((e: any) => ({
        id: e.id,
        title: e.name,
      })),
      dates,
      time_slots: timeSlots,
    },
  };
}

/**
 * Handle data exchange — process the booking form submission.
 * Creates the appointment in the database and returns confirmation.
 */
async function handleDataExchange(screen: string, data: any, flowToken: string) {
  if (screen === 'BOOKING_SCREEN') {
    return await processBooking(data, flowToken);
  }

  return { version: '3.0', screen: 'BOOKING_SCREEN', data: {} };
}

/**
 * Process the booking submission from WhatsApp Flow.
 * Creates appointment in DB and sends confirmation.
 */
async function processBooking(data: any, flowToken: string) {
  const { service_id, stylist_id, date, time_slot, customer_name, customer_phone } = data;

  if (!service_id || !stylist_id || !date || !time_slot) {
    return {
      version: '3.0',
      screen: 'BOOKING_SCREEN',
      data: { error_message: 'Please fill all fields to book your appointment.' },
    };
  }

  const admin = createAdminClient();

  // Get service details for duration
  const { data: service } = await admin
    .from('services')
    .select('id, name, price, duration_minutes, tenant_id, branch_id')
    .eq('id', service_id)
    .single();

  if (!service) {
    return {
      version: '3.0',
      screen: 'BOOKING_SCREEN',
      data: { error_message: 'Service not found. Please try again.' },
    };
  }

  // Calculate end time
  const [startH, startM] = time_slot.split(':').map(Number);
  const totalMinutes = startH * 60 + startM + service.duration_minutes;
  const endTime = `${String(Math.floor(totalMinutes / 60)).padStart(2, '0')}:${String(totalMinutes % 60).padStart(2, '0')}:00`;

  // Find or create customer by phone
  const phoneE164 = customer_phone?.startsWith('+') ? customer_phone : `+${customer_phone}`;
  let customerId: string | null = null;

  const { data: existingCustomer } = await (admin
    .from('customers')
    .select('id')
    .eq('phone', phoneE164)
    .eq('tenant_id', service.tenant_id)
    .single() as any);

  if (existingCustomer) {
    customerId = existingCustomer.id;
  } else {
    // Create new customer
    const { data: newCustomer } = await (admin
      .from('customers')
      .insert({
        tenant_id: service.tenant_id,
        branch_id: service.branch_id,
        name: customer_name || 'WhatsApp Customer',
        phone: phoneE164,
      } as any)
      .select('id')
      .single() as any);

    customerId = newCustomer?.id ?? null;
  }

  if (!customerId) {
    return {
      version: '3.0',
      screen: 'BOOKING_SCREEN',
      data: { error_message: 'Could not create customer profile. Please try again.' },
    };
  }

  // Create appointment
  const { data: appointment, error: apptError } = await (admin
    .from('appointments')
    .insert({
      tenant_id: service.tenant_id,
      branch_id: service.branch_id,
      customer_id: customerId,
      service_id: service_id,
      employee_id: stylist_id,
      appointment_date: date,
      start_time: time_slot,
      end_time: endTime,
      status: 'booked',
      source: 'whatsapp_flow',
      whatsapp_flow_ref: JSON.stringify([service_id]),
    } as any)
    .select('id')
    .single() as any);

  if (apptError) {
    console.error('[WhatsApp Flow] Booking error:', apptError);
    return {
      version: '3.0',
      screen: 'BOOKING_SCREEN',
      data: { error_message: 'This slot may be taken. Please try a different time.' },
    };
  }

  // Send booking confirmation message
  const credentials = getPlatformCredentials();
  if (credentials && customer_phone) {
    const { sendMessage } = await import('@/lib/whatsapp/templates');
    const dateLabel = new Date(date + 'T00:00:00+05:30').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    const timeLabel = formatTime12h(time_slot);

    await sendMessage(credentials, customer_phone, {
      type: 'interactive',
      interactive: {
        type: 'button',
        body: {
          text: `✅ *Booking Confirmed!*\n\n👤 ${customer_name || 'Customer'}\n✂️ ${service.name}\n📅 ${dateLabel}, ${timeLabel}\n\nSee you soon! 😊`,
        },
        action: {
          buttons: [
            { type: 'reply', reply: { id: 'reschedule_appointment', title: '🔄 Reschedule' } },
            { type: 'reply', reply: { id: 'cancel_appointment', title: '❌ Cancel' } },
          ],
        },
      },
    });
  }

  // Return completion screen
  return {
    version: '3.0',
    screen: 'SUCCESS',
    data: {
      extension_message_response: {
        params: {
          flow_token: flowToken,
          status: 'booking_confirmed',
          appointment_id: appointment?.id,
        },
      },
    },
  };
}

/**
 * Format time string to 12-hour format.
 */
function formatTime12h(time: string): string {
  const [h, m] = time.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 || 12;
  return `${hour12}:${String(m).padStart(2, '0')} ${period}`;
}
