// =============================================================================
// Generic, reusable feature-announcement email template.
// Pure module (no server-only deps) so it can render on the client for preview
// AND on the server for sending. Content is fully configurable per campaign.
// =============================================================================

const BRAND = {
  name: 'SnipandGlow',
  site: 'https://snipandglow.com',
  logo: 'https://snipandglow.com/android-chrome-512x512.png',
  supportEmail: 'updates@pixalara.com',
  company: 'Pixalara LLP',
  address: 'Bengaluru, Karnataka, India',
};

export interface AnnouncementBullet {
  title: string;
  body: string;
}

export interface AnnouncementCampaign {
  subject: string;
  eyebrow: string;
  headline: string;
  greeting: string;
  intro: string;
  bullets: AnnouncementBullet[];
  ctaLabel: string;
  ctaUrl: string;
  footerNote?: string;
}

/** Default preset — the Customer Wallet announcement. */
export const DEFAULT_CAMPAIGN: AnnouncementCampaign = {
  subject: 'New in SnipandGlow: Customer Wallet for your salon',
  eyebrow: 'New feature \u00b7 Customer Wallet',
  headline: 'Let your clients prepay & spend from a salon wallet',
  greeting: 'Hi {salon},',
  intro:
    'we\u2019ve just rolled out Customer Wallet in SnipandGlow. Now clients can load balance in advance and you can auto-apply it on any bill \u2014 perfect for advance packages and loyal regulars.',
  bullets: [
    { title: 'Prepaid balance', body: 'Top up any client\u2019s wallet in seconds, with an optional promotional bonus for advance packages.' },
    { title: 'Auto-deduct on bills', body: 'Pay fully from the wallet, or split it \u2014 part wallet, part cash/UPI/card \u2014 right from the bill screen.' },
    { title: 'Instant WhatsApp receipts', body: 'Every top-up and payment sends the client a branded receipt automatically.' },
    { title: 'Safe & tracked', body: 'A \u20b950,000/year top-up limit per client and a full transaction ledger keep balances clean.' },
  ],
  ctaLabel: 'Try Customer Wallet',
  ctaUrl: 'https://snipandglow.com/dashboard/customers',
  footerNote: 'Find it on any client\u2019s profile under Wallet \u2192 Add Balance.',
};

