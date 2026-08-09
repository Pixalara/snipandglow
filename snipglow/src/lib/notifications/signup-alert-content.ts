// =============================================================================
// Signup alert - recipients and message bodies.
//
// Kept separate from signup-alert.ts (which does the actual sending) because the
// SMTP transport imports `server-only`, a bundler-provided alias that cannot be
// resolved outside Next. Splitting the pure logic out keeps it unit-testable.
// =============================================================================

import { normalizePhone } from '@/lib/whatsapp/notify-owner';

export interface SignupAlert {
  tenantId: string;
  tenantCode?: string | null;
  salonName: string;
  ownerName: string;
  phone: string;
  email?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  planTier?: string | null;
  /** ISO timestamp when the free trial ends. */
  trialEnd?: string | null;
}

/** Default WhatsApp template name; override with SIGNUP_ALERT_WA_TEMPLATE. */
export const SIGNUP_ALERT_TEMPLATE = 'platform_signup_alert';

/**
 * Where signup alerts go when SIGNUP_ALERT_EMAILS is not set.
 *
 * This is the same mailbox that already receives demo bookings, support tickets
 * and WhatsApp setup requests (via the platform Web3Forms key), so new-signup
 * alerts land alongside the rest of the sales pipeline with zero config.
 */
export const DEFAULT_SIGNUP_ALERT_EMAIL = 'snipandglow.sales@pixalara.com';

