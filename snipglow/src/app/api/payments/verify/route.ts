import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { verifyCheckoutSignature, activatePaidOrder } from '@/lib/razorpay/activate';

export const runtime = 'nodejs';

// =============================================================================
// POST /api/payments/verify
//
// Called by the browser right after Razorpay Checkout succeeds. We re-verify the
// signature server-side (the browser is never trusted) and then activate the
// subscription. The webhook does the same thing as a safety net — activation is
// idempotent, so whichever arrives first wins.
//
// Body: { razorpay_order_id, razorpay_payment_id, razorpay_signature }
// =============================================================================

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const body = await req.json().catch(() => null);
    const orderId = body?.razorpay_order_id as string | undefined;
    const paymentId = body?.razorpay_payment_id as string | undefined;
    const signature = body?.razorpay_signature as string | undefined;

    if (!orderId || !paymentId || !signature) {
      return NextResponse.json({ error: 'Missing payment details.' }, { status: 400 });
    }

    if (!verifyCheckoutSignature({ orderId, paymentId, signature })) {
      console.error('[verify] signature mismatch for order', orderId);
      return NextResponse.json({ error: 'Payment could not be verified.' }, { status: 400 });
    }

    const result = await activatePaidOrder({
      razorpayOrderId: orderId,
      razorpayPaymentId: paymentId,
    });

    if (!result.ok) {
      return NextResponse.json({ error: 'Payment verified but activation failed. Our team will fix this shortly.' }, { status: 500 });
    }

    revalidatePath('/dashboard');
    revalidatePath('/dashboard/settings');

    return NextResponse.json({ success: true, newEnd: result.newEnd ?? null });
  } catch (err) {
    console.error('[verify] error:', err);
    return NextResponse.json({ error: 'Payment verification failed.' }, { status: 500 });
  }
}
