import { NextResponse } from 'next/server';
import { verifyWebhookSignature, activatePaidOrder } from '@/lib/razorpay/activate';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

// =============================================================================
// POST /api/payments/webhook   (Razorpay → us)
//
// Safety net: if the customer closes the tab before the browser callback runs,
// this still activates the subscription. Activation is idempotent, so it's fine
// for both paths to fire.
//
// Configure in the Razorpay dashboard (Developers → Webhooks):
//   URL     : https://<your-domain>/api/payments/webhook
//   Secret  : RAZORPAY_WEBHOOK_SECRET
//   Events  : payment.captured, order.paid, payment.failed
//
// IMPORTANT: always return 200 for handled-but-ignored cases so Razorpay does
// not retry indefinitely. Only signature failures return 400.
// =============================================================================

export async function POST(req: Request) {
  // The signature is computed over the RAW body — read text, never json() first.
  const rawBody = await req.text();
  const signature = req.headers.get('x-razorpay-signature') ?? '';

  if (!verifyWebhookSignature(rawBody, signature)) {
    console.error('[razorpay-webhook] invalid signature');
    return NextResponse.json({ status: 'invalid_signature' }, { status: 400 });
  }

  try {
    const event = JSON.parse(rawBody) as {
      event?: string;
      payload?: {
        payment?: { entity?: { id?: string; order_id?: string; error_description?: string } };
        order?: { entity?: { id?: string } };
      };
    };

    const type = event.event ?? '';
    const payment = event.payload?.payment?.entity;
    const orderId = payment?.order_id ?? event.payload?.order?.entity?.id ?? null;

    if (!orderId) {
      return NextResponse.json({ status: 'no_order_id' });
    }

    if (type === 'payment.captured' || type === 'order.paid') {
      const result = await activatePaidOrder({
        razorpayOrderId: orderId,
        razorpayPaymentId: payment?.id ?? null,
      });
      if (!result.ok && result.error !== 'ORDER_NOT_FOUND') {
        console.error('[razorpay-webhook] activation failed:', result.error, orderId);
      }
      return NextResponse.json({ status: 'ok', activated: result.ok });
    }

    if (type === 'payment.failed') {
      const admin = createAdminClient();
      await (admin
        .from('payment_orders' as any)
        .update({
          status: 'failed',
          razorpay_payment_id: payment?.id ?? null,
          notes: { error: payment?.error_description ?? 'payment failed' },
          updated_at: new Date().toISOString(),
        } as any)
        .eq('razorpay_order_id', orderId)
        .is('activated_at', null) as any);
      return NextResponse.json({ status: 'ok', recorded: 'failed' });
    }

    return NextResponse.json({ status: 'ignored', event: type });
  } catch (err) {
    console.error('[razorpay-webhook] processing error:', err);
    // 200 so Razorpay doesn't hammer us; the error is logged for follow-up.
    return NextResponse.json({ status: 'error_logged' });
  }
}
