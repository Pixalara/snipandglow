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

/**
 * GET /api/whatsapp/flow â€” Health check fallback
 */
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

    // Health check â€” Meta sends a ping to verify endpoint is alive
    if (!body.encrypted_aes_key && !body.encrypted_flow_data) {
      console.log('[Flow] No encrypted data â€” returning init data');
      const initData = await handleFlowInit({});
      return NextResponse.json(initData);
    }

    // Decrypt the request
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
      // Return fallback data so form isn't empty
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

    // Process the flow request
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

async function handleFlowInit(data: any) {
  const admin = createAdminClient();

  const tenantId = data?.tenant_id;
  const branchId = data?.branch_id;

  // Fetch active services â€” if no tenant specified, get all (for shared mode)
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

  // Generate next 14 days
  const dates: Array<{ id: string; title: string }> = [];
  for (let i = 0; i < 14; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    const dateStr = d.toISOString().split('T')[0];
    const label = d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
    dates.push({ id: dateStr, title: label });
  }

  // Generate time slots (9 AM to 8 PM)
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
      services: (services && services.length > 0) ? services.map((s: any) => ({
        id: s.id,
        title: `${s.name} - Rs.${s.price} (${s.duration_minutes} min)`,
      })) : [{ id: 'none', title: 'No services available' }],
      dates: dates.length > 0 ? dates : [{ id: 'none', title: 'No dates available' }],
      time_slots: timeSlots.length > 0 ? timeSlots : [{ id: 'none', title: 'No slots available' }],
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

  // Parse flow_token to get customer phone and tenant info
  let tokenData: any = {};
  try {
    tokenData = JSON.parse(flowToken);
  } catch {}
  const customerPhone = tokenData.phone || customer_phone || '';
  const tokenTenantId = tokenData.tenant_id || '';
  const tokenBranchId = tokenData.branch_id || '';
  const salonName = tokenData.salon_name || '';
  const isReschedule = tokenData.is_reschedule === true;
  const existingCustomerId = tokenData.customer_id || '';
  const existingCustomerName = tokenData.customer_name || '';

  // Handle both single service_id and multiple service_ids
  const selectedServiceIds: string[] = service_ids 
    ? (Array.isArray(service_ids) ? service_ids : [service_ids])
    : (service_id ? [service_id] : []);

  if (selectedServiceIds.length === 0 || !date || !time_slot) {
    return {
      version: '3.0',
      screen: 'BOOKING_SCREEN',
      data: { error_message: 'Please fill all fields.' },
    };
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

  // Calculate end time based on total duration
  const [startH, startM] = time_slot.split(':').map(Number);
  const totalMin = startH * 60 + startM + totalDuration;
  const endTime = `${String(Math.floor(totalMin / 60)).padStart(2, '0')}:${String(totalMin % 60).padStart(2, '0')}:00`;

  // Create customer with gender
  const customerName = existingCustomerName || customer_name || 'WhatsApp Customer';
  let customerId: string | null = existingCustomerId || null;
  const phoneE164 = customerPhone ? (customerPhone.startsWith('+') ? customerPhone : `+${customerPhone}`) : '';

  // If we already have customer_id from flow_token (returning customer), skip lookup
  if (!customerId && phoneE164) {
    const { data: existing } = await (admin.from('customers').select('id').eq('phone', phoneE164).eq('tenant_id', primaryService.tenant_id).single() as any);
    if (existing) {
      customerId = existing.id;
      // Update gender if provided
      if (gender) {
        await (admin.from('customers').update({ gender } as any).eq('id', existing.id) as any);
      }
    }
  }

  if (!customerId && customerName !== 'WhatsApp Customer') {
    const { data: byName } = await (admin.from('customers').select('id').eq('name', customerName).eq('tenant_id', primaryService.tenant_id).limit(1).single() as any);
    if (byName) {
      customerId = byName.id;
      if (gender) {
        await (admin.from('customers').update({ gender } as any).eq('id', byName.id) as any);
      }
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

  // If reschedule: cancel the customer's existing active appointment
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

  // Get first available employee
  const { data: employee } = await admin.from('employees').select('id').eq('tenant_id', primaryService.tenant_id).eq('is_active', true).limit(1).single();

  // Create appointment with all selected services
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

  // Send confirmation with all service names
  const serviceNames = services.map((s: any) => s.name).join(', ');
  const credentials = getPlatformCredentials();
  if (credentials && (customerPhone || customer_phone)) {
    const { sendMessage } = await import('@/lib/whatsapp/templates');
    const { buildShortCalendarLink } = await import('@/lib/google-calendar');
    const dateLabel = new Date(date + 'T00:00:00+05:30').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    const timeLabel = formatTime12h(time_slot);

    // Build short calendar link
    const calendarLink = buildShortCalendarLink({
      title: `${serviceNames} at ${salonName || 'Salon'}`,
      startDate: date,
      startTime: time_slot,
      endTime: endTime,
      location: salonName || 'Salon',
    });

    const confirmText = isReschedule
      ? `✅ *Appointment Rescheduled!*\n\n👤 ${customerName}\n✂️ ${serviceNames}\n📅 ${dateLabel}, ${timeLabel}\n📍 ${salonName || 'Your Salon'}\n\n📲 *Add to Google Calendar:*\n${calendarLink}\n\nSee you soon! 😊`
      : `✅ *Booking Confirmed!*\n\n👤 ${customerName}\n✂️ ${serviceNames}\n📅 ${dateLabel}, ${timeLabel}\n📍 ${salonName || 'Your Salon'}\n\n📲 *Add to Google Calendar:*\n${calendarLink}\n\nSee you soon! 😊`;

    await sendMessage(credentials, customerPhone || customer_phone, {
      type: 'interactive',
      interactive: {
        type: 'button',
        body: { text: confirmText },
        action: {
          buttons: [
            { type: 'reply', reply: { id: 'reschedule_appointment', title: 'Reschedule' } },
            { type: 'reply', reply: { id: 'cancel_appointment', title: 'Cancel' } },
          ],
        },
      },
    });

    // Send notification to salon owner
    const { data: tenantOwner } = await admin
      .from('tenants')
      .select('phone')
      .eq('id', primaryService.tenant_id)
      .single();

    if (tenantOwner?.phone && credentials) {
      const ownerPhone = tenantOwner.phone.replace(/\D/g, '');
      const dateLabel2 = new Date(date + 'T00:00:00+05:30').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
      const timeLabel2 = formatTime12h(time_slot);

      const ownerText = isReschedule
        ? `📅 Appointment Rescheduled\n\nCustomer: ${customerName}\nPhone: +${customerPhone || customer_phone}\nServices: ${serviceNames}\nNew Date: ${dateLabel2}\nNew Time: ${timeLabel2}\n\nThe customer rescheduled via WhatsApp. Check your dashboard.`
        : `🆕 New Booking Alert!\n\nCustomer: ${customerName}\nPhone: +${customerPhone || customer_phone}\nServices: ${serviceNames}\nDate: ${dateLabel2}\nTime: ${timeLabel2}\n\nCheck your SnipandGlow dashboard for details.`;

      await sendMessage(credentials, ownerPhone, {
        type: 'text',
        text: { body: ownerText },
      });
    }
  }

  return {
    version: '3.0',
    screen: 'SUCCESS',
    data: {
      extension_message_response: {
        params: { flow_token: flowToken },
      },
    },
  };
}

function formatTime12h(time: string): string {
  const [h, m] = time.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${period}`;
}
