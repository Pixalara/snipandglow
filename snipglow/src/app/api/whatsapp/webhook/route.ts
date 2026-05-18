import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getWebhookVerifyToken, getAppSecret, getPlatformCredentials } from '@/lib/whatsapp/config';
import crypto from 'crypto';

// =============================================================================
// WhatsApp Webhook — Verification (GET) & Message Receiver (POST)
// =============================================================================

/**
 * GET /api/whatsapp/webhook
 * Meta webhook verification challenge.
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  const verifyToken = getWebhookVerifyToken();

  if (mode === 'subscribe' && token === verifyToken) {
    console.log('[WhatsApp Webhook] Verification successful');
    return new NextResponse(challenge, { status: 200 });
  }

  console.warn('[WhatsApp Webhook] Verification failed — token mismatch');
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}

/**
 * POST /api/whatsapp/webhook
 * Receives incoming messages, delivery statuses, and button replies.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.text();

    // Verify webhook signature (optional but recommended)
    const appSecret = getAppSecret();
    if (appSecret) {
      const signature = request.headers.get('x-hub-signature-256');
      if (signature) {
        const expectedSig = 'sha256=' + crypto
          .createHmac('sha256', appSecret)
          .update(body)
          .digest('hex');

        if (signature !== expectedSig) {
          console.warn('[WhatsApp Webhook] Invalid signature');
          return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
        }
      }
    }

    const payload = JSON.parse(body);

    // Process each entry
    const entries = payload.entry ?? [];
    for (const entry of entries) {
      const changes = entry.changes ?? [];
      for (const change of changes) {
        if (change.field !== 'messages') continue;

        const value = change.value;

        // Handle delivery status updates
        if (value.statuses) {
          await handleStatusUpdates(value.statuses);
        }

        // Handle incoming messages
        if (value.messages) {
          await handleIncomingMessages(value.messages, value.contacts, value.metadata);
        }
      }
    }

    // Always respond 200 to prevent Meta retries
    return NextResponse.json({ status: 'ok' }, { status: 200 });
  } catch (err) {
    console.error('[WhatsApp Webhook] Error processing:', err);
    // Still return 200 to prevent retries
    return NextResponse.json({ status: 'ok' }, { status: 200 });
  }
}

// =============================================================================
// Message Handlers
// =============================================================================

interface StatusUpdate {
  id: string;
  status: string; // 'sent' | 'delivered' | 'read' | 'failed'
  timestamp: string;
  recipient_id: string;
  errors?: Array<{ code: number; title: string }>;
}

interface IncomingMessage {
  id: string;
  from: string;
  timestamp: string;
  type: string; // 'text' | 'interactive' | 'button'
  text?: { body: string };
  interactive?: {
    type: string;
    button_reply?: { id: string; title: string };
    list_reply?: { id: string; title: string };
  };
  button?: { text: string; payload: string };
}

interface Contact {
  profile: { name: string };
  wa_id: string;
}

interface Metadata {
  display_phone_number: string;
  phone_number_id: string;
}

/**
 * Handle delivery/read status updates.
 * Updates the whatsapp_sessions table with latest status.
 */
async function handleStatusUpdates(statuses: StatusUpdate[]) {
  const admin = createAdminClient();

  for (const status of statuses) {
    try {
      // Update message status in whatsapp_sessions
      await admin
        .from('whatsapp_sessions')
        .update({ status: status.status })
        .eq('message_id', status.id);

      if (status.status === 'failed' && status.errors?.length) {
        console.error(`[WhatsApp] Message ${status.id} failed:`, status.errors[0].title);
      }
    } catch (err) {
      console.error('[WhatsApp] Status update error:', err);
    }
  }
}

/**
 * Handle incoming customer messages.
 * Logs the message and can trigger automated responses.
 */
