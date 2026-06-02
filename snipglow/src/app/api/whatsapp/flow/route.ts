import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getPlatformCredentials } from '@/lib/whatsapp/config';
import { notifyOwnerNewBooking, notifyOwnerReschedule } from '@/lib/whatsapp/notify-owner';
import { createNotification } from '@/lib/notifications';
import crypto from 'crypto';

// =============================================================================
// WhatsApp Flow Data Exchange Endpoint
// Handles encrypted data exchange between WhatsApp Flows and our backend.
// Meta sends AES-encrypted payloads; we decrypt, process, and return encrypted response.
// =============================================================================

const PRIVATE_KEY = (process.env.WHATSAPP_FLOW_PRIVATE_KEY || '').replace(/\\n/g, '\n');

/** GET /api/whatsapp/flow - Health check fallback */
export async function GET() {
  return NextResponse.json({ status: 'ok' }, { status: 200 });
}

/**
 * POST /api/whatsapp/flow
 * Receives encrypted flow data from Meta, decrypts, processes, returns encrypted response.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('[Flow] Raw body keys:', Object.keys(body));

    // Health check - Meta sends a ping to verify endpoint is alive
    if (!body.encrypted_aes_key && !body.encrypted_flow_data) {
      console.log('[Flow] No encrypted data - returning init data');
      const initData = await handleFlowInit({});
      return NextResponse.json(initData);
    }

    const { encrypted_aes_key, encrypted_flow_data, initial_vector } = body;

    if (!encrypted_aes_key || !encrypted_flow_data || !initial_vector) {
      return NextResponse.json({ version: '3.0', screen: 'BOOKING_SCREEN', data: {} });
    }

    // Decrypt AES key using our RSA private key
    let decryptedAesKey: Buffer;
    try {
      decryptedAesKey = crypto.privateDecrypt(
        {
          key: PRIVATE_KEY,
          padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
          oaepHash: 'sha256',
        },
        Buffer.from(encrypted_aes_key, 'base64')
      );
    } catch (err) {
      console.error('[Flow] RSA decryption failed:', err);
      const fallback = await handleFlowInit({});
      return NextResponse.json(fallback, { status: 200 });
    }

    // Decrypt flow data using AES key
    const iv = Buffer.from(initial_vector, 'base64');
    const encryptedData = Buffer.from(encrypted_flow_data, 'base64');

    // Split encrypted data: last 16 bytes are auth tag
    const authTag = encryptedData.slice(-16);
    const ciphertext = encryptedData.slice(0, -16);

    const decipher = crypto.createDecipheriv('aes-128-gcm', decryptedAesKey, iv);
    decipher.setAuthTag(authTag);

    let decryptedData: string;
    try {
      decryptedData = decipher.update(ciphertext, undefined, 'utf8') + decipher.final('utf8');
    } catch (err) {
      console.error('[Flow] AES decryption failed:', err);
      return NextResponse.json({ error: 'Decryption failed' }, { status: 421 });
    }

    const flowData = JSON.parse(decryptedData);
    console.log('[Flow] Decrypted payload:', JSON.stringify(flowData).substring(0, 500));

    let responsePayload: any;
    const action = flowData.action || flowData.type || '';
    console.log('[Flow] Action:', action, 'Screen:', flowData.screen);

    if (action === 'ping' || action === 'PING') {
      responsePayload = { version: '3.0', data: { status: 'active' } };
    } else if (action === 'INIT' || action === 'init' || !action) {
      responsePayload = await handleFlowInit(flowData.data || flowData.flow_action_payload?.data || {});
    } else if (action === 'data_exchange' || action === 'DATA_EXCHANGE') {
      responsePayload = await handleDataExchange(flowData.screen, flowData.data, flowData.flow_token);
    } else {
      responsePayload = await handleFlowInit(flowData.data || {});
    }

    console.log('[Flow] Response:', JSON.stringify(responsePayload).substring(0, 300));

    // Encrypt the response
    const responseJson = JSON.stringify(responsePayload);
    const flippedIv = Buffer.from(iv.map((b: number) => b ^ 0xff));

    const cipher = crypto.createCipheriv('aes-128-gcm', decryptedAesKey, flippedIv);
    const encryptedResponse = Buffer.concat([
      cipher.update(responseJson, 'utf8'),
      cipher.final(),
      cipher.getAuthTag(),
    ]);

    return new NextResponse(encryptedResponse.toString('base64'), {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    });
  } catch (err) {
    console.error('[Flow] Error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

// =============================================================================
// Flow Handlers
// =============================================================================

/** Helper: convert HH:MM or HH:MM:SS to minutes since midnight */
function toMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

