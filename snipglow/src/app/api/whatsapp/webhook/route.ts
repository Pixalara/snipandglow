import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getWebhookVerifyToken, getAppSecret, getPlatformCredentials } from '@/lib/whatsapp/config';
import { notifyOwner, notifyOwnerNewBooking, notifyOwnerReschedule, notifyOwnerCancel, notifyOwnerFeedback } from '@/lib/whatsapp/notify-owner';
import { createNotification } from '@/lib/notifications';
import { resolveTenant, resolveTenantById, type TenantContext } from '@/lib/whatsapp/tenant-router';
import { sendMessage } from '@/lib/whatsapp/templates';
import crypto from 'crypto';

// =============================================================================
// WhatsApp Webhook — Multi-Tenant (Shared + Dedicated mode)
// =============================================================================

/** Format time to 12-hour display */
function formatTime12hWebhook(time: string): string {
  const [h, m] = time.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${period}`;
}

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
      // Template quick reply buttons send text as payload
      const payload = message.button?.payload ?? message.button?.text ?? '';
      // Map template button text to our internal IDs
      const templateButtonMap: Record<string, string> = {
        'Reschedule': 'reschedule_appointment',
        'Cancel': 'cancel_appointment',
        'Change Again': 'reschedule_appointment',
        'reschedule_appointment': 'reschedule_appointment',
        'cancel_appointment': 'cancel_appointment',
        'Rate Us': 'rate_us',
        'Rate Now': 'rate_now',
        'Book Now': 'book_appointment',
        'View Services': 'services_prices',
      };
      buttonReplyId = templateButtonMap[payload] || payload;
      messageText = message.button?.text ?? '';
    }

    // Log incoming message (tenant_id added after resolution below)
    let inboundLogId: string | null = null;
    try {
      const { data: logRow } = await (admin.from('whatsapp_sessions').insert({
        message_id: message.id,
        phone: customerPhone,
        direction: 'inbound',
        status: 'delivered',
        template_name: null,
        metadata: { customer_name: customerName, message_text: messageText, button_reply_id: buttonReplyId, phone_number_id: phoneNumberId },
      } as any).select('id').single() as any);
      inboundLogId = logRow?.id ?? null;
    } catch {}

    // ─── DETECT FEEDBACK INTENT (for deterministic, isolated routing) ────────
    // Feedback interactions must route to the exact salon that requested them.
    // The rating rows carry the tenant id as `feedback_N__<tenantId>`, which is
    // authoritative. "rate_now"/"rate_us" use the awaiting_feedback session.
    let forcedTenantId: string | null = null;
    let normalizedButtonId = buttonReplyId;
    const ratingMatch = /^feedback_([1-5])__(.+)$/.exec(buttonReplyId);
    if (ratingMatch) {
      normalizedButtonId = `feedback_${ratingMatch[1]}`;
      forcedTenantId = ratingMatch[2];
    }
    const isFeedbackIntent =
      !!forcedTenantId ||
      buttonReplyId === 'rate_now' ||
      buttonReplyId === 'rate_us' ||
      /^feedback_[1-5]$/.test(buttonReplyId);

    // ─── RESOLVE TENANT ─────────────────────────────────────────────────────
    let tenant: TenantContext | null = null;
    if (forcedTenantId) {
      // Authoritative: tenant encoded in the rating row id.
      tenant = await resolveTenantById(forcedTenantId);
    }
    if (!tenant) {
      tenant = await resolveTenant(
        phoneNumberId,
        customerPhone,
        messageText,
        isFeedbackIntent ? 'feedback' : 'general'
      );
    }
    buttonReplyId = normalizedButtonId;

    // Update inbound log with tenant_id now that we know it
    if (tenant && inboundLogId) {
      try {
        await (admin.from('whatsapp_sessions').update({ tenant_id: tenant.tenantId } as any).eq('id', inboundLogId) as any);
      } catch {}
    }

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

  // Check if it's a booking trigger that doesn't match any tenant
  const upper = messageText.trim().toUpperCase();
  const isBookingAttempt = upper.startsWith('BOOK_') ||
    /^SNG[-]?\d+$/i.test(messageText.trim()) ||
    /\[SNG[-]?\d+\]/i.test(messageText) ||
    /book\s+an?\s+appointment\s+at/i.test(messageText);

  if (isBookingAttempt) {
    await sendMessage(credentials, phone, {
      type: 'text',
      text: { body: 'Sorry, we could not find that salon. Please check the link from your salon and try again.' },
    });
    return;
  }

  // Generic fallback
  await sendMessage(credentials, phone, {
    type: 'text',
    text: { body: 'Hi! 👋 To book an appointment, please use the booking link provided by your salon.\n\nPowered by SnipandGlow — snipandglow.com' },
  });
}

// =============================================================================
// Text Message Handler
// =============================================================================

async function handleTextMessage(tenant: TenantContext, phone: string, name: string, text: string) {
  const lowerText = text.toLowerCase().trim();

  // Check if it's a booking trigger (slug, short code, embedded code, or friendly message)
  if (text.trim().toUpperCase().startsWith('BOOK_') ||
      /^SNG[-]?\d+$/i.test(text.trim()) ||
      /\[SNG[-]?\d+\]/i.test(text) ||
      /book\s+an?\s+appointment\s+at/i.test(text)) {
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
      const flowIdReturning = process.env.WHATSAPP_FLOW_ID_RETURNING;

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
        title: `${s.name} - Rs.${s.price}`,
      }));

      // Check if customer already exists (returning customer)
      const phoneE164Book = `+${phone}`;
      const { data: existingCustomer } = await (admin.from('customers').select('id, name').eq('phone', phoneE164Book).eq('tenant_id', tenant.tenantId).single() as any);

      // Pick the right flow: returning customer flow if available, else regular
      const useFlowId = (existingCustomer && flowIdReturning) ? flowIdReturning : flowId;

      if (useFlowId) {
        // Generate smart dates and time slots based on salon operating hours
        const { generateSmartSlots } = await import('@/lib/time-slots');
        const { dates, timeSlots } = await generateSmartSlots(tenant.tenantId, tenant.branchId);

        // Build flow_token with customer_id if returning customer
        const flowToken = existingCustomer
          ? JSON.stringify({ phone, tenant_id: tenant.tenantId, branch_id: tenant.branchId, salon_name: tenant.salonName, customer_id: existingCustomer.id, customer_name: existingCustomer.name })
          : JSON.stringify({ phone, tenant_id: tenant.tenantId, branch_id: tenant.branchId, salon_name: tenant.salonName });

        const bodyText = existingCustomer
          ? `Welcome back, *${existingCustomer.name}*! 👋\nBook your next appointment at *${tenant.salonName}*`
          : `Book your appointment at *${tenant.salonName}*`;

        console.log('[Webhook] Sending flow:', useFlowId, 'returning:', !!existingCustomer);

        await sendMessage(tenant.credentials, phone, {
          type: 'interactive',
          interactive: {
            type: 'flow',
            body: { text: bodyText },
            action: {
              name: 'flow',
              parameters: {
                flow_message_version: '3',
                flow_id: useFlowId,
                flow_cta: existingCustomer ? 'Quick Book' : 'Book Now',
                mode: 'published',
                flow_action: 'navigate',
                flow_action_payload: {
                  screen: 'BOOKING_SCREEN',
                  data: {
                    services: services.length > 0 ? services : [{ id: 'none', title: 'No services' }],
                    dates,
                    time_slots: timeSlots,
                  },
                },
                flow_token: flowToken,
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
        const list = services.map((s: any) => `• ${s.name} — ₹${s.price}`).join('\n');
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
      // Fetch owner's phone from tenants table
      const { data: tenantData } = await admin
        .from('tenants')
        .select('phone')
        .eq('id', tenant.tenantId)
        .single();

      if (tenantData?.phone) {
        // Format phone for wa.me link (digits only, with country code)
        let ownerPhone = tenantData.phone.replace(/\D/g, '');
        if (ownerPhone.length === 10) ownerPhone = '91' + ownerPhone;

        const waLink = `https://wa.me/${ownerPhone}?text=${encodeURIComponent(`Hi! I'd like to know more about your services.`)}`;

        await sendMessage(tenant.credentials, phone, {
          type: 'text',
          text: { body: `📞 *Talk to ${tenant.salonName}*\n\nTap the link below to connect directly with the salon owner on WhatsApp:\n\n${waLink}\n\nThey'll get back to you shortly! 😊` },
        });
      } else {
        // Fallback if no phone set
        await sendMessage(tenant.credentials, phone, {
          type: 'text',
          text: { body: `You can reach *${tenant.salonName}* right here! Just type your message and the salon team will respond shortly. 😊` },
        });
      }
      break;
    }

    case 'reschedule_appointment': {
      // Use WhatsApp Flow for reschedule (single form: services + date + time)
      const flowId = process.env.WHATSAPP_FLOW_ID_RETURNING || process.env.WHATSAPP_FLOW_ID;
      const phoneE164Resched = `+${phone}`;
      const { data: custResched } = await (admin.from('customers').select('id, name').eq('phone', phoneE164Resched).eq('tenant_id', tenant.tenantId).single() as any);

      if (custResched && flowId) {
        // Fetch services
        const { data: svcList } = await admin
          .from('services')
          .select('id, name, price, duration_minutes')
          .eq('tenant_id', tenant.tenantId)
          .eq('is_active', true)
          .order('name')
          .limit(10);

        const services = (svcList ?? []).map((s: any) => ({
          id: s.id,
          title: `${s.name} - Rs.${s.price}`,
        }));

        // Generate smart dates and time slots
        const { generateSmartSlots } = await import('@/lib/time-slots');
        const { dates, timeSlots } = await generateSmartSlots(tenant.tenantId, tenant.branchId);

        await sendMessage(tenant.credentials, phone, {
          type: 'interactive',
          interactive: {
            type: 'flow',
            body: { text: `📅 *Reschedule your appointment* at *${tenant.salonName}*\n\nPick a new date and time:` },
            action: {
              name: 'flow',
              parameters: {
                flow_message_version: '3',
                flow_id: flowId,
                flow_cta: 'Reschedule Now',
                mode: 'published',
                flow_action: 'navigate',
                flow_action_payload: {
                  screen: 'BOOKING_SCREEN',
                  data: {
                    services: services.length > 0 ? services : [{ id: 'none', title: 'No services' }],
                    dates,
                    time_slots: timeSlots,
                  },
                },
                flow_token: JSON.stringify({ phone, tenant_id: tenant.tenantId, branch_id: tenant.branchId, salon_name: tenant.salonName, customer_id: custResched.id, customer_name: custResched.name, is_reschedule: true }),
              },
            },
          },
        });
      } else if (!custResched) {
        await sendMessage(tenant.credentials, phone, {
          type: 'text',
          text: { body: `You don't have any upcoming appointments to reschedule. Reply "Book" to schedule one!` },
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
      // Find the customer's most recent active appointment
      const phoneE164Cancel = `+${phone}`;
      const { data: custCancel } = await (admin.from('customers').select('id').eq('phone', phoneE164Cancel).eq('tenant_id', tenant.tenantId).single() as any);

      if (custCancel) {
        const { data: activeAppt } = await (admin
          .from('appointments')
          .select('id, service_id, appointment_date, start_time, whatsapp_flow_ref')
          .eq('customer_id', custCancel.id)
          .eq('tenant_id', tenant.tenantId)
          .in('status', ['booked', 'confirmed'])
          .order('appointment_date', { ascending: true })
          .limit(1)
          .single() as any);

        if (activeAppt) {
          // Get service names for display
          let svcNames = '';
          try {
            const extraIds = activeAppt.whatsapp_flow_ref ? JSON.parse(activeAppt.whatsapp_flow_ref) : null;
            const svcIds = Array.isArray(extraIds) && extraIds.length > 0 ? extraIds : [activeAppt.service_id];
            const { data: svcs } = await admin.from('services').select('name').in('id', svcIds);
            svcNames = svcs?.map((s: any) => s.name).join(', ') || '';
          } catch { svcNames = ''; }

          const dateLabel = new Date(activeAppt.appointment_date + 'T12:00:00+05:30').toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric' });
          const timeLabel = formatTime12hWebhook(activeAppt.start_time);

          await sendMessage(tenant.credentials, phone, {
            type: 'interactive',
            interactive: {
              type: 'button',
              body: { text: `Are you sure you want to cancel your appointment?\n\n✂️ ${svcNames}\n📅 ${dateLabel}, ${timeLabel}\n📍 ${tenant.salonName}` },
              action: {
                buttons: [
                  { type: 'reply', reply: { id: `confirm_cancel_${activeAppt.id}`, title: 'Yes, Cancel' } },
                  { type: 'reply', reply: { id: 'keep_appointment', title: 'Keep It' } },
                ],
              },
            },
          });
        } else {
          await sendMessage(tenant.credentials, phone, {
            type: 'text',
            text: { body: `You don't have any upcoming appointments to cancel. Reply "Book" to schedule one!` },
          });
        }
      } else {
        await sendMessage(tenant.credentials, phone, {
          type: 'text',
          text: { body: `You don't have any upcoming appointments. Reply "Book" to schedule one!` },
        });
      }
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

    case 'rate_us':
    case 'rate_now': {
      // Customer tapped "Rate Us" on bill_receipt_v1 or "Rate Now" on feedback_request_v1.
      // Embed the tenant_id into each rating row ID so the submitted rating is
      // self-describing and can never be misattributed to another salon — even
      // for customers who belong to multiple salons.
      const t = tenant.tenantId;
      await sendMessage(tenant.credentials, phone, {
        type: 'interactive',
        interactive: {
          type: 'list',
          body: {
            text: `⭐ How was your experience at *${tenant.salonName}* today?\n\nYour feedback helps us serve you better. Tap below to rate:`,
          },
          action: {
            button: 'Rate Now',
            sections: [
              {
                title: 'Select Your Rating',
                rows: [
                  { id: `feedback_5__${t}`, title: '⭐⭐⭐⭐⭐ Excellent!', description: 'Absolutely loved it' },
                  { id: `feedback_4__${t}`, title: '⭐⭐⭐⭐ Very Good', description: 'Great experience' },
                  { id: `feedback_3__${t}`, title: '⭐⭐⭐ Good', description: 'It was okay' },
                  { id: `feedback_2__${t}`, title: '⭐⭐ Fair', description: 'Could be better' },
                  { id: `feedback_1__${t}`, title: '⭐ Poor', description: 'Not satisfied' },
                ],
              },
            ],
          },
        },
      });
      break;
    }

    case 'feedback_5':
    case 'feedback_4':
    case 'feedback_3':
    case 'feedback_2':
    case 'feedback_1': {
      // Extract rating number from button ID
      const rating = parseInt(buttonId.replace('feedback_', ''));

      // Save feedback
      await (admin.from('feedback' as any).insert({
        tenant_id: tenant.tenantId,
        branch_id: tenant.branchId,
        customer_phone: phone,
        customer_name: name,
        rating,
        source: 'whatsapp',
      } as any) as any);

      // Send appropriate response based on rating
      if (rating >= 3) {
        // 3-5 stars — ask if they'd like to leave a Google review
        // Get Google review link from tenant settings
        const { data: tenantSettings } = await (admin.from('tenants' as any).select('settings').eq('id', tenant.tenantId).single() as any);
        const googleReviewLink = (tenantSettings?.settings as any)?.google_review_link || '';

        if (googleReviewLink) {
          const thankMsg = rating >= 4
            ? `🎉 Thank you for the ${rating}-star rating, ${name}! We're so glad you loved your experience at *${tenant.salonName}*.`
            : `Thank you for your feedback, ${name}! We appreciate you taking the time to rate *${tenant.salonName}*.`;

          await sendMessage(tenant.credentials, phone, {
            type: 'interactive',
            interactive: {
              type: 'button',
              body: {
                text: `${thankMsg}\n\nWould you mind sharing your experience on Google? It really helps other customers find us! 🙏`,
              },
              action: {
                buttons: [
                  { type: 'reply', reply: { id: `google_review_yes`, title: '⭐ Yes, Review Now' } },
                  { type: 'reply', reply: { id: 'google_review_no', title: 'Maybe Later' } },
                ],
              },
            },
          });
        } else {
          const thankMsg = rating >= 4
            ? `🎉 Thank you for the ${rating}-star rating! We're thrilled you loved your experience at *${tenant.salonName}*.\n\nWe look forward to seeing you again! 💇`
            : `Thank you for your feedback, ${name}! We appreciate your honesty at *${tenant.salonName}*.\n\nSee you next time! 🙏`;
          await sendMessage(tenant.credentials, phone, {
            type: 'text',
            text: { body: thankMsg },
          });
        }

        // Booking nudge — encourage next visit via WhatsApp
        await sendMessage(tenant.credentials, phone, {
          type: 'interactive',
          interactive: {
            type: 'button',
            body: {
              text: `💡 *Next time, skip the wait!*\nBook your next appointment in advance via WhatsApp - just say *Hi* to this chat and we'll get you booked in seconds. 😊`,
            },
            action: {
              buttons: [
                { type: 'reply', reply: { id: 'book_appointment', title: '📅 Book Now' } },
              ],
            },
          },
        });
      } else {
        // 1-2 stars — apologize and offer to help
        await sendMessage(tenant.credentials, phone, {
          type: 'text',
          text: { body: `We're sorry to hear that, ${name}. Your feedback is important to us and we'll do our best to improve.\n\nIf you'd like to share more details, just type your message here. Our team at *${tenant.salonName}* will look into it. 🙏` },
        });

        // Still nudge for next booking even after low rating
        await sendMessage(tenant.credentials, phone, {
          type: 'interactive',
          interactive: {
            type: 'button',
            body: {
              text: `💡 *Next time, skip the wait!*\nBook your next appointment in advance via WhatsApp - just say *Hi* to this chat and we'll get you booked in seconds. 😊`,
            },
            action: {
              buttons: [
                { type: 'reply', reply: { id: 'book_appointment', title: '📅 Book Now' } },
              ],
            },
          },
        });
      }

      // Notify salon owner
      await notifyOwnerFeedbackLegacy(admin, tenant, name, phone, rating);
      break;
    }

    case 'google_review_yes': {
      // Get Google review link from tenant settings
      const { data: tenantForReview } = await (admin.from('tenants' as any).select('settings').eq('id', tenant.tenantId).single() as any);
      const reviewLink = (tenantForReview?.settings as any)?.google_review_link || '';

      if (reviewLink) {
        await sendMessage(tenant.credentials, phone, {
          type: 'text',
          text: { body: `Thank you! 🙏 Here's the link to leave your review:\n\n${reviewLink}\n\nYour support means the world to us! ❤️` },
        });
      } else {
        await sendMessage(tenant.credentials, phone, {
          type: 'text',
          text: { body: `Thank you for your willingness! The salon hasn't set up their Google review link yet. We appreciate your support! ❤️` },
        });
      }
      break;
    }

    case 'google_review_no': {
      await sendMessage(tenant.credentials, phone, {
        type: 'text',
        text: { body: `No problem at all! Thank you for your feedback. See you next time! 😊` },
      });
      break;
    }

    default: {
      // Handle confirm_cancel_<appointmentId> — customer confirms cancellation
      if (buttonId.startsWith('confirm_cancel_')) {
        const appointmentId = buttonId.replace('confirm_cancel_', '');
        
        // Cancel the appointment in DB
        const { error: cancelError } = await (admin
          .from('appointments')
          .update({ status: 'cancelled' })
          .eq('id', appointmentId)
          .in('status', ['booked', 'confirmed']) as any);

        if (!cancelError) {
          // Notify salon owner via approved template (works outside 24h window)
          await notifyOwnerCancel(admin, tenant.credentials, tenant.tenantId,
            tenant.salonName, name, phone
          );
          // In-app notification
          createNotification(tenant.tenantId, 'cancel', 'Appointment Cancelled',
            `${name} cancelled their appointment via WhatsApp`,
            { customer_name: name, customer_phone: phone }
          ).catch(() => {});

          await sendMessage(tenant.credentials, phone, {
            type: 'interactive',
            interactive: {
              type: 'button',
              body: { text: `✅ Your appointment at *${tenant.salonName}* has been cancelled successfully.\n\nWe hope to see you again soon! 😊` },
              action: {
                buttons: [
                  { type: 'reply', reply: { id: 'book_appointment', title: 'Book Again' } },
                ],
              },
            },
          });
        } else {
          await sendMessage(tenant.credentials, phone, {
            type: 'text',
            text: { body: `Sorry, we couldn't cancel the appointment. It may have already been completed or cancelled. Please contact the salon directly.` },
          });
        }
        break;
      }

      // Handle reschedule date selection: resched.<appointmentId>.<date>
      if (buttonId.startsWith('resched.')) {
        const parts = buttonId.split('.');
        const apptId = parts[1];
        const selectedDate = parts[2];

        // Generate time slots for the selected date
        const timeSlots: Array<{ id: string; title: string; description: string }> = [];
        for (let hour = 9; hour < 20; hour++) {
          for (const min of [0, 30]) {
            const h = hour % 12 || 12;
            const period = hour >= 12 ? 'PM' : 'AM';
            const timeStr = `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}:00`;
            timeSlots.push({
              id: `reschedtime.${apptId}.${selectedDate}.${timeStr}`,
              title: `${h}:${String(min).padStart(2, '0')} ${period}`,
              description: 'Available',
            });
          }
        }

        const dateLabel = new Date(selectedDate + 'T12:00:00+05:30').toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'long', day: 'numeric', month: 'short' });

        await sendMessage(tenant.credentials, phone, {
          type: 'interactive',
          interactive: {
            type: 'list',
            body: { text: `⏰ Select a new time for *${dateLabel}*:` },
            action: {
              button: 'Select Time',
              sections: [
                {
                  title: 'Available Times',
                  rows: timeSlots.slice(0, 10), // WhatsApp list max 10 rows per section
                },
              ],
            },
          },
        });
        break;
      }

      // Handle reschedule time selection: reschedtime.<appointmentId>.<date>.<time>
      if (buttonId.startsWith('reschedtime.')) {
        const parts = buttonId.split('.');
        const apptId = parts[1];
        const newDate = parts[2];
        const newTime = parts[3];

        // Fetch the appointment to get service duration
        const { data: apptToResched } = await (admin
          .from('appointments')
          .select('id, service_id, customer_id, whatsapp_flow_ref, tenant_id')
          .eq('id', apptId)
          .single() as any);

        if (!apptToResched) {
          await sendMessage(tenant.credentials, phone, { type: 'text', text: { body: 'Appointment not found. Please try again.' } });
          break;
        }

        // Calculate end time from service duration
        let totalDuration = 30; // default
        try {
          const extraIds = apptToResched.whatsapp_flow_ref ? JSON.parse(apptToResched.whatsapp_flow_ref) : null;
          const svcIds = Array.isArray(extraIds) && extraIds.length > 0 ? extraIds : [apptToResched.service_id];
          const { data: svcs } = await admin.from('services').select('duration_minutes').in('id', svcIds);
          if (svcs && svcs.length > 0) {
            totalDuration = svcs.reduce((sum: number, s: any) => sum + (s.duration_minutes || 30), 0);
          }
        } catch {}

        const [startH, startM] = newTime.split(':').map(Number);
        const totalMin = startH * 60 + startM + totalDuration;
        const endTime = `${String(Math.floor(totalMin / 60)).padStart(2, '0')}:${String(totalMin % 60).padStart(2, '0')}:00`;

        // Update the appointment
        const { error: reschedError } = await (admin
          .from('appointments')
          .update({ appointment_date: newDate, start_time: newTime, end_time: endTime })
          .eq('id', apptId) as any);

        if (!reschedError) {
          const dateLabel = new Date(newDate + 'T12:00:00+05:30').toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric' });
          const timeLabel = formatTime12hWebhook(newTime);

          // Notify customer
          await sendMessage(tenant.credentials, phone, {
            type: 'interactive',
            interactive: {
              type: 'button',
              body: { text: `✅ *Appointment Rescheduled!*\n\n📅 ${dateLabel}, ${timeLabel}\n📍 ${tenant.salonName}\n\nSee you at the new time! 😊` },
              action: {
                buttons: [
                  { type: 'reply', reply: { id: 'reschedule_appointment', title: 'Change Again' } },
                  { type: 'reply', reply: { id: 'cancel_appointment', title: 'Cancel' } },
                ],
              },
            },
          });

          // Notify salon owner via approved template
          await notifyOwnerReschedule(admin, tenant.credentials, tenant.tenantId,
            tenant.salonName, name, phone, 'appointment', `${dateLabel}, ${timeLabel}`
          );
          // In-app notification
          createNotification(tenant.tenantId, 'reschedule', 'Appointment Rescheduled',
            `${name} rescheduled to ${dateLabel}, ${timeLabel}`,
            { customer_name: name, customer_phone: phone }
          ).catch(() => {});
        } else {
          await sendMessage(tenant.credentials, phone, {
            type: 'text',
            text: { body: `Sorry, couldn't reschedule. The slot may be taken. Please try a different time.` },
          });
        }
        break;
      }

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
        const dateLabel = new Date(dateStr + 'T12:00:00+05:30').toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric' });
        const h = startH % 12 || 12;
        const period = startH >= 12 ? 'PM' : 'AM';
        const timeLabel = `${h}:00 ${period}`;

        // Build calendar token for URL button
        const calendarToken = Buffer.from(
          [service.name + ' at ' + tenant.salonName, dateStr, timeSlot, endTime, tenant.salonName].join('|')
        ).toString('base64url');

        // Send booking confirmation using approved template
        const templateResult = await sendMessage(tenant.credentials, phone, {
          type: 'template',
          template: {
            name: 'booking_confirmation_v2',
            language: { code: 'en' },
            components: [
              {
                type: 'body',
                parameters: [
                  { type: 'text', text: name },
                  { type: 'text', text: service.name },
                  { type: 'text', text: `${dateLabel}, ${timeLabel}` },
                  { type: 'text', text: tenant.salonName },
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
        console.log('[Webhook] Template send result:', JSON.stringify(templateResult));
        break;
      }

      console.log(`[Webhook] Unhandled button: ${buttonId} from ${phone}`);
    }
  }
}

// =============================================================================
// Notify Salon Owner about Customer Feedback
// =============================================================================

async function notifyOwnerFeedbackLegacy(admin: any, tenant: TenantContext, customerName: string, customerPhone: string, rating: number) {
  try {
    await notifyOwnerFeedback(admin, tenant.credentials, tenant.tenantId,
      tenant.salonName, customerName, rating
    );
    // In-app notification
    const stars = '⭐'.repeat(rating);
    createNotification(tenant.tenantId, 'feedback', `New Feedback - ${stars}`,
      `${customerName} rated ${rating}/5`,
      { customer_name: customerName, customer_phone: customerPhone }
    ).catch(() => {});
  } catch (err) {
    console.error('[Webhook] Failed to notify owner about feedback:', err);
  }
}
