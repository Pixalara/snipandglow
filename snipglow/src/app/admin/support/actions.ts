'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin, logAdminAction } from '@/lib/admin/auth';
import { revalidatePath } from 'next/cache';

/**
 * Update a support ticket status (admin only).
 * Valid statuses: open → acknowledged → in_progress → resolved → closed
 */
export async function updateTicketStatus(
  ticketId: string,
  newStatus: string
): Promise<{ success: boolean; error?: string }> {
  const user = await requireAdmin();

  const validStatuses = ['open', 'acknowledged', 'in_progress', 'resolved', 'closed'];
  if (!validStatuses.includes(newStatus)) {
    return { success: false, error: 'Invalid status.' };
  }

  const admin = createAdminClient();

  const { error } = await (admin
    .from('support_tickets' as any)
    .update({ status: newStatus, updated_at: new Date().toISOString() } as any)
    .eq('id', ticketId) as any);

  if (error) {
    return { success: false, error: 'Failed to update ticket.' };
  }

  await logAdminAction({
    adminUserId: user.id,
    adminEmail: user.email || '',
    action: 'update_ticket_status',
    targetType: 'support_ticket',
    targetId: ticketId,
    metadata: { new_status: newStatus },
  });

  revalidatePath('/admin/support');
  return { success: true };
}