async function handleIncomingMessages(
  messages: IncomingMessage[],
  contacts: Contact[],
  metadata: Metadata
) {
  const admin = createAdminClient();

  for (const message of messages) {
    const contact = contacts?.find((c) => c.wa_id === message.from);
    const customerName = contact?.profile?.name ?? 'Unknown';
    const customerPhone = message.from;

    // Determine message content
    let messageText = '';
    let buttonReplyId = '';

    if (message.type === 'text' && message.text) {
      messageText = message.text.body;
    } else if (message.type === 'interactive' && message.interactive) {
      if (message.interactive.button_reply) {
        buttonReplyId = message.interactive.button_reply.id;
        messageText = message.interactive.button_reply.title;
      } else if (message.interactive.list_reply) {
        buttonReplyId = message.interactive.list_reply.id;
        messageText = message.interactive.list_reply.title;
      }
    } else if (message.type === 'button' && message.button) {
      buttonReplyId = message.button.payload;
      messageText = message.button.text;
    }

    // Log incoming message
    try {
      await admin
        .from('whatsapp_sessions')
        .insert({
          message_id: message.id,
          phone: customerPhone,
          direction: 'inbound',
          status: 'delivered',
          template_name: null,
          metadata: {
            customer_name: customerName,
            message_text: messageText,
            button_reply_id: buttonReplyId,
            message_type: message.type,
            phone_number_id: metadata.phone_number_id,
          },
        } as any);
    } catch (err) {
      console.error('[WhatsApp] Failed to log incoming message:', err);
    }

    // Handle button replies (feedback ratings, booking confirmations, etc.)
    if (buttonReplyId) {
      await handleButtonReply(buttonReplyId, customerPhone, customerName);
    }

    // Handle text messages (e.g., "Hi" triggers welcome menu)
    if (message.type === 'text' && messageText) {
      await handleTextMessage(messageText, customerPhone, customerName);
    }
  }
}

/**
 * Handle button reply actions.
 * Routes to appropriate handler based on button ID.
 */