async function handleFlowInit(data: any) {
  const admin = createAdminClient();

  const tenantId = data?.tenant_id;
  const branchId = data?.branch_id;

  // Fetch active services - if no tenant specified, get all (for shared mode)
  let serviceQuery = admin
    .from('services')
    .select('id, name, price, duration_minutes')
    .eq('is_active', true)
    .order('name')
    .limit(20);

  if (tenantId) serviceQuery = serviceQuery.eq('tenant_id', tenantId);
  if (branchId) serviceQuery = serviceQuery.eq('branch_id', branchId);

  const { data: services, error: svcError } = await serviceQuery;
  console.log('[Flow INIT] tenant_id:', tenantId, 'services found:', services?.length, 'error:', svcError);

  // Generate next 7 days in IST timezone
  const dates: Array<{ id: string; title: string }> = [];
  for (let i = 0; i < 7; i++) {
    const nowIST = new Date().toLocaleString('en-CA', { timeZone: 'Asia/Kolkata', hour12: false });
    const [todayIST] = nowIST.split(', ');
    const d = new Date(todayIST + 'T00:00:00');
    d.setDate(d.getDate() + i);
    const dateStr = d.toISOString().split('T')[0];
    const label = d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
    dates.push({ id: dateStr, title: label });
  }

  // Fetch blocked slots and booked appointments in parallel (if tenant known)
  let blockedSlotsByDate: Map<string, Set<string>> = new Map();
  let bookedSlotsByDate: Map<string, Array<{ start: string; end: string }>> = new Map();
  let maxPerSlot = 1;
  let slotDurationMinutes = 30;

  if (tenantId && dates.length > 0) {
    const firstDate = dates[0].id;
    const lastDate = dates[dates.length - 1].id;

    const [tenantRes, apptsRes] = await Promise.all([
      (admin.from('tenants' as any).select('settings').eq('id', tenantId).single() as any),
      (admin
        .from('appointments')
        .select('appointment_date, start_time, end_time')
        .eq('tenant_id', tenantId)
        .gte('appointment_date', firstDate)
        .lte('appointment_date', lastDate)
        .neq('status', 'cancelled') as any),
    ]);

    // Read capacity settings
    const tenantSettings = (tenantRes.data?.settings as any) ?? {};
    maxPerSlot = tenantSettings.max_appointments_per_slot || 1;
    slotDurationMinutes = tenantSettings.slot_duration_minutes || 30;

    // Build blocked slots map
    const blockedSlots: Array<{ date: string; slots: string[] }> = tenantSettings.blocked_slots || [];
    for (const entry of blockedSlots) {
      blockedSlotsByDate.set(entry.date, new Set(entry.slots));
    }

    // Build booked slots map
    if (apptsRes.data) {
      for (const appt of apptsRes.data) {
        const key = appt.appointment_date;
        if (!bookedSlotsByDate.has(key)) bookedSlotsByDate.set(key, []);
        bookedSlotsByDate.get(key)!.push({ start: appt.start_time, end: appt.end_time });
      }
    }
  }

  // Generate time slots (9 AM to 8 PM) at the configured interval
  const allTimeSlots: Array<{ id: string; title: string }> = [];
  for (let min = 9 * 60; min < 20 * 60; min += slotDurationMinutes) {
    const hour = Math.floor(min / 60);
    const m = min % 60;
    const h = hour % 12 || 12;
    const period = hour >= 12 ? 'PM' : 'AM';
    const timeStr = `${String(hour).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`;
    const label = `${h}:${String(m).padStart(2, '0')} ${period}`;
    allTimeSlots.push({ id: timeStr, title: label });
  }

  // Filter: only show slots available on at least one of the 7 dates
  const allDates = dates.map((d) => d.id);
  const filteredTimeSlots = allTimeSlots.filter((slot) => {
    const slotHHMM = slot.id.substring(0, 5);
    const slotMin = toMinutes(slotHHMM);
    const slotEndMin = slotMin + slotDurationMinutes;

    return allDates.some((dateStr) => {
      if (blockedSlotsByDate.get(dateStr)?.has(slotHHMM)) return false;
      const booked = bookedSlotsByDate.get(dateStr) || [];
      const overlapCount = booked.filter((appt) => {
        const apptStart = toMinutes(appt.start);
        const apptEnd = toMinutes(appt.end);
        return slotMin < apptEnd && slotEndMin > apptStart;
      }).length;
      return overlapCount < maxPerSlot;
    });
  });

  return {
    version: '3.0',
    screen: 'BOOKING_SCREEN',
    data: {
      services: (services && services.length > 0)
        ? services.map((s: any) => ({
            id: s.id,
            title: `${s.name} - Rs.${s.price}`,
          }))
        : [{ id: 'none', title: 'No services available' }],
      dates: dates.length > 0 ? dates : [{ id: 'none', title: 'No dates available' }],
      time_slots: filteredTimeSlots.length > 0
        ? filteredTimeSlots
        : [{ id: 'none', title: 'No slots available' }],
    },
  };
}

