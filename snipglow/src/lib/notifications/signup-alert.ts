// =============================================================================
// Platform alert: a new salon has signed up.
//
// Fires from the single successful-signup point (completeOnboarding) and notifies
// the platform team over BOTH email and WhatsApp.
//
// Design notes
//   • Best-effort by contract: every failure is caught and logged. A signup must
//     never fail because an alert could not be delivered.
//   • Called from inside `after()` so it runs once the response is already sent
//     and adds nothing to the owner's perceived signup time.
//   • Both channels run in parallel; one failing does not block the other.
//
// Configuration (each channel silently no-ops when unset)
//   SIGNUP_ALERT_EMAILS       comma-separated. Defaults to PLATFORM_ADMIN_EMAILS.
//   SIGNUP_ALERT_WHATSAPP     comma-separated phones (10-digit or 91XXXXXXXXXX).
//   SIGNUP_ALERT_WA_TEMPLATE  approved template name. Default platform_signup_alert.
// =============================================================================

import 'server-only';
import { sendEmail, isEmailConfigured } from '@/lib/email/smtp';
import { getPlatformCredentials } from '@/lib/whatsapp/config';
import { sendMessage } from '@/lib/whatsapp/templates';
import {
  SIGNUP_ALERT_TEMPLATE,
  buildSignupAlertEmail,
  buildSignupAlertText,
  signupAlertEmails,
  signupAlertSubject,
  signupAlertTemplateParams,
  signupAlertWhatsAppNumbers,
  type SignupAlert,
} from './signup-alert-content';

export type { SignupAlert };

async function sendEmailAlert(alert: SignupAlert): Promise<void> {
  const to = signupAlertEmails();
  if (to.length === 0) {
    console.warn('[signup-alert] no email recipients (set SIGNUP_ALERT_EMAILS or PLATFORM_ADMIN_EMAILS)');
    return;
  }
  if (!isEmailConfigured()) {
    console.warn('[signup-alert] SMTP not configured, skipping email');
    return;
  }

  const subject = signupAlertSubject(alert);
  const html = buildSignupAlertEmail(alert);
  const text = buildSignupAlertText(alert);

  // Sent individually so one bad address cannot suppress the rest.
  await Promise.all(
    to.map(async (addr) => {
      try {
        await sendEmail({ to: addr, subject, html, text });
        console.log('[signup-alert] email sent to', addr);
      } catch (err) {
        console.error('[signup-alert] email failed for', addr, err);
      }
    })
  );
}

async function sendWhatsAppAlert(alert: SignupAlert): Promise<void> {
  const numbers = signupAlertWhatsAppNumbers();
  if (numbers.length === 0) return; // channel not configured

  const credentials = getPlatformCredentials();
  if (!credentials) {
    console.warn('[signup-alert] WhatsApp not configured (META_WHATSAPP_ACCESS_TOKEN missing)');
    return;
  }

  const templateName = process.env.SIGNUP_ALERT_WA_TEMPLATE || SIGNUP_ALERT_TEMPLATE;
  const params = signupAlertTemplateParams(alert);

  await Promise.all(
    numbers.map(async (to) => {
      // Meta requires an approved template for business-initiated messages
      // outside the 24h service window, so that is the primary path. If the
      // template is missing or not yet approved we still try plain text, which
      // lands whenever a recent reply has left the window open.
      const viaTemplate = await sendMessage(credentials, to, {
        type: 'template',
        template: {
          name: templateName,
          language: { code: 'en' },
          components: [{ type: 'body', parameters: params.map((text) => ({ type: 'text', text })) }],
        },
      });

      if (viaTemplate.success) {
        console.log('[signup-alert] whatsapp template sent to', to);
        return;
      }

      console.warn(`[signup-alert] template "${templateName}" failed for ${to}: ${viaTemplate.error}`);
      const viaText = await sendMessage(credentials, to, {
        type: 'text',
        text: { body: buildSignupAlertText(alert) },
      });
      console.log(
        '[signup-alert] whatsapp text fallback to',
        to,
        viaText.success ? 'OK' : viaText.error
      );
    })
  );
}

/**
 * Notify the platform team of a new signup over email and WhatsApp.
 * Never throws.
 */
export async function notifyPlatformOfSignup(alert: SignupAlert): Promise<void> {
  try {
    await Promise.all([
      sendEmailAlert(alert).catch((err) => console.error('[signup-alert] email channel:', err)),
      sendWhatsAppAlert(alert).catch((err) => console.error('[signup-alert] whatsapp channel:', err)),
    ]);
  } catch (err) {
    console.error('[signup-alert] unexpected failure:', err);
  }
}
