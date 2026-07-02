import 'server-only';
import nodemailer, { type Transporter } from 'nodemailer';

// =============================================================================
// SMTP transport (Zoho) — shared server-side email sender.
//
// Reuses the same provider the app already uses for OTP mail. Configure via env:
//   SMTP_HOST      default smtp.zoho.in
//   SMTP_PORT      default 465
//   SMTP_EMAIL     the authenticated mailbox (must be a verified sender)
//   SMTP_PASSWORD  Zoho app password
//   MAIL_FROM      default "SnipandGlow <${SMTP_EMAIL}>"
// =============================================================================

export function isEmailConfigured(): boolean {
  return Boolean(process.env.SMTP_EMAIL && process.env.SMTP_PASSWORD);
}

/** Which required env keys are missing (for admin diagnostics; no values leaked). */
export function missingEmailEnv(): string[] {
  const missing: string[] = [];
  if (!process.env.SMTP_EMAIL) missing.push('SMTP_EMAIL');
  if (!process.env.SMTP_PASSWORD) missing.push('SMTP_PASSWORD');
  return missing;
}

export function getMailFrom(): string {
  // Prefer an explicit MAIL_FROM; otherwise default to the SnipandGlow brand
  // name on the configured (or updates@pixalara.com) mailbox.
  if (process.env.MAIL_FROM) return process.env.MAIL_FROM;
  const addr = process.env.SMTP_EMAIL || 'updates@pixalara.com';
  return `SnipandGlow <${addr}>`;
}

/** Address replies should go to (defaults to MAIL_FROM's mailbox). */
export function getReplyTo(): string {
  return process.env.MAIL_REPLY_TO || process.env.SMTP_EMAIL || 'updates@pixalara.com';
}

let cached: Transporter | null = null;

export function getTransporter(): Transporter {
  if (cached) return cached;
  const host = process.env.SMTP_HOST || 'smtp.zoho.in';
  const port = parseInt(process.env.SMTP_PORT || '465', 10);
  cached = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: {
      user: process.env.SMTP_EMAIL,
      pass: process.env.SMTP_PASSWORD,
    },
  });
  return cached;
}

/** Send a single email. Throws on failure so callers can record per-recipient status. */
export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
  text?: string;
  from?: string;
  replyTo?: string;
}): Promise<string> {
  const transporter = getTransporter();
  const info = await transporter.sendMail({
    from: opts.from || getMailFrom(),
    to: opts.to,
    replyTo: opts.replyTo || getReplyTo(),
    subject: opts.subject,
    html: opts.html,
    text: opts.text,
  });
  return info.messageId;
}
