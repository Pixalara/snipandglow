// =============================================================================
// Auto welcome message for newly added customers.
//
// Best-effort: sends the tenant's approved welcome MARKETING template from their
// OWN (dedicated) WhatsApp number, but ONLY when BOTH gates pass:
//   1. The tenant is Pro/Growth with a connected dedicated number
//      (getDedicatedCredentialsForTenant returns null in every other case, so it
//      never falls back to the shared Snip and Glow number for marketing).
//   2. An approved welcome template exists on their WABA. It is resolved LIVE
//      from Meta (so one created directly in WhatsApp Manager counts, not only
//      ones made via our composer) and sent in that template's OWN language, so
//      a Gujarati template is delivered in Gujarati automatically.
//
// This must NEVER throw or block: the customer has already been created by the
// time this runs, and a WhatsApp hiccup must not fail that. Returns true only
// when Meta actually accepted the message, so the dashboard can show an accurate
// "welcome message sent" confirmation.
// =============================================================================

import { createAdminClient } from '@/lib/supabase/admin';
import { getDedicatedCredentialsForTenant } from './tenant-router';
import { listTemplates } from './template-management';
import { sendMessage } from './templates';
import { logWhatsAppMessage } from './log-message';

// Accepted welcome-template names, in PRIORITY order (first APPROVED match wins).
// Resolved live from the tenant's WABA, so a template the salon created directly
// in WhatsApp Manager - e.g. a Gujarati one - is used without needing our local
// mirror. A localized name is listed first so it wins over the default English
// template when both are approved. The matched template's own language is used
// when sending, so `gu` content is delivered in Gujarati.
const WELCOME_TEMPLATE_NAMES = ['welcome_message_v1', 'welcome_new_customer_v2', 'welcome_new_customer'];

export async function sendWelcomeMessage(
  tenantId: string,
  customer: { name: string; phone: string }
): Promise<boolean> {
  try {
    if (!tenantId || !customer?.phone) return false;

    // Gate 1 — plan + connected dedicated number (null otherwise).
    const credentials = await getDedicatedCredentialsForTenant(tenantId);
    if (!credentials) return false;

    // Gate 2 — an approved welcome template must exist on this tenant's WABA.
    // Read live (includes Manager-created templates), then pick the first name
    // in our priority list that has an APPROVED template, and keep its language.
    const remote = await listTemplates(credentials);
    let tpl: { name: string; language: string } | undefined;
    for (const name of WELCOME_TEMPLATE_NAMES) {
      const match = remote.find((t) => t.name === name && t.status === 'APPROVED');
      if (match) {
        tpl = { name: match.name, language: match.language || 'en' };
        break;
      }
    }
    if (!tpl) return false;

    const admin = createAdminClient();
    const { data: tenant } = await admin
      .from('tenants')
      .select('name')
      .eq('id', tenantId)
      .single();
    const salonName = (((tenant?.name as string) || '').trim()) || 'our salon';

    const phone = customer.phone.replace(/\D/g, '');
    const res = await sendMessage(credentials, phone, {
      type: 'template',
      template: {
        name: tpl.name,
        language: { code: tpl.language },
        components: [
          {
            type: 'body',
            parameters: [
              { type: 'text', text: customer.name }, // {{1}} customer name
              { type: 'text', text: salonName },      // {{2}} salon name
            ],
          },
        ],
      },
    });

    await logWhatsAppMessage(admin, {
      tenant_id: tenantId,
      phone,
      direction: 'outbound',
      template_name: tpl.name,
      status: res.success ? 'sent' : 'failed',
      metadata: { customer_name: customer.name, trigger: 'customer_created', language: tpl.language },
    });

    return res.success;
  } catch (e) {
    // Non-fatal: the customer is already created; never surface this as an error.
    console.error('[Welcome] auto-send failed (non-fatal):', e);
    return false;
  }
}
