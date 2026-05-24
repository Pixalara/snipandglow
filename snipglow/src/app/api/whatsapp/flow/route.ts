import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getPlatformCredentials } from '@/lib/whatsapp/config';
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

  // Generate next 14 days in IST timezone
  const dates: Array<{ id: string; title: string }> = [];
  for (let i = 0; i < 14; i++) {
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

    // Build blocked slots map
    const blockedSlots: Array<{ date: string; slots: string[] }> =
      (tenantRes.data?.settings as any)?.blocked_slots || [];
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

  // Generate all time slots (9 AM to 8 PM at 30-min intervals)
  const allTimeSlots: Array<{ id: string; title: string }> = [];
  for (let hour = 9; hour < 20; hour++) {
    for (const min of [0, 30]) {
      const h = hour % 12 || 12;
      const period = hour >= 12 ? 'PM' : 'AM';
      const timeStr = `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}:00`;
      const label = `${h}:${String(min).padStart(2, '0')} ${period}`;
      allTimeSlots.push({ id: timeStr, title: label });
    }
  }

  // Filter: only show slots that are available on at least one of the 14 dates
  // This removes slots that are blocked/booked on EVERY single date (permanently unavailable)
  const allDates = dates.map((d) => d.id);
  const filteredTimeSlots = allTimeSlots.filter((slot) => {
    const slotHHMM = slot.id.substring(0, 5); // "09:00:00" -> "09:00"
    const slotMin = toMinutes(slotHHMM);
    const slotEndMin = slotMin + 30;

    // Keep if available on at least one date
    return allDates.some((dateStr) => {
      // Skip if blocked on this date
      if (blockedSlotsByDate.get(dateStr)?.has(slotHHMM)) return false;
      // Skip if overlaps a booked appointment on this date
      const booked = bookedSlotsByDate.get(dateStr) || [];
      const isBooked = booked.some((appt) => {
        const apptStart = toMinutes(appt.start);
        const apptEnd = toMinutes(appt.end);
        return slotMin < apptEnd && slotEndMin > apptStart;
      });
      return !isBooked;
    });
  });

  return {
    version: '3.0',
    screen: 'BOOKING_SCREEN',
    data: {
      services: (services && services.length > 0)
        ? services.map((s: any) => ({
            id: s.id,
            title: `${s.name} - Rs.${s.price} (${s.duration_minutes} min)`,
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
    return await processBooking(data, flowToken);
  }
  return { version: '3.0', screen: 'BOOKING_SCREEN', data: {} };
}

async function processBooking(data: any, flowToken: string) {
  const { service_ids, service_id, date, time_slot, customer_name, customer_phone, gender } = data;

  console.log('[Flow Booking] Full data:', JSON.stringify(data));

  let tokenData: any = {};
  try {
    tokenData = JSON.parse(flowToken);
  } catch {}
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

  // Fetch all selected services
  const { data: services } = await admin
    .from('services')
    .select('id, name, price, duration_minutes, tenant_id, branch_id')
    .in('id', selectedServiceIds);

  if (!services || services.length === 0) {
    return { version: '3.0', screen: 'BOOKING_SCREEN', data: { error_message: 'Service not found.' } };
  }

  const primaryService = services[0];
  const totalDuration = services.reduce((sum: number, s: any) => sum + s.duration_minutes, 0);

  // Calculate end time
  const [startH, startM] = time_slot.split(':').map(Number);
  const totalMin = startH * 60 + startM + totalDuration;
  const endTime = `${String(Math.floor(totalMin / 60)).padStart(2, '0')}:${String(totalMin % 60).padStart(2, '0')}:00`;

  const customerName = existingCustomerName || customer_name || 'WhatsApp Customer';
  let customerId: string | null = existingCustomerId || null;
  const phoneE164 = customerPhone ? (customerPhone.startsWith('+') ? customerPhone : `+${customerPhone}`) : '';

  if (!customerId && phoneE164) {
    const { data: existing } = await (admin.from('customers').select('id').eq('phone', phoneE164).eq('tenant_id', primaryService.tenant_id).single() as any);
    if (existing) {
      customerId = existing.id;
      if (gender) await (admin.from('customers').update({ gender } as any).eq('id', existing.id) as any);
    }
  }

  if (!customerId && customerName !== 'WhatsApp Customer') {
    const { data: byName } = await (admin.from('customers').select('id').eq('name', customerName).eq('tenant_id', primaryService.tenant_id).limit(1).single() as any);
    if (byName) {
      customerId = byName.id;
      if (gender) await (admin.from('customers').update({ gender } as any).eq('id', byName.id) as any);
    }
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

  // If reschedule: cancel existing active appointment
  if (isReschedule && customerId) {
    await (admin
      .from('appointments')
      .update({ status: 'cancelled' } as any)
      .eq('customer_id', customerId)
      .eq('tenant_id', primaryService.tenant_id)
      .in('status', ['booked', 'confirmed'])
      .order('appointment_date', { ascending: true })
      .limit(1) as any);
  }

  // Validate: check blocked slots
  const { data: tenantCheck } = await (admin.from('tenants' as any).select('settings').eq('id', primaryService.tenant_id).single() as any);
  const blockedSlots: Array<{ date: string; slots: string[] }> = (tenantCheck?.settings as any)?.blocked_slots || [];
  const blockedForDate = blockedSlots.find((b: any) => b.date === date);
  const slotTime = time_slot.substring(0, 5); // "09:00:00" -> "09:00"
  if (blockedForDate?.slots.includes(slotTime)) {
    return { version: '3.0', screen: 'BOOKING_SCREEN', data: { error_message: 'This time slot is not available. Please choose another time.' } };
  }

  // Validate: check for overlapping existing appointments
  const { data: existingAppts } = await (admin
    .from('appointments')
    .select('start_time, end_time')
    .eq('tenant_id', primaryService.tenant_id)
    .eq('appointment_date', date)
    .neq('status', 'cancelled') as any);

  if (existingAppts && existingAppts.length > 0) {
    const slotStart = toMinutes(time_slot);
    const slotEnd = slotStart + totalDuration;
    const hasOverlap = existingAppts.some((appt: any) => {
      const apptStart = toMinutes(appt.start_time);
      const apptEnd = toMinutes(appt.end_time);
      return slotStart < apptEnd && slotEnd > apptStart;
    });
    if (hasOverlap) {
      return { version: '3.0', screen: 'BOOKING_SCREEN', data: { error_message: 'This time slot is already booked. Please choose another time.' } };
    }
  }

  // Validate: check if slot is in the past (1-hour buffer, IST)
  const nowIST = new Date().toLocaleString('en-CA', { timeZone: 'Asia/Kolkata', hour12: false });
  const [todayDate, todayTime] = nowIST.split(', ');
  if (date === todayDate) {
    const [nowH, nowM] = todayTime.split(':').map(Number);
    const [slotH, slotM] = time_slot.split(':').map(Number);
    if (slotH * 60 + slotM <= nowH * 60 + nowM + 60) {
      return { version: '3.0', screen: 'BOOKING_SCREEN', data: { error_message: 'This time slot is no longer available. Please select a later time (at least 1 hour from now).' } };
    }
  }

  // Get first available employee
  const { data: employee } = await admin
    .from('employees')
    .select('id')
    .eq('tenant_id', primaryService.tenant_id)
    .eq('is_active', true)
    .limit(1)
    .single();

  // Create appointment
  const { error: apptError } = await (admin.from('appointments').insert({
    tenant_id: primaryService.tenant_id,
    branch_id: primaryService.branch_id,
    customer_id: customerId,
    service_id: selectedServiceIds[0],
    employee_id: employee?.id ?? customerId,
    appointment_date: date,
    start_time: time_slot,
    end_time: endTime,
    status: 'booked',
    source: 'whatsapp_flow',
    whatsapp_flow_ref: JSON.stringify(selectedServiceIds),
  } as any).select('id').single() as any);

  if (apptError) {
    return { version: '3.0', screen: 'BOOKING_SCREEN', data: { error_message: 'Slot may be taken. Try another time.' } };
  }

  // Send confirmation messages
  const serviceNames = services.map((s: any) => s.name).join(', ');
  const credentials = getPlatformCredentials();
  if (credentials && (customerPhone || customer_phone)) {
    const { sendMessage } = await import('@/lib/whatsapp/templates');
    const dateLabel = new Date(date + 'T00:00:00+05:30').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    const timeLabel = formatTime12h(time_slot);
    const dateTimeFormatted = `${dateLabel}, ${timeLabel}`;
    const calendarToken = Buffer.from(
      [serviceNames + ' at ' + (salonName || 'Salon'), date, time_slot, endTime, salonName || ''].join('|')
    ).toString('base64url');

    if (isReschedule) {
      await sendMessage(credentials, customerPhone || customer_phone, {
        type: 'template',
        template: {
          name: 'appointment_rescheduled_v1',
          language: { code: 'en' },
          components: [
            {
              type: 'body',
              parameters: [
                { type: 'text', text: customerName },
                { type: 'text', text: serviceNames },
                { type: 'text', text: dateTimeFormatted },
                { type: 'text', text: salonName || 'Your Salon' },
              ],
            },
            { type: 'button', sub_type: 'url', index: '2', parameters: [{ type: 'text', text: calendarToken }] },
          ],
        },
      });
    } else {
      const templateResult = await sendMessage(credentials, customerPhone || customer_phone, {
        type: 'template',
        template: {
          name: 'booking_confirmation_v2',
          language: { code: 'en' },
          components: [
            {
              type: 'body',
              parameters: [
                { type: 'text', text: customerName },
                { type: 'text', text: serviceNames },
                { type: 'text', text: dateTimeFormatted },
                { type: 'text', text: salonName || 'Your Salon' },
              ],
            },
            { type: 'button', sub_type: 'url', index: '2', parameters: [{ type: 'text', text: calendarToken }] },
          ],
        },
      });
      console.log('[Flow] Template send result:', JSON.stringify(templateResult));
    }

    // Notify salon owner
    const { data: tenantOwner } = await admin.from('tenants').select('phone').eq('id', primaryService.tenant_id).single();
    console.log('[Flow] Owner notification - tenant phone:', tenantOwner?.phone);

    if (tenantOwner?.phone && credentials) {
      let ownerPhone = tenantOwner.phone.replace(/\D/g, '');
      if (ownerPhone.length === 10) ownerPhone = '91' + ownerPhone;
      console.log('[Flow] Sending owner notification to:', ownerPhone);

      const dateLabel2 = new Date(date + 'T00:00:00+05:30').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
      const timeLabel2 = formatTime12h(time_slot);
      const ownerText = isReschedule
        ? `📅 Appointment Rescheduled\n\nCustomer: ${customerName}\nPhone: +${customerPhone || customer_phone}\nServices: ${serviceNames}\nNew Date: ${dateLabel2}\nNew Time: ${timeLabel2}\n\nThe customer rescheduled via WhatsApp. Check your dashboard.`
        : `🆕 New Booking Alert!\n\nCustomer: ${customerName}\nPhone: +${customerPhone || customer_phone}\nServices: ${serviceNames}\nDate: ${dateLabel2}\nTime: ${timeLabel2}\n\nCheck your SnipandGlow dashboard for details.`;

      try {
        await sendMessage(credentials, ownerPhone, { type: 'text', text: { body: ownerText } });
        console.log('[Flow] Owner notification sent successfully');
      } catch (err) {
        console.error('[Flow] Failed to send owner notification:', err);
      }
    } else {
      console.log('[Flow] Owner notification skipped - phone:', tenantOwner?.phone, 'credentials:', !!credentials);
    }
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
