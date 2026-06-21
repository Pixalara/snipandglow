'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';
import type { ActionResult } from '@/types';

interface CreateTicketInput {
  subject: string;
  description: string;
  category: string;
  priority: string;
}

/**
 * Create a support ticket and send notification to team WhatsApp.
 */
export async function createSupportTicket(input: CreateTicketInput): Promise<ActionResult<{ id: string }>> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not authenticated' };

  const tenantId = user.user_metadata?.tenant_id;
  const branchId = user.user_metadata?.branch_id;
  const userName = user.user_metadata?.name ?? user.email ?? 'User';
  const userPhone = user.user_metadata?.phone ?? user.phone ?? '';

  if (!tenantId || !branchId) {
    return { success: false, error: 'No tenant context found.' };
  }

  if (!input.subject.trim()) {
    return { success: false, error: 'Subject is required.' };
  }
  if (!input.description.trim()) {
    return { success: false, error: 'Please describe your issue.' };
  }

  const admin = createAdminClient();

  // Get tenant name for the notification
  const { data: tenant } = await admin
    .from('tenants')
    .select('name')
    .eq('id', tenantId)
    .single();

  const salonName = tenant?.name ?? 'Unknown Salon';

  // Insert support ticket
  const { data: ticket, error } = await (admin
    .from('support_tickets' as any)
    .insert({
      tenant_id: tenantId,
      branch_id: branchId,
      user_id: user.id,
      user_name: userName,
      user_phone: userPhone,
      salon_name: salonName,
      subject: input.subject.trim(),
      description: input.description.trim(),
      category: input.category,
      priority: input.priority,
      status: 'open',
    })
    .select('id')
    .single() as any);

  if (error) {
    console.error('Support ticket creation error:', error);
    return { success: false, error: 'Failed to submit ticket. Please try again.' };
  }

  // Send WhatsApp notification to support team via Web3Forms (as email backup)
  // This ensures the team gets notified even without WhatsApp API
  try {
    await fetch('https://api.web3forms.com/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        access_key: '9b7f9972-8fc2-468f-80a6-029eb5af4a91',
        subject: `🎫 Support Ticket: ${input.subject}`,
        from_name: `${userName} (${salonName})`,
        message: `
New Support Ticket
━━━━━━━━━━━━━━━━━━
Salon: ${salonName}
User: ${userName}
Phone: ${userPhone}
Category: ${input.category}
Priority: ${input.priority}
━━━━━━━━━━━━━━━━━━
Subject: ${input.subject}
━━━━━━━━━━━━━━━━━━
${input.description}
━━━━━━━━━━━━━━━━━━
Ticket ID: ${ticket?.id ?? 'N/A'}
        `.trim(),
      }),
    });
  } catch {
    // Don't fail the ticket creation if notification fails
  }

  revalidatePath('/dashboard/support');
  return { success: true, data: { id: ticket?.id ?? '' } };
}
