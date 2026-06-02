'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin, logAdminAction } from '@/lib/admin/auth';
import { revalidatePath } from 'next/cache';

// =============================================================================
// Admin — edit a tenant's GST details (even when locked).
// Only platform admins can call this (requireAdmin guards it).
// =============================================================================

export async function adminUpdateTenantGst(
  tenantId: string,
  input: {
    gst_number: string | null;
    gst_rate: number;
    legal_name: string | null;
    trade_name: string | null;
    locked: boolean;
  }
): Promise<{ success: boolean; error?: string }> {
  const user = await requireAdmin();

  if (!tenantId) return { success: false, error: 'Tenant ID required.' };

  const admin = createAdminClient();

  const { data: tenant } = await (admin
    .from('tenants' as any)
    .select('settings, name')
    .eq('id', tenantId)
    .single() as any);

  if (!tenant) return { success: false, error: 'Tenant not found.' };

  const currentSettings = (tenant.settings as Record<string, unknown>) ?? {};
  const hasGst = !!(input.gst_number && input.gst_number.trim());

  const updatedSettings = {
    ...currentSettings,
    gst_enabled: hasGst,
    gst_rate: hasGst ? input.gst_rate : 0,
    gst_number: input.gst_number,
    legal_name: input.legal_name,
    trade_name: input.trade_name,
    gst_locked: hasGst ? input.locked : false,
  };

  const { error } = await (admin
    .from('tenants' as any)
    .update({ settings: updatedSettings })
    .eq('id', tenantId) as any);

  if (error) {
    return { success: false, error: 'Failed to update GST details.' };
  }

  await logAdminAction({
    adminUserId: user.id,
    adminEmail: user.email || '',
    action: 'update_tenant_gst',
    targetType: 'tenant',
    targetId: tenantId,
    metadata: {
      tenant_name: tenant.name,
      gst_number: input.gst_number,
      gst_rate: input.gst_rate,
      locked: hasGst ? input.locked : false,
    },
  });

  revalidatePath(`/admin/tenants/${tenantId}`);
  return { success: true };
}
