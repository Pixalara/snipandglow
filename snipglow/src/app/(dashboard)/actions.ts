'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

/**
 * Switch the active branch for the current user.
 * Validates that the branch belongs to the user's tenant before updating.
 */
export async function switchBranch(branchId: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: 'Not authenticated' };
  }

  const tenantId = user.user_metadata?.tenant_id;
  if (!tenantId) {
    return { success: false, error: 'No tenant associated' };
  }

  // Verify the branch belongs to this tenant
  const { data: branch, error: branchError } = await supabase
    .from('branches')
    .select('id, tenant_id')
    .eq('id', branchId)
    .eq('tenant_id', tenantId)
    .single();

  if (branchError || !branch) {
    return { success: false, error: 'Branch not found or access denied' };
  }

  // Update user metadata with new branch_id
  const { error: updateError } = await supabase.auth.updateUser({
    data: { branch_id: branchId },
  });

  if (updateError) {
    return { success: false, error: 'Failed to switch branch' };
  }

  revalidatePath('/', 'layout');
  return { success: true };
}
