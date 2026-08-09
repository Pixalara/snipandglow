// =============================================================================
// Welcome WhatsApp to the salon owner, sent once on successful signup.
//
// Distinct from signup-alert.ts: that notifies the platform team, this greets
// the new customer. Both fire from the same `after()` block in completeOnboarding
// so neither adds latency to the signup response.
//
// Best-effort by contract - a failed welcome must never affect the signup.
//
// Configuration
//   WELCOME_WA_TEMPLATE   approved template name. Default salon_welcome.
//   META_WHATSAPP_ACCESS_TOKEN  required, else this silently no-ops.
// =============================================================================

import { getPlatformCredentials } from '@/lib/whatsapp/config';
import { sendMessage } from '@/lib/whatsapp/templates';
import { normalizePhone } from '@/lib/whatsapp/notify-owner';

/** Default template name; override with WELCOME_WA_TEMPLATE. */
export const WELCOME_TEMPLATE = 'salon_welcome';

export interface WelcomeTarget {
  salonName: string;
  /** Owner's phone as captured at signup; normalised before sending. */
  phone: string;
}

/**
 * Body parameters for the approved template, in declared order.
 * Meta rejects blank placeholders, so the salon name always falls back.
 */
export function welcomeTemplateParams(target: WelcomeTarget): string[] {
  const salon = (target.salonName || '').trim();
  return [salon || 'your salon'];
}

/**
 * Plain-text equivalent, used as the fallback when the template is unavailable.
 * Mirrors the approved template copy so the owner sees the same message either
 * way. Note this only delivers inside an open 24h service window, which a brand
 * new signup usually will not have.
 */
export function buildWelcomeText(target: WelcomeTarget): string {
  const salon = welcomeTemplateParams(target)[0];
  return [
    '🎉 Welcome to SnipandGlow!',
    '',
    `Thank you for choosing SnipandGlow to manage ${salon}. 🙌`,
    '',
    'Your Essentials Plan trial is now active. We are excited to have your salon on board! 💇',
    '',
    'With SnipandGlow you can simplify:',
    '✅ WhatsApp Bookings',
    '✅ Automatic Appointment Reminders',
    '✅ Customer Management',
    '✅ Billing and Invoices',
    '✅ Feedback and Follow-ups',
    '',
    'We are here to help you make your salon more organized, efficient and customer-friendly.',
    '',
    'Thank you for trusting SnipandGlow. ❤️',
    '',
    'Team SnipandGlow - Powered by Pixalara LLP',
  ].join('\n');
}

/**
 * Send the welcome WhatsApp to a newly signed up salon owner. Never throws.
 */
export async function sendWelcomeWhatsApp(target: WelcomeTarget): Promise<void> {
  try {
    const to = normalizePhone(target.phone || '');
    if (to.length !== 12) {
      console.warn('[welcome-wa] skipping, unusable phone for', target.salonName);
      return;
    }

    const credentials = getPlatformCredentials();
    if (!credentials) {
      console.warn('[welcome-wa] WhatsApp not configured (META_WHATSAPP_ACCESS_TOKEN missing)');
      return;
    }

    const templateName = process.env.WELCOME_WA_TEMPLATE || WELCOME_TEMPLATE;
    const params = welcomeTemplateParams(target);

    const viaTemplate = await sendMessage(credentials, to, {
      type: 'template',
      template: {
        name: templateName,
        language: { code: 'en' },
        components: [{ type: 'body', parameters: params.map((text) => ({ type: 'text', text })) }],
      },
    });

    if (viaTemplate.success) {
      console.log('[welcome-wa] template sent to', to);
      return;
    }

    // A brand new owner has no open service window, so this rarely lands. It is
    // still worth attempting for owners who reached us via the booking number.
    console.warn(`[welcome-wa] template "${templateName}" failed for ${to}: ${viaTemplate.error}`);
    const viaText = await sendMessage(credentials, to, {
      type: 'text',
      text: { body: buildWelcomeText(target) },
    });
    console.log('[welcome-wa] text fallback to', to, viaText.success ? 'OK' : viaText.error);
  } catch (err) {
    console.error('[welcome-wa] unexpected failure:', err);
  }
}
