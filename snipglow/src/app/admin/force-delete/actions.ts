'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin, logAdminAction } from '@/lib/admin/auth';

/**
 * Force delete a tenant — calls the delete_tenant_data RPC function.
 * Only accessible to platform admins.
 */
export async function forceDeleteTenant(tenantId: string): Promise<{ success: boolean; error?: string; data?: any }> {
  const user = await requireAdmin();

  if (!tenantId || typeof tenantId !== 'string' || tenantId.length < 10) {
    return { success: false, error: 'Invalid tenant ID.' };
  }

  const admin = createAdminClient();

  // Verify tenant exists
  const { data: tenant } = await (admin.from('tenants' as any).select('id, name, tenant_code').eq('id', tenantId).single() as any);
  if (!tenant) {
    return { success: false, error: 'Tenant not found.' };
  }

  // Log the attempt BEFORE deletion
  await logAdminAction({
    adminUserId: user.id,
    adminEmail: user.email || '',
    action: 'force_delete_tenant',
    targetType: 'tenant',
    targetId: tenantId,
    metadata: { tenant_name: tenant.name, tenant_code: tenant.tenant_code },
  });

  try {
    // Call the delete_tenant_data RPC function (uses session_replication_role = replica)
    const { data, error } = await (admin as any).rpc('delete_tenant_data', { target_tenant_id: tenantId });

    if (error) {
      await logAdminAction({
        adminUserId: user.id,
        adminEmail: user.email || '',
        action: 'force_delete_tenant_failed',
        targetType: 'tenant',
        targetId: tenantId,
        metadata: { error: error.message },
      });
      return { success: false, error: `Deletion failed: ${error.message}` };
    }

    return { success: true, data };
  } catch (err: any) {
    await logAdminAction({
      adminUserId: user.id,
      adminEmail: user.email || '',
      action: 'force_delete_tenant_failed',
      targetType: 'tenant',
      targetId: tenantId,
      metadata: { error: String(err) },
    });
    return { success: false, error: `Unexpected error: ${err.message || err}` };
  }
}
