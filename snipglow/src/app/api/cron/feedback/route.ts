import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getPlatformCredentials } from '@/lib/whatsapp/config';
import { sendMessage } from '@/lib/whatsapp/templates';

// =============================================================================
// Cron: Send Feedback Request — Runs every 15 minutes
// Finds invoices created ~1 hour ago that haven't had feedback sent yet.
// Sends a WhatsApp feedback message to the customer.
// =============================================================================

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  // Verify cron secret (Vercel sends this header for cron jobs)
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const credentials = getPlatformCredentials();
  if (!credentials) {
    return NextResponse.json({ error: 'WhatsApp not configured' }, { status: 500 });
  }

  const admin = createAdminClient();

  // Find invoices created between 1 hour and 25 hours ago with delivery_status = 'pending'
  // Runs once daily, so we check a 24-hour window (1h to 25h ago)
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
  const twentyFiveHoursAgo = new Date(now.getTime() - 25 * 60 * 60 * 1000).toISOString();

  const { data: invoices, error } = await (admin
    .from('invoices')
    .select('id, customer_id, tenant_id')
    .eq('payment_status', 'paid')
    .eq('delivery_status', 'pending')
    .gte('created_at', twentyFiveHoursAgo)
    .lte('created_at', oneHourAgo)
    .limit(20) as any);

  if (error || !invoices || invoices.length === 0) {
    return NextResponse.json({ status: 'ok', sent: 0 });
  }

  let sent = 0;

  for (const invoice of invoices) {
    try {
      // Get customer details
      const { data: customer } = await admin
        .from('customers')
        .select('name, phone')
        .eq('id', invoice.customer_id)
        .single();

      if (!customer?.phone) continue;

      // Get salon name
      const { data: tenant } = await admin
        .from('tenants')
        .select('name')
        .eq('id', invoice.tenant_id)
        .single();

      const salonName = tenant?.name || 'the salon';
      const phone = customer.phone.replace(/\D/g, '');

      // Send feedback request
      await sendMessage(credentials, phone, {
        type: 'interactive',
        interactive: {
          type: 'button',
          body: {
            text: `⭐ Hi ${customer.name}! How was your experience at *${salonName}* today?\n\nYour feedback helps us serve you better. Tap to rate:`,
          },
          action: {
            buttons: [
              { type: 'reply', reply: { id: 'feedback_5', title: '⭐⭐⭐⭐⭐ Loved it!' } },
              { type: 'reply', reply: { id: 'feedback_3', title: '⭐⭐⭐ It was okay' } },
              { type: 'reply', reply: { id: 'feedback_1', title: '😞 Not satisfied' } },
            ],
          },
        },
      });

      // Mark as feedback sent
      await (admin
        .from('invoices')
        .update({ delivery_status: 'feedback_sent' } as any)
        .eq('id', invoice.id) as any);

      sent++;
    } catch (err) {
      console.error('[Cron Feedback] Error for invoice', invoice.id, err);
    }
  }

  return NextResponse.json({ status: 'ok', sent, total: invoices.length });
}
