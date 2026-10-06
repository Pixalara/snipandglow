// =============================================================================
// WhatsApp delivery-failure alert.
//
// Fires the moment Meta reports an ACCOUNT-LEVEL delivery failure (billing /
// eligibility / lock) on a status webhook — the situation where messages keep
// getting accepted by the API (and logged "sent") but silently never deliver.
// A billing lapse used to go unnoticed for a day; this emails the platform team
// within minutes instead.
//
// Best-effort and never throws. De-duplication (one alert per number/code/hour)
// is the caller's responsibility (the webhook claims a key first).
// =============================================================================

import 'server-only';
import { sendEmail, isEmailConfigured } from '@/lib/email/smtp';

/** Who receives the alerts. Env-overridable; never empty. */
function alertRecipients(): string[] {
  const raw =
    process.env.WHATSAPP_ALERT_EMAILS ||
    process.env.SIGNUP_ALERT_EMAILS ||
    'snipandglow.support@pixalara.com';
  const list = raw.split(',').map((s) => s.trim()).filter(Boolean);
  return list.length ? list : ['snipandglow.support@pixalara.com'];
}

/** Plain-English meaning for the account-level Meta error codes we alert on. */
const CODE_MEANING: Record<number, string> = {
  131042:
    'Business eligibility / PAYMENT issue — the WhatsApp account has a billing problem (card declined or dues unpaid). Messages are accepted but NOT delivered until billing is fixed.',
  131031: 'The WhatsApp account has been restricted or locked by Meta.',
  131045: 'The phone number / certificate is not registered correctly on Meta.',
};

export interface DeliveryFailureAlert {
  errorCode: number;
  errorTitle: string;
  /** The sending WABA number, e.g. +91 90991 11047. */
  displayPhone?: string | null;
  phoneNumberId?: string | null;
  /** The customer number the message failed to reach. */
  recipient?: string | null;
  /** The affected tenant's own email — alerted alongside the platform team. */
  tenantEmail?: string | null;
  /** The affected tenant's salon name, for subject/body context. */
  salonName?: string | null;
}

/**
 * Merge the platform alert recipients with the affected tenant's own email,
 * de-duplicated case-insensitively (so a tenant that shares a platform address
 * isn't emailed twice). Exported for testing. Never includes blanks or
 * obviously-invalid entries.
 */
export function buildRecipientList(base: string[], tenantEmail?: string | null): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (addr: string | null | undefined) => {
    if (!addr) return;
    const trimmed = addr.trim();
    const key = trimmed.toLowerCase();
    if (!key || !key.includes('@') || seen.has(key)) return;
    seen.add(key);
    out.push(trimmed);
  };
  base.forEach(push);
  push(tenantEmail);
  return out;
}

function esc(s: string): string {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export async function sendDeliveryFailureAlert(alert: DeliveryFailureAlert): Promise<void> {
  try {
    if (!isEmailConfigured()) {
      console.warn('[wa-delivery-alert] SMTP not configured; cannot email. code=', alert.errorCode);
      return;
    }

    const isBilling = alert.errorCode === 131042;
    const meaning = CODE_MEANING[alert.errorCode] || alert.errorTitle || 'Account-level WhatsApp delivery failure.';
    const who = alert.salonName ? ` — ${alert.salonName}` : '';
    const subject = `${isBilling ? '🔴 WhatsApp BILLING issue' : '⚠️ WhatsApp delivery failing'}${who} — error ${alert.errorCode}`;
    const whenIST = `${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST`;
    const numberLine = alert.displayPhone
      ? `Sending number: ${alert.displayPhone}`
      : alert.phoneNumberId
        ? `Phone number ID: ${alert.phoneNumberId}`
        : '';
    const action = isBilling
      ? 'Open Meta Business Suite → Billing for this WhatsApp account, clear the failed/pending payment, and fix the card (Indian cards usually need the RBI recurring-payment e-mandate approved). Delivery resumes within minutes of settling.'
      : 'Open WhatsApp Manager for this number — the account needs attention before messages will deliver.';

    const text = [
      `WhatsApp delivery is FAILING with error ${alert.errorCode}${alert.errorTitle ? ` (${alert.errorTitle})` : ''}.`,
      alert.salonName ? `Salon: ${alert.salonName}` : '',
      '',
      meaning,
      '',
      numberLine,
      alert.recipient ? `First failing recipient: ${alert.recipient}` : '',
      whenIST,
      '',
      `ACTION: ${action}`,
    ]
      .filter(Boolean)
      .join('\n');

    const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#0f172a;line-height:1.6;max-width:560px;">
      <h2 style="margin:0 0 10px;color:${isBilling ? '#b91c1c' : '#c2410c'};">${isBilling ? '🔴 WhatsApp billing issue detected' : '⚠️ WhatsApp delivery failing'}</h2>
      <p style="margin:0 0 10px;">WhatsApp delivery is failing with error <b>${alert.errorCode}</b>${alert.errorTitle ? ` (${esc(alert.errorTitle)})` : ''}.</p>
      ${alert.salonName ? `<p style="margin:0 0 10px;">Salon: <b>${esc(alert.salonName)}</b></p>` : ''}
      <p style="margin:0 0 12px;padding:10px 12px;background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;">${esc(meaning)}</p>
      ${numberLine ? `<p style="margin:0 0 4px;">${esc(numberLine)}</p>` : ''}
      ${alert.recipient ? `<p style="margin:0 0 4px;">First failing recipient: ${esc(alert.recipient)}</p>` : ''}
      <p style="margin:0 0 12px;color:#64748b;">${whenIST}</p>
      <p style="margin:0;"><b>Action:</b> ${esc(action)}</p>
    </div>`;

    const recipients = buildRecipientList(alertRecipients(), alert.tenantEmail);
    await Promise.all(
      recipients.map((to) =>
        sendEmail({ to, subject, html, text }).catch((e) =>
          console.error('[wa-delivery-alert] email failed for', to, e)
        )
      )
    );
    console.log('[wa-delivery-alert] alert sent for error', alert.errorCode, 'to', recipients.length, 'recipient(s)');
  } catch (err) {
    console.error('[wa-delivery-alert] failed (non-fatal):', err);
  }
}