async function handleDataExchange(screen: string, data: any, flowToken: string) {
  if (screen === 'BOOKING_SCREEN') {
    // If only date is selected (no time_slot yet), return filtered slots for that date
    if (data?.date && !data?.time_slot) {
      return await handleDateSelected(data, flowToken);
    }
    return await processBooking(data, flowToken);
  }
  return { version: '3.0', screen: 'BOOKING_SCREEN', data: {} };
}

/**
 * Called when customer selects a date — returns filtered time slots for that specific date.
 * This removes already-booked and admin-blocked slots from the list dynamically.
 */
async function handleDateSelected(data: any, flowToken: string) {
  const { date } = data;
  if (!date) return { version: '3.0', screen: 'BOOKING_SCREEN', data: {} };

  let tokenData: any = {};
  try { tokenData = JSON.parse(flowToken); } catch {}
  const tenantId = tokenData.tenant_id || data?.tenant_id || '';

  const admin = createAdminClient();

  // Fetch blocked slots, booked appointments, and capacity for this specific date in parallel
  const [tenantRes, apptsRes] = await Promise.all([
    tenantId
      ? (admin.from('tenants' as any).select('settings').eq('id', tenantId).single() as any)
      : Promise.resolve({ data: null }),
    tenantId
      ? (admin
          .from('appointments')
          .select('start_time, end_time')
          .eq('tenant_id', tenantId)
          .eq('appointment_date', date)
          .neq('status', 'cancelled') as any)
      : Promise.resolve({ data: [] }),
  ]);

  // Build blocked set for this date
  const blockedSlots: Array<{ date: string; slots: string[] }> =
    (tenantRes.data?.settings as any)?.blocked_slots || [];
  const blockedForDate = blockedSlots.find((b: any) => b.date === date);
  const blockedTimes = new Set(blockedForDate?.slots || []);

  // Capacity
  const maxPerSlot: number = (tenantRes.data?.settings as any)?.max_appointments_per_slot || 1;
  const slotDuration: number = (tenantRes.data?.settings as any)?.slot_duration_minutes || 30;

  // Build booked set for this date
  const bookedAppts: Array<{ start_time: string; end_time: string }> = apptsRes.data || [];

  // IST now for past-slot filtering
  const nowIST = new Date().toLocaleString('en-CA', { timeZone: 'Asia/Kolkata', hour12: false });
  const [todayIST, todayTimeStr] = nowIST.split(', ');
  const [nowH, nowM] = (todayTimeStr || '00:00').split(':').map(Number);
  const isToday = date === todayIST;

  // Generate filtered time slots for this date at configured interval
  const filteredSlots: Array<{ id: string; title: string }> = [];
  for (let min = 9 * 60; min < 20 * 60; min += slotDuration) {
    const hour = Math.floor(min / 60);
    const m = min % 60;
    const slotHHMM = `${String(hour).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    const timeStr = `${slotHHMM}:00`;

    // Skip past slots (today only, with 1-hour buffer)
    if (isToday && min <= nowH * 60 + nowM + 60) continue;

    // Skip blocked slots
    if (blockedTimes.has(slotHHMM)) continue;

    // Capacity check
    const slotEnd = min + slotDuration;
    const overlapCount = bookedAppts.filter((appt) => {
      const apptStart = toMinutes(appt.start_time);
      const apptEnd = toMinutes(appt.end_time);
      return min < apptEnd && slotEnd > apptStart;
    }).length;
    if (overlapCount >= maxPerSlot) continue;

    const h = hour % 12 || 12;
    const period = hour >= 12 ? 'PM' : 'AM';
    const label = `${h}:${String(m).padStart(2, '0')} ${period}`;
    filteredSlots.push({ id: timeStr, title: label });
  }

  return {
    version: '3.0',
    screen: 'BOOKING_SCREEN',
    data: {
      time_slots: filteredSlots.length > 0
        ? filteredSlots
        : [{ id: 'none', title: 'No slots available for this date' }],
    },
  };
}

async function processBooking(data: any, flowToken: string) {
  const { service_ids, service_id, date, time_slot, customer_name, customer_phone, gender } = data;

  let tokenData: any = {};
  try { tokenData = JSON.parse(flowToken); } catch {}
  const customerPhone = tokenData.phone || customer_phone || '';
  const salonName = tokenData.salon_name || '';
  const isReschedule = tokenData.is_reschedule === true;
  const existingCustomerId = tokenData.customer_id || '';
  const existingCustomerName = tokenData.customer_name || '';

  const selectedServiceIds: string[] = service_ids
    ? (Array.isArray(service_ids) ? service_ids : [service_ids])
    : (service_id ? [service_id] : []);

  if (selectedServiceIds.length === 0 || !date || !time_slot) {
    return { version: '3.0', screen: 'BOOKING_SCREEN', data: { error_message: 'Please fill all fields.' } };
  }

  const admin = createAdminClient();
  const phoneE164 = customerPhone ? (customerPhone.startsWith('+') ? customerPhone : `+${customerPhone}`) : '';
  const customerName = existingCustomerName || customer_name || 'WhatsApp Customer';

  // ── PARALLEL FETCH: services + tenant settings + existing appointments + customer ──
  const [servicesRes, tenantRes, existingApptsRes, customerRes] = await Promise.all([
    admin.from('services').select('id, name, price, duration_minutes, tenant_id, branch_id').in('id', selectedServiceIds),
    (admin.from('tenants' as any).select('settings').eq('id', tokenData.tenant_id || '').single() as any),
    tokenData.tenant_id ? (admin.from('appointments').select('start_time, end_time, customer_id').eq('tenant_id', tokenData.tenant_id).eq('appointment_date', date).neq('status', 'cancelled') as any) : Promise.resolve({ data: [] }),
    existingCustomerId
      ? Promise.resolve({ data: { id: existingCustomerId } })
      : phoneE164
        ? (admin.from('customers').select('id').eq('phone', phoneE164).eq('tenant_id', tokenData.tenant_id || '').maybeSingle() as any)
        : Promise.resolve({ data: null }),
  ]);

  const services = servicesRes.data;
  if (!services || services.length === 0) {
    return { version: '3.0', screen: 'BOOKING_SCREEN', data: { error_message: 'Service not found.' } };
  }

  const primaryService = services[0];
  const totalDuration = services.reduce((sum: number, s: any) => sum + s.duration_minutes, 0);
  const [startH, startM] = time_slot.split(':').map(Number);
  const totalMin = startH * 60 + startM + totalDuration;
  const endTime = `${String(Math.floor(totalMin / 60)).padStart(2, '0')}:${String(totalMin % 60).padStart(2, '0')}:00`;

  // ── VALIDATIONS (using already-fetched data, no extra DB calls) ──
  const tenantSettings = (tenantRes.data?.settings as any) ?? {};
  const blockedSlots: Array<{ date: string; slots: string[] }> = tenantSettings.blocked_slots || [];
  const blockedForDate = blockedSlots.find((b: any) => b.date === date);
  const slotTime = time_slot.substring(0, 5);
  if (blockedForDate?.slots.includes(slotTime)) {
    return { version: '3.0', screen: 'BOOKING_SCREEN', data: { error_message: 'This time slot is not available. Please choose another time.' } };
  }

  const allAppts: any[] = existingApptsRes.data || [];
  const slotStart = toMinutes(time_slot);
  const slotEnd = slotStart + totalDuration;
  const maxPerSlot: number = tenantSettings.max_appointments_per_slot || 1;

  const overlapCount = allAppts.filter((appt: any) => {
    const apptStart = toMinutes(appt.start_time);
    const apptEnd = toMinutes(appt.end_time);
    return slotStart < apptEnd && slotEnd > apptStart;
  }).length;
  if (overlapCount >= maxPerSlot) {
    return { version: '3.0', screen: 'BOOKING_SCREEN', data: { error_message: 'This time slot is fully booked. Please choose another time.' } };
  }

  // Past slot check
  const nowIST = new Date().toLocaleString('en-CA', { timeZone: 'Asia/Kolkata', hour12: false });
  const [todayDate, todayTime] = nowIST.split(', ');
  if (date === todayDate) {
    const [nowH, nowM] = todayTime.split(':').map(Number);
    const [slotH, slotM] = time_slot.split(':').map(Number);
    if (slotH * 60 + slotM <= nowH * 60 + nowM + 60) {
      return { version: '3.0', screen: 'BOOKING_SCREEN', data: { error_message: 'This time slot is no longer available. Please select a later time (at least 1 hour from now).' } };
    }
  }

  // ── RESOLVE CUSTOMER (create if needed) ──
  let customerId: string | null = existingCustomerId || customerRes.data?.id || null;

  if (!customerId && customerName !== 'WhatsApp Customer') {
    const { data: byName } = await (admin.from('customers').select('id').eq('name', customerName).eq('tenant_id', primaryService.tenant_id).limit(1).maybeSingle() as any);
    customerId = byName?.id ?? null;
  }

  if (!customerId) {
    const { data: newCust } = await (admin.from('customers').insert({
      tenant_id: primaryService.tenant_id,
      branch_id: primaryService.branch_id,
      name: customerName,
      phone: phoneE164 || '+910000000000',
      gender: gender || null,
    } as any).select('id').single() as any);
    customerId = newCust?.id ?? null;
  }

  if (!customerId) {
    return { version: '3.0', screen: 'BOOKING_SCREEN', data: { error_message: 'Could not create booking. Please try again.' } };
  }

  // Per-customer daily limit check (using already-fetched allAppts)
  const customerAppts = allAppts.filter((a: any) => a.customer_id === customerId);
  if (customerAppts.length >= 2) {
    return { version: '3.0', screen: 'BOOKING_SCREEN', data: { error_message: 'You can only book up to 2 appointments per day. Please choose a different date.' } };
  }
  const alreadyBooked = customerAppts.some((appt: any) => {
    const apptStart = toMinutes(appt.start_time);
    const apptEnd = toMinutes(appt.end_time);
    return slotStart < apptEnd && slotEnd > apptStart;
  });
  if (alreadyBooked) {
    return { version: '3.0', screen: 'BOOKING_SCREEN', data: { error_message: 'You already have an appointment at this time. Please choose a different slot.' } };
  }

  // ── PARALLEL: reschedule cancel + employee fetch ──
  const [, employeeRes] = await Promise.all([
    isReschedule ? (admin.from('appointments').update({ status: 'cancelled' } as any)
      .eq('customer_id', customerId).eq('tenant_id', primaryService.tenant_id)
      .in('status', ['booked', 'confirmed']).order('appointment_date', { ascending: true }).limit(1) as any)
      : Promise.resolve(null),
    admin.from('employees').select('id').eq('tenant_id', primaryService.tenant_id).eq('is_active', true).limit(1).single(),
  ]);

  const assignedEmployeeId = employeeRes.data?.id ?? customerId;

  // ── CREATE APPOINTMENT ──
  const { error: apptError } = await (admin.from('appointments').insert({
    tenant_id: primaryService.tenant_id,
    branch_id: primaryService.branch_id,
    customer_id: customerId,
    service_id: selectedServiceIds[0],
    employee_id: assignedEmployeeId,
    appointment_date: date,
    start_time: time_slot,
    end_time: endTime,
    status: 'booked',
    source: 'whatsapp_flow',
    whatsapp_flow_ref: JSON.stringify(selectedServiceIds),
  } as any).select('id').single() as any);

  if (apptError) {
    console.error('[Flow] Appointment insert error:', apptError);
    return { version: '3.0', screen: 'BOOKING_SCREEN', data: { error_message: 'This slot is fully booked. Please choose another time.' } };
  }

  // ── RETURN SUCCESS IMMEDIATELY — send notifications in background ──
  const credentials = getPlatformCredentials();
  if (credentials && (customerPhone || customer_phone)) {
    const serviceNames = services.map((s: any) => s.name).join(', ');
    const dateLabel = new Date(date + 'T12:00:00+05:30').toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric' });
    const timeLabel = formatTime12h(time_slot);
    const dateTimeFormatted = `${dateLabel}, ${timeLabel}`;
    const calendarToken = Buffer.from([serviceNames + ' at ' + (salonName || 'Salon'), date, time_slot, endTime, salonName || ''].join('|')).toString('base64url');

    // Fire-and-forget: don't await notifications — return SUCCESS to Meta immediately
    Promise.all([
      // Customer confirmation
      import('@/lib/whatsapp/templates').then(({ sendMessage }) =>
        sendMessage(credentials, customerPhone || customer_phone, {
          type: 'template',
          template: {
            name: isReschedule ? 'appointment_rescheduled_v1' : 'booking_confirmation_v2',
            language: { code: 'en' },
            components: [
              { type: 'body', parameters: [
                { type: 'text', text: customerName },
                { type: 'text', text: serviceNames },
                { type: 'text', text: dateTimeFormatted },
                { type: 'text', text: salonName || 'Your Salon' },
              ]},
              { type: 'button', sub_type: 'url', index: '2', parameters: [{ type: 'text', text: calendarToken }] },
            ],
          },
        })
      ),
      // Owner notification + in-app notification (fire-and-forget)
      isReschedule
        ? notifyOwnerReschedule(admin, credentials, primaryService.tenant_id, salonName || 'Your Salon', customerName, customerPhone || customer_phone, services.map((s: any) => s.name).join(', '), dateTimeFormatted)
        : notifyOwnerNewBooking(admin, credentials, primaryService.tenant_id, salonName || 'Your Salon', customerName, customerPhone || customer_phone, services.map((s: any) => s.name).join(', '), dateTimeFormatted),
      // In-app notification for dashboard bell
      createNotification(
        primaryService.tenant_id,
        isReschedule ? 'reschedule' : 'new_booking',
        isReschedule ? `Appointment Rescheduled` : `New Booking`,
        isReschedule
          ? `${customerName} rescheduled to ${dateTimeFormatted}`
          : `${customerName} booked ${services.map((s: any) => s.name).join(', ')} on ${dateTimeFormatted}`,
        { customer_name: customerName, customer_phone: customerPhone || customer_phone }
      ),
    ]).catch(err => console.error('[Flow] Background notification error:', err));
  }

  return {
    version: '3.0',
    screen: 'SUCCESS',
    data: { extension_message_response: { params: { flow_token: flowToken } } },
  };
}

function formatTime12h(time: string): string {
  const [h, m] = time.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${period}`;
}
