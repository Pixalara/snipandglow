import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getWebhookVerifyToken, getAppSecret } from '@/lib/whatsapp/config';
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
  // TODO: Implement button reply routing
  // Examples:
  // - "confirm_appointment" → mark appointment as confirmed
  // - "reschedule_appointment" → send reschedule flow
  // - "cancel_appointment" → cancel and free slot
  // - "rating_5" → log 5-star feedback, ask for Google review
  // - "rating_1" to "rating_4" → log feedback, alert owner
  console.log(`[WhatsApp] Button reply from ${name} (${phone}): ${buttonId}`);
}

/**
 * Handle text messages.
 * Can trigger welcome menu, booking flow, etc.
 */
async function handleTextMessage(text: string, phone: string, name: string) {
  // TODO: Implement text message routing
  // Examples:
  // - "Hi" / "Hello" → send welcome menu with buttons
  // - "Book" → trigger booking flow
  // - Star rating (1-5) → log as feedback
  console.log(`[WhatsApp] Text from ${name} (${phone}): ${text}`);
}
