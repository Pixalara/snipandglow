// =============================================================================
// Customer Wallet — feature announcement email template.
// Email-client-safe HTML (table layout, 600px, inline styles).
// =============================================================================

const BRAND = {
  name: 'SnipandGlow',
  site: 'https://snipandglow.com',
  logo: 'https://snipandglow.com/android-chrome-512x512.png',
  supportEmail: 'hello@snipandglow.com',
  company: 'Pixalara LLP',
  address: 'Bengaluru, Karnataka, India',
};

function esc(s = ''): string {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function renderWalletEmail(opts: {
  salonName?: string;
  ctaUrl?: string;
  unsubscribeUrl?: string;
} = {}): { subject: string; html: string; text: string } {
  const { salonName, ctaUrl, unsubscribeUrl } = opts;
  const greetName = salonName && salonName.trim() ? `${esc(salonName.trim())} team` : 'there';
  const cta = ctaUrl || `${BRAND.site}/dashboard/customers`;
  const subject = 'New in SnipandGlow: Customer Wallet for your salon';
  const preheader =
    'Let clients prepay and spend from a salon wallet — auto-deducted on bills, with instant WhatsApp receipts.';

  const features: [string, string][] = [
    ['Prepaid balance', 'Top up any client\u2019s wallet in seconds, with an optional promotional bonus for advance packages.'],
    ['Auto-deduct on bills', 'Pay fully from the wallet, or split it \u2014 part wallet, part cash/UPI/card \u2014 right from the bill screen.'],
    ['Instant WhatsApp receipts', 'Every top-up and payment sends the client a branded receipt automatically.'],
    ['Safe & tracked', 'A \u20b950,000/year top-up limit per client and a full transaction ledger keep balances clean.'],
  ];

  const featureRows = features
    .map(
      ([title, body]) => `
        <tr>
          <td style="padding:0 0 14px 0;vertical-align:top;width:34px;">
            <div style="width:26px;height:26px;border-radius:8px;background:linear-gradient(135deg,#10b981,#0d9488);color:#ffffff;font-size:14px;line-height:26px;text-align:center;">&#10003;</div>
          </td>
          <td style="padding:0 0 14px 0;vertical-align:top;">
            <div style="font:600 15px/1.35 Arial,Helvetica,sans-serif;color:#0f172a;">${esc(title)}</div>
            <div style="font:400 14px/1.5 Arial,Helvetica,sans-serif;color:#475569;margin-top:2px;">${body}</div>
          </td>
        </tr>`
    )
    .join('');

  const unsubscribeRow = unsubscribeUrl
    ? `<div style="margin-top:10px;"><a href="${esc(unsubscribeUrl)}" style="color:#94a3b8;text-decoration:underline;">Unsubscribe from product updates</a></div>`
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
            <td style="background:linear-gradient(135deg,#ec4899 0%,#d946ef 50%,#8b5cf6 100%);padding:28px 32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
                <td style="vertical-align:middle;">
                  <img src="${BRAND.logo}" width="40" height="40" alt="${BRAND.name}" style="border-radius:10px;display:inline-block;vertical-align:middle;" />
                  <span style="font:800 20px/40px Arial,Helvetica,sans-serif;color:#ffffff;vertical-align:middle;margin-left:10px;">${BRAND.name}</span>
                </td>
                <td align="right" style="vertical-align:middle;font:600 12px/1 Arial,Helvetica,sans-serif;color:#ffffff;opacity:0.9;">Product Update</td>
              </tr></table>
            </td>
          </tr>
          <tr>
            <td style="padding:34px 32px 8px 32px;">
              <div style="display:inline-block;background:#ecfdf5;color:#047857;font:700 11px/1 Arial,Helvetica,sans-serif;letter-spacing:0.5px;padding:7px 12px;border-radius:999px;text-transform:uppercase;">New feature &middot; Customer Wallet</div>
              <h1 style="font:800 26px/1.25 Arial,Helvetica,sans-serif;color:#0f172a;margin:16px 0 10px 0;">Let your clients prepay &amp; spend from a salon wallet</h1>
              <p style="font:400 15px/1.6 Arial,Helvetica,sans-serif;color:#475569;margin:0;">Hi ${greetName}, we\u2019ve just rolled out <strong style="color:#0f172a;">Customer Wallet</strong> in ${BRAND.name}. Now clients can load balance in advance and you can auto-apply it on any bill \u2014 perfect for advance packages and loyal regulars.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:22px 32px 6px 32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg,#10b981,#0d9488);border-radius:14px;"><tr>
                <td style="padding:20px 22px;">
                  <div style="font:700 11px/1 Arial,Helvetica,sans-serif;color:#d1fae5;letter-spacing:0.6px;">WALLET BALANCE</div>
                  <div style="font:800 30px/1.1 Arial,Helvetica,sans-serif;color:#ffffff;margin-top:8px;">&#8377;2,000</div>
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:14px;">
                    <tr><td style="font:400 13px/1 Arial,Helvetica,sans-serif;color:#ecfdf5;padding:6px 0;">Top-up</td><td align="right" style="font:600 13px/1 Arial,Helvetica,sans-serif;color:#ffffff;padding:6px 0;">+ &#8377;2,000</td></tr>
                    <tr><td style="font:400 13px/1 Arial,Helvetica,sans-serif;color:#ecfdf5;padding:6px 0;border-top:1px solid rgba(255,255,255,0.25);">Haircut bill</td><td align="right" style="font:600 13px/1 Arial,Helvetica,sans-serif;color:#ffffff;padding:6px 0;border-top:1px solid rgba(255,255,255,0.25);">&#8722; &#8377;500</td></tr>
                  </table>
                </td>
              </tr></table>
            </td>
          </tr>
          <tr>
            <td style="padding:22px 32px 6px 32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${featureRows}</table>
            </td>
          </tr>
          <tr>
            <td style="padding:14px 32px 34px 32px;">
              <table role="presentation" cellpadding="0" cellspacing="0"><tr>
                <td style="border-radius:12px;background:linear-gradient(135deg,#ec4899,#8b5cf6);">
                  <a href="${esc(cta)}" style="display:inline-block;padding:14px 28px;font:700 15px/1 Arial,Helvetica,sans-serif;color:#ffffff;text-decoration:none;border-radius:12px;">Try Customer Wallet &rarr;</a>
                </td>
              </tr></table>
              <p style="font:400 13px/1.5 Arial,Helvetica,sans-serif;color:#94a3b8;margin:14px 0 0 0;">Find it on any client\u2019s profile under <strong style="color:#475569;">Wallet &rarr; Add Balance</strong>.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:22px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;">
              <p style="font:400 12px/1.6 Arial,Helvetica,sans-serif;color:#94a3b8;margin:0;">
                You\u2019re receiving this because you have a ${BRAND.name} account.<br />
                Questions? Reply to this email or write to <a href="mailto:${BRAND.supportEmail}" style="color:#8b5cf6;text-decoration:none;">${BRAND.supportEmail}</a>.
                ${unsubscribeRow}
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
    `New in ${BRAND.name}: Customer Wallet`,
    '',
    `Hi ${salonName && salonName.trim() ? salonName.trim() + ' team' : 'there'},`,
    '',
    'We just rolled out Customer Wallet. Clients can prepay a balance and you can auto-apply it on any bill.',
    '',
    '- Prepaid balance (with optional promotional bonus)',
    '- Auto-deduct on bills, or split part wallet / part cash-UPI-card',
    '- Instant WhatsApp receipts on every top-up and payment',
    '- Rs.50,000/year top-up limit per client + full ledger',
    '',
    `Try it: ${cta}`,
    'Find it on any client profile under Wallet > Add Balance.',
    '',
    `Questions? ${BRAND.supportEmail}`,
    `${BRAND.name} by ${BRAND.company}, ${BRAND.address}`,
    unsubscribeUrl ? `Unsubscribe: ${unsubscribeUrl}` : '',
  ].join('\n');

  return { subject, html, text };
}
