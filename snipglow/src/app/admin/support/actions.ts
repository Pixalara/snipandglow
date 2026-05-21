'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin, logAdminAction } from '@/lib/admin/auth';
import { getPlatformCredentials } from '@/lib/whatsapp/config';
import { sendMessage } from '@/lib/whatsapp/templates';
import { revalidatePath } from 'next/cache';

const STATUS_LABELS: Record<string, string> = {
  open: 'Open',
  acknowledged: 'Acknowledged',
  in_progress: 'In Progress',
  resolved: 'Resolved',
  closed: 'Closed',
};

const STATUS_EMOJI: Record<string, string> = {
  open: '🔵',
  acknowledged: '👀',
  in_progress: '🔧',
  resolved: '✅',
  closed: '🔒',
};

/**
 * Update a support ticket status (admin only).
 * Sends WhatsApp notification to the tenant owner.
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

  // Fetch ticket details for notification
  const { data: ticket } = await (admin
    .from('support_tickets' as any)
    .select('id, ticket_number, subject, user_phone, user_name, salon_name, status')
    .eq('id', ticketId)
    .single() as any);

  if (!ticket) {
    return { success: false, error: 'Ticket not found.' };
  }

  // Update status
  const { error } = await (admin
    .from('support_tickets' as any)
    .update({ status: newStatus, updated_at: new Date().toISOString() } as any)
    .eq('id', ticketId) as any);

  if (error) {
    return { success: false, error: 'Failed to update ticket.' };
  }

  // Log admin action
  await logAdminAction({
    adminUserId: user.id,
    adminEmail: user.email || '',
    action: 'update_ticket_status',
    targetType: 'support_ticket',
    targetId: ticketId,
    metadata: { ticket_number: ticket.ticket_number, new_status: newStatus, old_status: ticket.status },
  });

  // Send WhatsApp notification to tenant owner
  await notifyTicketStatusChange(ticket, newStatus);

  revalidatePath('/admin/support');
  return { success: true };
}

/**
 * Send WhatsApp notification to tenant about ticket status change.
 */
async function notifyTicketStatusChange(ticket: any, newStatus: string) {
  try {
    const credentials = getPlatformCredentials();
    if (!credentials || !ticket.user_phone) return;

    const phone = ticket.user_phone.replace(/\D/g, '');
    if (!phone || phone.length < 10) return;

    const emoji = STATUS_EMOJI[newStatus] || '📋';
    const statusLabel = STATUS_LABELS[newStatus] || newStatus;
    const ticketNum = ticket.ticket_number || ticket.id.substring(0, 8);

    let message = `${emoji} *Support Ticket Update*\n\n`;
    message += `Ticket: *${ticketNum}*\n`;
    message += `Subject: ${ticket.subject}\n`;
    message += `Status: *${statusLabel}*\n\n`;

    if (newStatus === 'acknowledged') {
      message += `Our team has acknowledged your ticket and will look into it shortly.`;
    } else if (newStatus === 'in_progress') {
      message += `Our team is actively working on your issue. We'll update you once resolved.`;
    } else if (newStatus === 'resolved') {
      message += `Your issue has been resolved! If you still face any problems, please reply to this message or create a new ticket.`;
    } else if (newStatus === 'closed') {
      message += `This ticket has been closed. Thank you for reaching out!`;
    }

    message += `\n\n— SnipandGlow Support Team`;

    await sendMessage(credentials, phone, {
      type: 'text',
      text: { body: message },
    });
  } catch (err) {
    console.error('[Admin Support] Failed to send WhatsApp notification:', err);
  }
}
