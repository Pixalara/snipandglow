// =============================================================================
// Admin alert for new WhatsApp manual setup requests.
//
// Best-effort, fire-and-forget: sends an email to the platform team via
// Web3Forms (the same channel already used for demo bookings and support
// tickets) so the team is notified the moment a Pro/Growth tenant requests a
// dedicated WhatsApp setup — without having to watch the admin dashboard.
//
// This never throws: a notification failure must not abort the request itself.
// =============================================================================

const WEB3FORMS_ENDPOINT = 'https://api.web3forms.com/submit';
// Reuses the platform Web3Forms key already used for demo/support notifications.
const WEB3FORMS_ACCESS_KEY = '75debe40-e347-41ce-a203-93266c993232';

export interface SetupRequestAlert {
  salonName: string;
  tenantCode: string | null;
  tenantId: string;
  contactPhone: string;
  contactName: string | null;
  notes: string | null;
}

/**
 * Notify the platform team of a new WhatsApp setup request. Best-effort — any
 * failure is swallowed so the owner's request always succeeds.
 */
export async function notifyAdminOfSetupRequest(alert: SetupRequestAlert): Promise<void> {
  try {
    const adminBase = process.env.NEXT_PUBLIC_APP_URL || '';
    const adminLink = adminBase ? `${adminBase}/admin/tenants/${alert.tenantId}` : `/admin/tenants/${alert.tenantId}`;

    await fetch(WEB3FORMS_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        access_key: WEB3FORMS_ACCESS_KEY,
        subject: `📲 WhatsApp Setup Request — ${alert.salonName}`,
        from_name: 'SnipandGlow WhatsApp Onboarding',
        message: `
New WhatsApp API Setup Request
━━━━━━━━━━━━━━━━━━
Salon: ${alert.salonName}${alert.tenantCode ? ` (${alert.tenantCode})` : ''}
Requested number: ${alert.contactPhone}
Contact name: ${alert.contactName || '—'}
Notes: ${alert.notes || '—'}
━━━━━━━━━━━━━━━━━━
Activate: ${adminLink}
        `.trim(),
      }),
    });
  } catch (err) {
    // Best-effort: never abort the owner's request on a notification failure.
    console.error('[notifyAdminOfSetupRequest] Failed to send admin alert:', err);
  }
}
