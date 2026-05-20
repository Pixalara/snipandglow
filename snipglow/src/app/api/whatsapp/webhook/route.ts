import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getWebhookVerifyToken, getAppSecret, getPlatformCredentials } from '@/lib/whatsapp/config';
import { resolveTenant, type TenantContext } from '@/lib/whatsapp/tenant-router';
import { sendMessage } from '@/lib/whatsapp/templates';
import crypto from 'crypto';

// =============================================================================
// WhatsApp Webhook — Multi-Tenant (Shared + Dedicated mode)
// =============================================================================

/**
 * GET — Meta webhook verification challenge.
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  if (mode === 'subscribe' && token === getWebhookVerifyToken()) {
    return new NextResponse(challenge, { status: 200 });
  }

  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}

/**
 * POST — Receives incoming messages and delivery statuses.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.text();

    // Verify signature
    const appSecret = getAppSecret();
    if (appSecret) {
      const signature = request.headers.get('x-hub-signature-256');
      if (signature) {
        const expected = 'sha256=' + crypto.createHmac('sha256', appSecret).update(body).digest('hex');
        if (signature !== expected) {
          return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
        }
      }
    }

    const payload = JSON.parse(body);

    for (const entry of payload.entry ?? []) {
      for (const change of entry.changes ?? []) {
        if (change.field !== 'messages') continue;
        const value = change.value;

        // Handle status updates
        if (value.statuses) {
          await handleStatuses(value.statuses);
        }

        // Handle incoming messages
        if (value.messages) {
          await handleMessages(value.messages, value.contacts, value.metadata);
        }
      }
    }

    return NextResponse.json({ status: 'ok' }, { status: 200 });
  } catch (err) {
    console.error('[Webhook] Error:', err);
    return NextResponse.json({ status: 'ok' }, { status: 200 });
  }
}

// =============================================================================
// Status Handler
// =============================================================================

async function handleStatuses(statuses: any[]) {
  const admin = createAdminClient();
  for (const s of statuses) {
    await (admin.from('whatsapp_sessions').update({ status: s.status }).eq('message_id', s.id) as any);
  }
}

// =============================================================================
// Message Handler — Routes to correct tenant
// =============================================================================

async function handleMessages(messages: any[], contacts: any[], metadata: any) {
  const admin = createAdminClient();
  const phoneNumberId = metadata?.phone_number_id ?? '';

  for (const message of messages) {
    const contact = contacts?.find((c: any) => c.wa_id === message.from);
    const customerName = contact?.profile?.name ?? 'Customer';
    const customerPhone = message.from;

    // Extract message content
    let messageText = '';
    let buttonReplyId = '';

    if (message.type === 'text') {
      messageText = message.text?.body ?? '';
    } else if (message.type === 'interactive') {
      buttonReplyId = message.interactive?.button_reply?.id ?? message.interactive?.list_reply?.id ?? '';
      messageText = message.interactive?.button_reply?.title ?? message.interactive?.list_reply?.title ?? '';
    } else if (message.type === 'button') {
      buttonReplyId = message.button?.payload ?? '';
      messageText = message.button?.text ?? '';
    }

    // Log incoming message
    try {
      await (admin.from('whatsapp_sessions').insert({
        message_id: message.id,
        phone: customerPhone,
        direction: 'inbound',
        status: 'delivered',
        template_name: null,
        metadata: { customer_name: customerName, message_text: messageText, button_reply_id: buttonReplyId, phone_number_id: phoneNumberId },
      } as any) as any);
    } catch {}

    // ─── RESOLVE TENANT ─────────────────────────────────────────────────────
    const tenant = await resolveTenant(phoneNumberId, customerPhone, messageText);

    if (!tenant) {
      // Cannot resolve tenant — send fallback
      await sendFallbackMessage(customerPhone, messageText);
      continue;
    }

    // ─── ROUTE MESSAGE ──────────────────────────────────────────────────────
    if (buttonReplyId) {
      await handleButtonReply(tenant, customerPhone, customerName, buttonReplyId);
    } else if (messageText) {
      await handleTextMessage(tenant, customerPhone, customerName, messageText);
    }
  }
}

// =============================================================================
// Fallback — When tenant cannot be resolved
// =============================================================================

async function sendFallbackMessage(phone: string, messageText: string) {
  const credentials = getPlatformCredentials();
  if (!credentials) return;

  // Check if it's a booking slug that doesn't match any tenant
  const slug = messageText.trim().toUpperCase();
  if (slug.startsWith('BOOK_')) {
    await sendMessage(credentials, phone, {
      type: 'text',
      text: { body: 'Sorry, we could not find that salon. Please check the QR code and try again, or contact the salon directly.' },
    });
    return;
  }

  // Generic fallback
  await sendMessage(credentials, phone, {
    type: 'text',
    text: { body: 'Hi! 👋 To book an appointment, please scan the QR code at your salon or use the booking link provided by them.\n\nPowered by SnipandGlow — snipandglow.com' },
  });
}

// =============================================================================
// Text Message Handler
// =============================================================================

async function handleTextMessage(tenant: TenantContext, phone: string, name: string, text: string) {
  const lowerText = text.toLowerCase().trim();

  // Check if it's a booking slug (first message from QR)
  if (text.trim().toUpperCase().startsWith('BOOK_')) {
    await sendWelcomeMenu(tenant, phone, name);
    return;
  }

  // Greeting patterns
  const greetings = ['hi', 'hello', 'hey', 'hii', 'hiii', 'hai', 'namaste', 'good morning', 'good afternoon', 'good evening'];
  const bookingKeywords = ['book', 'appointment', 'booking', 'schedule'];
  const priceKeywords = ['price', 'prices', 'rate', 'rates', 'cost', 'menu', 'services', 'service'];

  if (greetings.some((g) => lowerText === g || lowerText.startsWith(g + ' '))) {
    await sendWelcomeMenu(tenant, phone, name);
  } else if (bookingKeywords.some((k) => lowerText.includes(k))) {
    await handleButtonReply(tenant, phone, name, 'book_appointment');
  } else if (priceKeywords.some((k) => lowerText.includes(k))) {
    await handleButtonReply(tenant, phone, name, 'services_prices');
  } else {
    // Unknown — show menu
    await sendWelcomeMenu(tenant, phone, name);
  }
}

// =============================================================================
// Welcome Menu
// =============================================================================

async function sendWelcomeMenu(tenant: TenantContext, phone: string, name: string) {
  const poweredBy = tenant.mode === 'shared' ? '\n\n_Powered by SnipandGlow_' : '';

  await sendMessage(tenant.credentials, phone, {
    type: 'interactive',
    interactive: {
      type: 'button',
      body: {
        text: `👋 Welcome to *${tenant.salonName}*!\n\nHi ${name}, how can we help you today?${poweredBy}`,
      },
      action: {
        buttons: [
          { type: 'reply', reply: { id: 'book_appointment', title: 'Book Appointment' } },
          { type: 'reply', reply: { id: 'services_prices', title: 'View Services' } },
          { type: 'reply', reply: { id: 'talk_to_salon', title: 'Talk to Salon' } },
        ],
      },
    },
  });
}

// =============================================================================
// Button Reply Handler
// =============================================================================

async function handleButtonReply(tenant: TenantContext, phone: string, name: string, buttonId: string) {
  const admin = createAdminClient();

  switch (buttonId) {
    case 'book_appointment': {
      const flowId = process.env.WHATSAPP_FLOW_ID;
      if (flowId) {
        // Fetch services for this tenant
        const { data: svcList } = await admin
          .from('services')
          .select('id, name, price, duration_minutes')
          .eq('tenant_id', tenant.tenantId)
          .eq('is_active', true)
          .order('name')
          .limit(10);

        const services = (svcList ?? []).map((s: any) => ({
          id: s.id,
          title: `${s.name} - Rs.${s.price} (${s.duration_minutes} min)`,
        }));

        // Generate next 14 days
        const dates: Array<{ id: string; title: string }> = [];
        for (let i = 0; i < 14; i++) {
          const d = new Date();
          d.setDate(d.getDate() + i);
          const dateStr = d.toISOString().split('T')[0];
          const label = d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
          dates.push({ id: dateStr, title: label });
        }

        // Generate time slots
        const timeSlots: Array<{ id: string; title: string }> = [];
        for (let hour = 9; hour < 20; hour++) {
          for (const min of [0, 30]) {
            const h = hour % 12 || 12;
            const period = hour >= 12 ? 'PM' : 'AM';
            const timeStr = `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}:00`;
            timeSlots.push({ id: timeStr, title: `${h}:${String(min).padStart(2, '0')} ${period}` });
          }
        }

        console.log('[Webhook] Sending flow with', services.length, 'services');

        await sendMessage(tenant.credentials, phone, {
          type: 'interactive',
          interactive: {
            type: 'flow',
            body: { text: `Book your appointment at *${tenant.salonName}*` },
            action: {
              name: 'flow',
              parameters: {
                flow_message_version: '3',
                flow_id: flowId,
                flow_cta: 'Book Now',
                mode: 'published',
                flow_action: 'navigate',
                flow_action_payload: {
                  screen: 'BOOKING_SCREEN',
                  data: {
                    services: services.length > 0 ? services : [{ id: 'none', title: 'No services' }],
                    dates,
                    time_slots: timeSlots,
                  },
                  flow_token: JSON.stringify({ phone, tenant_id: tenant.tenantId, branch_id: tenant.branchId, salon_name: tenant.salonName }),
                },
              },
            },
          },
        });
      } else {
        await sendMessage(tenant.credentials, phone, {
          type: 'text',
          text: { body: `To book at ${tenant.salonName}, please share:\n1. Service\n2. Date\n3. Time\n\nOur team will confirm shortly!` },
        });
      }
      break;
    }

    case 'services_prices': {
      const { data: services } = await admin
        .from('services')
        .select('name, price, duration_minutes')
        .eq('tenant_id', tenant.tenantId)
        .eq('branch_id', tenant.branchId)
        .eq('is_active', true)
        .order('name')
        .limit(10);

      if (services && services.length > 0) {
        const list = services.map((s: any) => `• ${s.name} — ₹${s.price} (${s.duration_minutes} min)`).join('\n');
        await sendMessage(tenant.credentials, phone, {
          type: 'interactive',
          interactive: {
            type: 'button',
            body: { text: `*${tenant.salonName} — Services & Prices:*\n\n${list}\n\nWant to book?` },
            action: {
              buttons: [
                { type: 'reply', reply: { id: 'book_appointment', title: 'Book Now' } },
              ],
            },
          },
        });
      } else {
        await sendMessage(tenant.credentials, phone, {
          type: 'text',
          text: { body: `Please contact ${tenant.salonName} directly for the service menu.` },
        });
      }
      break;
    }

    case 'talk_to_salon': {
      await sendMessage(tenant.credentials, phone, {
        type: 'text',
        text: { body: `You can reach *${tenant.salonName}* right here! Just type your message and the salon team will respond shortly. 😊` },
      });
      break;
    }

    case 'reschedule_appointment': {
      const flowId = process.env.WHATSAPP_FLOW_ID;
      if (flowId) {
        await sendMessage(tenant.credentials, phone, {
          type: 'interactive',
          interactive: {
            type: 'flow',
            body: { text: `Let's reschedule your appointment. Pick a new date and time:` },
            action: {
              name: 'flow',
              parameters: {
                flow_message_version: '3',
                flow_id: flowId,
                flow_cta: 'Reschedule',
                mode: 'published',
                flow_action: 'navigate',
                flow_action_payload: {
                  screen: 'BOOKING_SCREEN',
                  data: { customer_name: name, customer_phone: phone, tenant_id: tenant.tenantId, branch_id: tenant.branchId },
                },
              },
            },
          },
        });
      } else {
        await sendMessage(tenant.credentials, phone, {
          type: 'text',
          text: { body: `To reschedule, please share your preferred new date and time. The team will confirm shortly!` },
        });
      }
      break;
    }

    case 'cancel_appointment': {
      await sendMessage(tenant.credentials, phone, {
        type: 'interactive',
        interactive: {
          type: 'button',
          body: { text: `Are you sure you want to cancel your appointment at ${tenant.salonName}?` },
          action: {
            buttons: [
              { type: 'reply', reply: { id: 'confirm_cancel', title: 'Yes, Cancel' } },
              { type: 'reply', reply: { id: 'keep_appointment', title: 'Keep It' } },
            ],
          },
        },
      });
      break;
    }

    case 'confirm_cancel': {
      await sendMessage(tenant.credentials, phone, {
        type: 'text',
        text: { body: `Your appointment has been cancelled. We hope to see you again soon, ${name}!\n\nReply "Book" anytime to schedule a new appointment.` },
      });
      break;
    }

    case 'keep_appointment': {
      await sendMessage(tenant.credentials, phone, {
        type: 'text',
        text: { body: `Great! Your appointment is still on. See you soon! 😊` },
      });
      break;
    }

    default: {
      // Handle service selection from list (id starts with "svc_")
      if (buttonId.startsWith('svc_')) {
        const serviceId = buttonId.replace('svc_', '');
        
        // Store selected service in session and ask for date
        const dates: Array<{ id: string; title: string; description: string }> = [];
        for (let i = 0; i < 7; i++) {
          const d = new Date();
          d.setDate(d.getDate() + i);
          const dateStr = d.toISOString().split('T')[0];
          const label = d.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' });
          dates.push({ id: `dt.${serviceId}.${dateStr}`, title: label, description: dateStr });
        }

        await sendMessage(tenant.credentials, phone, {
          type: 'interactive',
          interactive: {
            type: 'list',
            body: { text: `Great choice! Now select a date for your appointment:` },
            action: {
              button: 'Select Date',
              sections: [
                {
                  title: 'Available Dates',
                  rows: dates,
                },
              ],
            },
          },
        });
        break;
      }

      // Handle date selection (id starts with "dt.")
      if (buttonId.startsWith('dt.')) {
        const parts = buttonId.split('.');
        // parts = ["dt", serviceId, dateStr]
        const serviceId = parts[1];
        const dateStr = parts[2];

        // Generate time slots
        const timeSlots: Array<{ id: string; title: string; description: string }> = [];
        for (let hour = 9; hour < 20; hour++) {
          const h = hour % 12 || 12;
          const period = hour >= 12 ? 'PM' : 'AM';
          const timeStr = `${String(hour).padStart(2, '0')}:00:00`;
          timeSlots.push({
            id: `tm.${serviceId}.${dateStr}.${timeStr}`,
            title: `${h}:00 ${period}`,
            description: `Available`,
          });
        }

        await sendMessage(tenant.credentials, phone, {
          type: 'interactive',
          interactive: {
            type: 'list',
            body: { text: `Select a time slot:` },
            action: {
              button: 'Select Time',
              sections: [
                {
                  title: 'Available Times',
                  rows: timeSlots,
                },
              ],
            },
          },
        });
        break;
      }

      // Handle time selection and create booking (id starts with "tm.")
      if (buttonId.startsWith('tm.')) {
        const parts = buttonId.split('.');
        // parts = ["tm", serviceId, dateStr, timeSlot]
        const serviceId = parts[1];
        const dateStr = parts[2];
        const timeSlot = parts[3];

        // Get service details
        const { data: service } = await admin
          .from('services')
          .select('id, name, price, duration_minutes, tenant_id, branch_id')
          .eq('id', serviceId)
          .single();

        if (!service) {
          await sendMessage(tenant.credentials, phone, { type: 'text', text: { body: 'Service not found. Please try again.' } });
          break;
        }

        // Calculate end time
        const [startH, startM] = timeSlot.split(':').map(Number);
        const totalMin = startH * 60 + startM + service.duration_minutes;
        const endTime = `${String(Math.floor(totalMin / 60)).padStart(2, '0')}:${String(totalMin % 60).padStart(2, '0')}:00`;

        // Find or create customer
        const phoneE164 = `+${phone}`;
        let customerId: string | null = null;
        const { data: existing } = await (admin.from('customers').select('id').eq('phone', phoneE164).eq('tenant_id', tenant.tenantId).single() as any);
        if (existing) {
          customerId = existing.id;
        } else {
          const { data: newCust } = await (admin.from('customers').insert({ tenant_id: tenant.tenantId, branch_id: service.branch_id, name: name, phone: phoneE164 } as any).select('id').single() as any);
          customerId = newCust?.id ?? null;
        }

        if (!customerId) {
          await sendMessage(tenant.credentials, phone, { type: 'text', text: { body: 'Could not create booking. Please try again.' } });
          break;
        }

        // Get first employee
        const { data: emp } = await admin.from('employees').select('id').eq('tenant_id', tenant.tenantId).eq('is_active', true).limit(1).single();

        // Create appointment
        await (admin.from('appointments').insert({
          tenant_id: tenant.tenantId,
          branch_id: service.branch_id,
          customer_id: customerId,
          service_id: serviceId,
          employee_id: emp?.id ?? customerId,
          appointment_date: dateStr,
          start_time: timeSlot,
          end_time: endTime,
          status: 'booked',
          source: 'whatsapp_flow',
          whatsapp_flow_ref: JSON.stringify([serviceId]),
        } as any) as any);

        // Send confirmation
        const dateLabel = new Date(dateStr + 'T00:00:00+05:30').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
        const h = startH % 12 || 12;
        const period = startH >= 12 ? 'PM' : 'AM';
        const timeLabel = `${h}:00 ${period}`;

        await sendMessage(tenant.credentials, phone, {
          type: 'interactive',
          interactive: {
            type: 'button',
            body: { text: `✅ *Booking Confirmed!*\n\n👤 ${name}\n✂️ ${service.name}\n📅 ${dateLabel}, ${timeLabel}\n📍 ${tenant.salonName}\n\nSee you soon! 😊` },
            action: {
              buttons: [
                { type: 'reply', reply: { id: 'reschedule_appointment', title: 'Reschedule' } },
                { type: 'reply', reply: { id: 'cancel_appointment', title: 'Cancel' } },
              ],
            },
          },
        });
        break;
      }

      console.log(`[Webhook] Unhandled button: ${buttonId} from ${phone}`);
    }
  }
}