/** Split a comma/semicolon/space separated env list into clean entries. */
export function parseRecipients(raw: string | undefined | null): string[] {
  return (raw || '')
    .split(/[,;\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Email recipients for signup alerts.
 *
 * SIGNUP_ALERT_EMAILS wins when set; otherwise alerts go to the sales mailbox
 * that already handles demo bookings. Deliberately never returns an empty list,
 * so a missing env var can't silently swallow signup notifications.
 */
export function signupAlertEmails(): string[] {
  const explicit = parseRecipients(process.env.SIGNUP_ALERT_EMAILS).map((e) => e.toLowerCase());
  if (explicit.length > 0) return Array.from(new Set(explicit));
  return [DEFAULT_SIGNUP_ALERT_EMAIL];
}

/**
 * Split a phone list on separators only, NOT on whitespace - a number is very
 * naturally pasted as "+91 98765 43210" and splitting that would destroy it.
 * normalizePhone strips the inner spaces afterwards.
 */
export function parsePhoneList(raw: string | undefined | null): string[] {
  return (raw || '')
    .split(/[,;\n\r]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * WhatsApp recipients, normalised to E.164 digits. Anything that is not a valid
 * 12-digit Indian number is dropped rather than risk messaging a wrong number.
 */
export function signupAlertWhatsAppNumbers(): string[] {
  const nums = parsePhoneList(process.env.SIGNUP_ALERT_WHATSAPP)
    .map((n) => normalizePhone(n))
    .filter((n) => n.length === 12);
  return Array.from(new Set(nums));
}

/** Human date in IST, e.g. "24 Aug 2026". */
export function formatAlertDate(iso: string | null | undefined): string {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  });
}

/** "Pune, Maharashtra - 411001" from whichever parts exist. */
export function formatAlertLocation(a: SignupAlert): string {
  const place = [a.city, a.state].map((v) => (v || '').trim()).filter(Boolean).join(', ');
  const pin = (a.pincode || '').trim();
  if (place && pin) return `${place} - ${pin}`;
  return place || pin || '-';
}

/** Link to the tenant in the admin panel (absolute when APP_URL is configured). */
export function adminTenantLink(tenantId: string): string {
  const base = (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/+$/, '');
  return base ? `${base}/admin/tenants/${tenantId}` : `/admin/tenants/${tenantId}`;
}

export function signupAlertSubject(alert: SignupAlert): string {
  const code = alert.tenantCode ? ` (${alert.tenantCode})` : '';
  return `New signup: ${alert.salonName}${code}`;
}

/** Salon name with its tenant code appended when known. */
export function salonLabel(alert: SignupAlert): string {
  return alert.salonName + (alert.tenantCode ? ` (${alert.tenantCode})` : '');
}

/** Display phone, always with a leading + and country code when derivable. */
export function displayPhone(phone: string): string {
  return `+${normalizePhone(phone) || phone}`;
}

/** Body parameters for the approved WhatsApp template, in declared order. */
export function signupAlertTemplateParams(alert: SignupAlert): string[] {
  return [
    salonLabel(alert),
    alert.ownerName,
    displayPhone(alert.phone),
    formatAlertLocation(alert),
    formatAlertDate(alert.trialEnd),
  ];
}

/**
 * Short WhatsApp body. Also used as the plain-text part of the email and as the
 * free-form fallback when the approved template is unavailable.
 */
export function buildSignupAlertText(alert: SignupAlert): string {
  const lines = [
    'New SnipandGlow signup',
    '',
    `Salon: ${salonLabel(alert)}`,
    `Owner: ${alert.ownerName}`,
    `Phone: ${displayPhone(alert.phone)}`,
  ];
  const location = formatAlertLocation(alert);
  if (location !== '-') lines.push(`Location: ${location}`);
  if (alert.email) lines.push(`Email: ${alert.email}`);
  if (alert.trialEnd) lines.push(`Trial ends: ${formatAlertDate(alert.trialEnd)}`);
  lines.push('', adminTenantLink(alert.tenantId));
  return lines.join('\n');
}

const esc = (v: string) =>
  v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * Internal alert email. Deliberately plain and dense - this is an operational
 * notification for the platform team, not a marketing send, so it skips the
 * branded announcement layout and stays readable in any client.
 */
export function buildSignupAlertEmail(alert: SignupAlert): string {
  const link = adminTenantLink(alert.tenantId);
  const rows: [string, string][] = [
    ['Salon', salonLabel(alert)],
    ['Owner', alert.ownerName],
    ['Phone', displayPhone(alert.phone)],
  ];
  if (alert.email) rows.push(['Email', alert.email]);
  const location = formatAlertLocation(alert);
  if (location !== '-') rows.push(['Location', location]);
  if (alert.planTier) rows.push(['Plan', alert.planTier]);
  if (alert.trialEnd) rows.push(['Trial ends', formatAlertDate(alert.trialEnd)]);

  const cells = rows
    .map(
      ([k, v]) => `
          <tr>
            <td style="padding:10px 16px;border-bottom:1px solid #f1f5f9;font:13px Arial,sans-serif;color:#64748b;white-space:nowrap;">${esc(k)}</td>
            <td style="padding:10px 16px;border-bottom:1px solid #f1f5f9;font:600 14px Arial,sans-serif;color:#0f172a;">${esc(v)}</td>
          </tr>`
    )
    .join('');

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:24px 12px;background:#f1f5f9;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:14px;overflow:hidden;">
    <tr>
      <td style="padding:20px 24px;background:#0f172a;">
        <div style="font:700 11px Arial,sans-serif;letter-spacing:1.4px;color:#d946ef;">SNIPANDGLOW</div>
        <div style="font:700 20px Arial,sans-serif;color:#ffffff;padding-top:6px;">New salon signed up</div>
      </td>
    </tr>
    <tr>
      <td style="padding:8px 8px 0 8px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">${cells}
        </table>
      </td>
    </tr>
    <tr>
      <td style="padding:20px 24px 26px 24px;">
        <a href="${esc(link)}" style="display:inline-block;background:#d946ef;color:#ffffff;font:700 14px Arial,sans-serif;text-decoration:none;padding:12px 22px;border-radius:8px;">Open in admin panel</a>
        <div style="font:12px Arial,sans-serif;color:#94a3b8;padding-top:14px;">Automated alert from SnipandGlow.</div>
      </td>
    </tr>
  </table>
</body></html>`;
}