function esc(s = ''): string {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function renderAnnouncementEmail(
  campaign: AnnouncementCampaign,
  opts: { salonName?: string } = {}
): { subject: string; html: string; text: string } {
  const { salonName } = opts;
  const greetName = salonName && salonName.trim() ? `${esc(salonName.trim())} team` : 'there';
  const greetingLine = esc(campaign.greeting || 'Hi {salon},').replace('{salon}', greetName);
  const cta = campaign.ctaUrl || BRAND.site;
  const subject = campaign.subject || 'An update from SnipandGlow';
  const preheader = (campaign.intro || '').slice(0, 140);

  const bulletRows = (campaign.bullets || [])
    .filter((b) => (b.title && b.title.trim()) || (b.body && b.body.trim()))
    .map(
      (b) => `
        <tr>
          <td style="padding:0 0 14px 0;vertical-align:top;width:34px;">
            <div style="width:26px;height:26px;border-radius:8px;background:linear-gradient(135deg,#ec4899,#8b5cf6);color:#ffffff;font-size:14px;line-height:26px;text-align:center;">&#10003;</div>
          </td>
          <td style="padding:0 0 14px 0;vertical-align:top;">
            <div style="font:600 15px/1.35 Arial,Helvetica,sans-serif;color:#0f172a;">${esc(b.title)}</div>
            <div style="font:400 14px/1.5 Arial,Helvetica,sans-serif;color:#475569;margin-top:2px;">${esc(b.body)}</div>
          </td>
        </tr>`
    )
    .join('');

  const bulletsBlock = bulletRows
    ? `<tr><td style="padding:22px 32px 6px 32px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${bulletRows}</table></td></tr>`
    : '';

  const footerNoteBlock = campaign.footerNote
    ? `<p style="font:400 13px/1.5 Arial,Helvetica,sans-serif;color:#94a3b8;margin:14px 0 0 0;">${esc(campaign.footerNote)}</p>`
    : '';

  const html = `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta name="x-apple-disable-message-reformatting" />
<title>${esc(subject)}</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;-webkit-font-smoothing:antialiased;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(preheader)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;">
    <tr>
      <td align="center" style="padding:24px 12px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:100%;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 8px 30px rgba(15,23,42,0.08);">
          <tr>
            <td style="background:linear-gradient(135deg,#ec4899 0%,#d946ef 50%,#8b5cf6 100%);padding:26px 32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
                <td style="vertical-align:middle;">
                  <table role="presentation" cellpadding="0" cellspacing="0" style="display:inline-block;vertical-align:middle;"><tr>
                    <td style="background:#ffffff;border-radius:12px;padding:7px;box-shadow:0 2px 8px rgba(0,0,0,0.18);" valign="middle">
                      <img src="${BRAND.logo}" width="30" height="30" alt="${BRAND.name}" style="display:block;border-radius:7px;" />
                    </td>
                    <td style="padding-left:12px;" valign="middle">
                      <span style="font:800 21px/1 Arial,Helvetica,sans-serif;color:#ffffff;letter-spacing:-0.2px;">SnipandGlow</span>
                    </td>
                  </tr></table>
                </td>
                <td align="right" style="vertical-align:middle;">
                  <span style="display:inline-block;background:rgba(255,255,255,0.18);color:#ffffff;font:700 10px/1 Arial,Helvetica,sans-serif;letter-spacing:0.8px;text-transform:uppercase;padding:6px 11px;border-radius:999px;">Product Update</span>
                </td>
              </tr></table>
            </td>
          </tr>
          <tr>
            <td style="padding:34px 32px 8px 32px;">
              ${campaign.eyebrow ? `<div style="display:inline-block;background:#fdf2f8;color:#a21caf;font:700 11px/1 Arial,Helvetica,sans-serif;letter-spacing:0.5px;padding:7px 12px;border-radius:999px;text-transform:uppercase;">${esc(campaign.eyebrow)}</div>` : ''}
              <h1 style="font:800 26px/1.25 Arial,Helvetica,sans-serif;color:#0f172a;margin:16px 0 10px 0;">${esc(campaign.headline)}</h1>
              <p style="font:400 15px/1.6 Arial,Helvetica,sans-serif;color:#475569;margin:0;">${greetingLine} ${esc(campaign.intro)}</p>
            </td>
          </tr>
          ${bulletsBlock}
          <tr>
            <td style="padding:18px 32px 34px 32px;">
              <table role="presentation" cellpadding="0" cellspacing="0"><tr>
                <td style="border-radius:12px;background:linear-gradient(135deg,#ec4899,#8b5cf6);">
                  <a href="${esc(cta)}" style="display:inline-block;padding:14px 28px;font:700 15px/1 Arial,Helvetica,sans-serif;color:#ffffff;text-decoration:none;border-radius:12px;">${esc(campaign.ctaLabel || 'Open SnipandGlow')} &rarr;</a>
                </td>
              </tr></table>
              ${footerNoteBlock}
            </td>
          </tr>
          <tr>
            <td style="padding:22px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;">
              <p style="font:400 12px/1.6 Arial,Helvetica,sans-serif;color:#94a3b8;margin:0;">
                You\u2019re receiving this because you have a ${BRAND.name} account.<br />
                Questions? Reply to this email or write to <a href="mailto:${BRAND.supportEmail}" style="color:#8b5cf6;text-decoration:none;">${BRAND.supportEmail}</a>.
              </p>
              <p style="font:400 11px/1.5 Arial,Helvetica,sans-serif;color:#cbd5e1;margin:12px 0 0 0;">${BRAND.name} by ${BRAND.company} &middot; ${BRAND.address}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = [
    subject,
    '',
    `${(campaign.greeting || 'Hi {salon},').replace('{salon}', salonName && salonName.trim() ? salonName.trim() + ' team' : 'there')} ${campaign.intro}`,
    '',
    ...(campaign.bullets || [])
      .filter((b) => b.title || b.body)
      .map((b) => `- ${b.title}${b.body ? ': ' + b.body : ''}`),
    '',
    `${campaign.ctaLabel || 'Open'}: ${cta}`,
    campaign.footerNote ? campaign.footerNote : '',
    '',
    `Questions? ${BRAND.supportEmail}`,
    `${BRAND.name} by ${BRAND.company}, ${BRAND.address}`,
  ]
    .filter((l) => l !== undefined)
    .join('\n');

  return { subject, html, text };
}
