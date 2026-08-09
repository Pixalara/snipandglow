'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

// =============================================================================
// First-run product tour state.
//
// Stored on the tenant (settings.tour_seen_at) rather than in localStorage so
// the tour shows exactly once per SALON, not once per browser - an owner who
// signs in from their phone after seeing it on a laptop should not see it again.
// =============================================================================

/** Mark the first-run tour as completed for the current tenant. */
export async function markTourSeen(): Promise<{ success: boolean }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false };

  const tenantId = user.user_metadata?.tenant_id as string | undefined;
  if (!tenantId) return { success: false };

  try {
    // Service role: writing tenant settings is an owner-level operation and the
    // tenant is taken from the verified session, never from the client.
    const admin = createAdminClient();
    const { data: tenant } = await admin
      .from('tenants')
      .select('settings')
      .eq('id', tenantId)
      .maybeSingle();

    const current = (tenant?.settings as Record<string, unknown> | null) ?? {};
    if (current.tour_seen_at) return { success: true }; // already recorded

    await admin
      .from('tenants')
      .update({ settings: { ...current, tour_seen_at: new Date().toISOString() } })
      .eq('id', tenantId);

    return { success: true };
  } catch (err) {
    console.error('[markTourSeen] failed:', err);
    // Non-fatal: the client also keeps a local flag, so the tour won't loop.
    return { success: false };
  }
}
