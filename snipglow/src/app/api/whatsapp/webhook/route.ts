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
        await sendMessage(tenant.credentials, phone, {
          type: 'interactive',
          interactive: {
            type: 'flow',
            body: { text: `Let's book your appointment at *${tenant.salonName}*! Fill in the details below:` },
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
                  data: { customer_name: name, customer_phone: phone, tenant_id: tenant.tenantId, branch_id: tenant.branchId },
                },
              },
            },
          },
        });
      } else {
        await sendMessage(tenant.credentials, phone, {
          type: 'text',
          text: { body: `To book at ${tenant.salonName}, please share:\n\n1. Service you want\n2. Preferred date\n3. Preferred time\n\nOur team will confirm shortly!` },
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

    default:
      console.log(`[Webhook] Unhandled button: ${buttonId} from ${phone}`);
  }
}