async function handleButtonReply(buttonId: string, phone: string, name: string) {
  const credentials = getPlatformCredentials();
  if (!credentials) return;

  const { sendMessage } = await import('@/lib/whatsapp/templates');

  switch (buttonId) {
    case 'book_appointment': {
      // Send WhatsApp Flow for booking
      const flowId = process.env.WHATSAPP_FLOW_ID;
      if (flowId) {
        await sendMessage(credentials, phone, {
          type: 'interactive',
          interactive: {
            type: 'flow',
            body: {
              text: '📅 Let\'s book your appointment! Fill in the details below:',
            },
            action: {
              name: 'flow',
              parameters: {
                flow_message_version: '3',
                flow_id: flowId,
                flow_cta: '💇 Book Now',
                mode: 'published',
                flow_action: 'navigate',
                flow_action_payload: {
                  screen: 'BOOKING_SCREEN',
                  data: { customer_name: name, customer_phone: phone },
                },
              },
            },
          },
        });
      } else {
        // Fallback if flow not configured — send text with instructions
        await sendMessage(credentials, phone, {
          type: 'text',
          text: {
            body: `Hi ${name}! 💇 To book an appointment, please share:\n\n1️⃣ Service you want\n2️⃣ Preferred date\n3️⃣ Preferred time\n\nOur team will confirm your slot shortly! 😊`,
          },
        });
      }
      break;
    }

    case 'my_appointments': {
      // Look up customer's upcoming appointments
      const admin = createAdminClient();
      const { data: customer } = await (admin
        .from('customers')
        .select('id')
        .eq('phone', `+${phone}`)
        .single() as any);

      if (customer) {
        const today = new Date().toISOString().split('T')[0];
        const { data: appointments } = await admin
          .from('appointments')
          .select('appointment_date, start_time, status')
          .eq('customer_id', customer.id)
          .gte('appointment_date', today)
          .in('status', ['booked', 'confirmed'])
          .order('appointment_date', { ascending: true })
          .limit(3);

        if (appointments && appointments.length > 0) {
          const apptList = appointments.map((a: any) => {
            const date = new Date(a.appointment_date + 'T00:00:00+05:30');
            const dateStr = date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
            const time = a.start_time?.slice(0, 5) || '';
            return `📅 ${dateStr} at ${time}`;
          }).join('\n');

          await sendMessage(credentials, phone, {
            type: 'text',
            text: { body: `📋 Your upcoming appointments:\n\n${apptList}\n\nNeed to reschedule? Just reply "Reschedule"` },
          });
        } else {
          await sendMessage(credentials, phone, {
            type: 'text',
            text: { body: `📋 You don't have any upcoming appointments.\n\nWould you like to book one? Reply "Book" 💇` },
          });
        }
      } else {
        await sendMessage(credentials, phone, {
          type: 'text',
          text: { body: `We couldn't find your profile. Please book your first appointment and we'll save your details! Reply "Book" 💇` },
        });
      }
      break;
    }

    case 'services_prices': {
      // Fetch services for the tenant
      const admin = createAdminClient();
      const { data: services } = await admin
        .from('services')
        .select('name, price, duration_minutes')
        .eq('is_active', true)
        .order('category')
        .order('name')
        .limit(10);

      if (services && services.length > 0) {
        const serviceList = services.map((s: any) =>
          `✂️ ${s.name} — ₹${s.price} (${s.duration_minutes} min)`
        ).join('\n');

        await sendMessage(credentials, phone, {
          type: 'text',
          text: { body: `💰 Our Services & Prices:\n\n${serviceList}\n\nReply "Book" to book an appointment! 📅` },
        });
      } else {
        await sendMessage(credentials, phone, {
          type: 'text',
          text: { body: `Please contact us directly for our service menu. We'll be happy to help! 😊` },
        });
      }
      break;
    }

    case 'contact_us': {
      await sendMessage(credentials, phone, {
        type: 'text',
        text: {
          body: `📞 Contact Us:\n\nYou can reach us right here on WhatsApp! Just type your question and our team will respond shortly.\n\nOr call us directly at the salon. We're happy to help! 😊`,
        },
      });
      break;
    }

    case 'confirm_appointment': {
      await sendMessage(credentials, phone, {
        type: 'text',
        text: { body: `✅ Great! Your appointment is confirmed. See you soon, ${name}! 😊` },
      });
      break;
    }

    case 'reschedule_appointment': {
      const flowId = process.env.WHATSAPP_FLOW_ID;
      if (flowId) {
        await sendMessage(credentials, phone, {
          type: 'interactive',
          interactive: {
            type: 'flow',
            body: { text: '🔄 Let\'s reschedule your appointment. Pick a new date and time:' },
            action: {
              name: 'flow',
              parameters: {
                flow_message_version: '3',
                flow_id: flowId,
                flow_cta: '🔄 Reschedule',
                mode: 'published',
                flow_action: 'navigate',
                flow_action_payload: {
                  screen: 'RESCHEDULE_SCREEN',
                  data: { customer_name: name, customer_phone: phone },
                },
              },
            },
          },
        });
      } else {
        await sendMessage(credentials, phone, {
          type: 'text',
          text: { body: `🔄 To reschedule, please share your preferred new date and time. Our team will confirm the change shortly!` },
        });
      }
      break;
    }

    case 'cancel_appointment': {
      await sendMessage(credentials, phone, {
        type: 'interactive',
        interactive: {
          type: 'button',
          body: { text: `⚠️ Are you sure you want to cancel your appointment, ${name}?` },
          action: {
            buttons: [
              { type: 'reply', reply: { id: 'confirm_cancel', title: '❌ Yes, Cancel' } },
              { type: 'reply', reply: { id: 'keep_appointment', title: '✅ Keep It' } },
            ],
          },
        },
      });
      break;
    }

    case 'confirm_cancel': {
      await sendMessage(credentials, phone, {
        type: 'text',
        text: { body: `❌ Your appointment has been cancelled. We hope to see you again soon, ${name}! 💜\n\nReply "Book" anytime to schedule a new appointment.` },
      });
      break;
    }

    case 'keep_appointment': {
      await sendMessage(credentials, phone, {
        type: 'text',
        text: { body: `✅ Great! Your appointment is still on. See you soon! 😊` },
      });
      break;
    }

    case 'rating_5': {
      await sendMessage(credentials, phone, {
        type: 'text',
        text: { body: `🎉 Thank you so much, ${name}! We're thrilled you loved your experience! ⭐⭐⭐⭐⭐\n\nWould you mind leaving us a Google review? It helps other customers find us! 🙏\n\nhttps://g.page/r/YOUR_GOOGLE_REVIEW_LINK` },
      });
      break;
    }

    case 'rating_3': {
      await sendMessage(credentials, phone, {
        type: 'text',
        text: { body: `Thank you for your feedback, ${name}! We appreciate your honesty. ⭐⭐⭐\n\nIs there anything specific we can improve? Your suggestions help us serve you better! 💜` },
      });
      break;
    }

    case 'rating_1': {
      await sendMessage(credentials, phone, {
        type: 'text',
        text: { body: `We're sorry to hear that, ${name}. 😔 Your satisfaction is our priority.\n\nCould you tell us what went wrong? Our manager will personally look into this and make it right. 🙏` },
      });
      break;
    }

    default:
      console.log(`[WhatsApp] Unhandled button reply from ${name} (${phone}): ${buttonId}`);
  }
}

