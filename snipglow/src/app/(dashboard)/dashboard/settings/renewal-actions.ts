'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import type { ActionResult } from '@/types';

// =============================================================================
// Interim subscription renewal request.
//
// Razorpay checkout is not live yet. Until it is, an owner whose trial/plan has
// expired submits a renewal request from Settings; this notifies the platform
// team (Web3Forms) so they can take payment offline and activate the plan from
// the admin panel. When Razorpay goes live, replace this with a real checkout.
// =============================================================================

const WEB3FORMS_ENDPOINT = 'https://api.web3forms.com/submit';
const WEB3FORMS_ACCESS_KEY = '75debe40-e347-41ce-a203-93266c993232';

export async function requestSubscriptionRenewal(): Promise<ActionResult<{ emailPayload: Record<string, string> }>> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not authenticated' };

  const tenantId = user.user_metadata?.tenant_id as string | undefined;
  if (!tenantId) return { success: false, error: 'No tenant context found.' };

  // Only the owner can request renewal.
  if (user.user_metadata?.role !== 'owner') {
    return { success: false, error: 'Only the salon owner can request a renewal.' };
  }

  const admin = createAdminClient();
  const { data: tenant } = await (admin
    .from('tenants' as any)
    .select('name, tenant_code, owner_name, phone, plan_tier, subscription_status')
    .eq('id', tenantId)
    .single() as any);

  if (!tenant) return { success: false, error: 'Salon not found.' };

  const adminBase = process.env.NEXT_PUBLIC_APP_URL || '';
  const adminLink = adminBase ? `${adminBase}/admin/tenants/${tenantId}` : `/admin/tenants/${tenantId}`;

  // Structured payload mirroring the (working) client-side demo/contact forms.
  const emailPayload: Record<string, string> = {
    access_key: WEB3FORMS_ACCESS_KEY,
    subject: `💳 Subscription Renewal Request — ${tenant.name}`,
    from_name: 'SnipandGlow Renewals',
    salon: `${tenant.name}${tenant.tenant_code ? ` (${tenant.tenant_code})` : ''}`,
    owner: tenant.owner_name || '—',
    phone: tenant.phone || '—',
    current_plan: tenant.plan_tier || 'starter',
    current_status: tenant.subscription_status || '—',
    requested_by: user.email || tenant.phone || 'owner',
    admin_link: adminLink,
  };

  // Best-effort server-side send (now response-checked + logged). The modal also
  // submits this client-side, which is the reliable path Web3Forms accepts.
  try {
    const resp = await fetch(WEB3FORMS_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(emailPayload),
    });
    const result = await resp.json().catch(() => null);
    if (!resp.ok || !result?.success) {
      console.error('[requestSubscriptionRenewal] Web3Forms rejected:', resp.status, result);
    }
  } catch (err) {
    console.error('[requestSubscriptionRenewal] alert failed:', err);
    // Non-fatal: still record the request so the team can follow up.
  }

  // Mark the request on the tenant settings so the UI can reflect "request sent"
  // and the admin sees it.
  try {
    const { data: cur } = await (admin.from('tenants' as any).select('settings').eq('id', tenantId).single() as any);
    const settings = (cur?.settings as Record<string, unknown>) ?? {};
    await (admin
      .from('tenants' as any)
      .update({ settings: { ...settings, renewal_requested_at: new Date().toISOString() } } as any)
      .eq('id', tenantId) as any);
  } catch (err) {
    console.error('[requestSubscriptionRenewal] settings update failed:', err);
  }

  return { success: true, data: { emailPayload } };
}
