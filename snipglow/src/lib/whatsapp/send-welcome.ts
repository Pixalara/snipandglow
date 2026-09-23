// =============================================================================
// Auto welcome message for newly added customers.
//
// Best-effort: sends the approved `welcome_new_customer` MARKETING template from
// the tenant's OWN (dedicated) WhatsApp number, but ONLY when BOTH gates pass:
//   1. The tenant is Pro/Growth with a connected dedicated number
//      (getDedicatedCredentialsForTenant returns null in every other case, so it
//      never falls back to the shared Snip and Glow number for marketing).
//   2. The `welcome_new_customer` template is APPROVED on their WABA.
//
// This must NEVER throw or block: the customer has already been created by the
// time this runs, and a WhatsApp hiccup must not fail that. Returns true only
// when Meta actually accepted the message, so the dashboard can show an accurate
// "welcome message sent" confirmation.
// =============================================================================

import { createAdminClient } from '@/lib/supabase/admin';
import { getDedicatedCredentialsForTenant } from './tenant-router';
import { listTenantTemplates } from './template-store';
import { sendMessage } from './templates';
import { logWhatsAppMessage } from './log-message';

// Accepted welcome-template names, newest first. A list (not one constant) so a
// re-submitted template - e.g. `welcome_new_customer_v2` created after the first
// got stuck in Meta review - keeps working: whichever name is APPROVED first on
// the tenant's WABA is the one we send. Meta locks a deleted template's name for
// ~30 days, so a fresh submission must use a new name; this makes that seamless.
const WELCOME_TEMPLATE_NAMES = ['welcome_new_customer_v2', 'welcome_new_customer'];

export async function sendWelcomeMessage(
  tenantId: string,
  customer: { name: string; phone: string }
): Promise<boolean> {
  try {
    if (!tenantId || !customer?.phone) return false;

    // Gate 1 — plan + connected dedicated number (null otherwise).
    const credentials = await getDedicatedCredentialsForTenant(tenantId);
    if (!credentials) return false;

    // Gate 2 — an accepted welcome template must be APPROVED on this tenant's WABA.
    const templates = await listTenantTemplates(tenantId);
    const tpl = templates.find(
      (t) => WELCOME_TEMPLATE_NAMES.includes(t.name) && t.status === 'APPROVED'
    );
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
        language: { code: tpl.language || 'en' },
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
      metadata: { customer_name: customer.name, trigger: 'customer_created' },
    });

    return res.success;
  } catch (e) {
    // Non-fatal: the customer is already created; never surface this as an error.
    console.error('[Welcome] auto-send failed (non-fatal):', e);
    return false;
  }
}