/**
 * Handle text messages.
 * Triggers welcome menu for greetings, booking flow for "book", etc.
 */
async function handleTextMessage(text: string, phone: string, name: string) {
  const credentials = getPlatformCredentials();
  if (!credentials) return;

  const { sendMessage } = await import('@/lib/whatsapp/templates');
  const lowerText = text.toLowerCase().trim();

  // Greeting patterns
  const greetings = ['hi', 'hello', 'hey', 'hii', 'hiii', 'helo', 'hai', 'good morning', 'good afternoon', 'good evening', 'namaste'];
  const bookingKeywords = ['book', 'appointment', 'booking', 'schedule', 'slot'];
  const rescheduleKeywords = ['reschedule', 'change date', 'change time', 'postpone'];
  const cancelKeywords = ['cancel', 'cancel appointment'];
  const priceKeywords = ['price', 'prices', 'rate', 'rates', 'cost', 'menu', 'services', 'service'];

  if (greetings.some((g) => lowerText === g || lowerText.startsWith(g + ' '))) {
    // Send welcome menu with interactive buttons
    await sendMessage(credentials, phone, {
      type: 'interactive',
      interactive: {
        type: 'button',
        body: {
          text: `👋 Welcome to *Snip and Glow*!\n\nHi ${name}, how can we help you today?`,
        },
        action: {
          buttons: [
            { type: 'reply', reply: { id: 'book_appointment', title: '💇 Book Appointment' } },
            { type: 'reply', reply: { id: 'my_appointments', title: '📋 My Appointments' } },
            { type: 'reply', reply: { id: 'services_prices', title: '💰 Services & Prices' } },
          ],
        },
      },
    });
  } else if (bookingKeywords.some((k) => lowerText.includes(k))) {
    // Trigger booking flow
    await handleButtonReply('book_appointment', phone, name);
  } else if (rescheduleKeywords.some((k) => lowerText.includes(k))) {
    await handleButtonReply('reschedule_appointment', phone, name);
  } else if (cancelKeywords.some((k) => lowerText.includes(k))) {
    await handleButtonReply('cancel_appointment', phone, name);
  } else if (priceKeywords.some((k) => lowerText.includes(k))) {
    await handleButtonReply('services_prices', phone, name);
  } else {
    // Unknown message — acknowledge and offer help
    await sendMessage(credentials, phone, {
      type: 'interactive',
      interactive: {
        type: 'button',
        body: {
          text: `Thanks for your message, ${name}! 😊\n\nHow can we help you?`,
        },
        action: {
          buttons: [
            { type: 'reply', reply: { id: 'book_appointment', title: '💇 Book Appointment' } },
            { type: 'reply', reply: { id: 'services_prices', title: '💰 Services & Prices' } },
            { type: 'reply', reply: { id: 'contact_us', title: '📞 Contact Us' } },
          ],
        },
      },
    });
  }
}
