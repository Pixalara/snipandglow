import 'server-only';
import crypto from 'crypto';
import { createAdminClient } from '@/lib/supabase/admin';

// =============================================================================
// Razorpay payment verification + subscription activation.
//
// Both the browser success callback and the server webhook funnel through
// `activatePaidOrder()`, which is IDEMPOTENT: the first caller extends the
// subscription and stamps `activated_at`; later callers no-op. That prevents a
// double extension when both paths report the same payment.
// =============================================================================

/** Constant-time compare of two hex signatures. */
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

/**
 * Verify the Checkout handler signature: HMAC_SHA256(order_id + "|" + payment_id)
 * using the Razorpay KEY SECRET.
 */
export function verifyCheckoutSignature(params: {
  orderId: string;
  paymentId: string;
  signature: string;
}): boolean {
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!secret) return false;
  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${params.orderId}|${params.paymentId}`)
    .digest('hex');
  return safeEqual(expected, params.signature);
}

/**
 * Verify a webhook payload signature: HMAC_SHA256(rawBody) using the
 * WEBHOOK secret (different from the key secret).
 */
export function verifyWebhookSignature(rawBody: string, signature: string): boolean {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret || !signature) return false;
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  return safeEqual(expected, signature);
}

/** Add whole months to a date, clamping day-of-month overflow (31 Jan + 1mo). */
function addMonths(from: Date, months: number): Date {
  const d = new Date(from);
  const day = d.getDate();
  d.setMonth(d.getMonth() + months);
  if (d.getDate() < day) d.setDate(0); // rolled into next month → clamp back
  return d;
}

export interface ActivationResult {
  ok: boolean;
  alreadyActivated?: boolean;
  error?: string;
  newEnd?: string;
}

/**
 * Mark an order paid and extend the tenant's subscription — exactly once.
 *
 * The extension starts from whichever is LATER: now, or the current
 * subscription_end (so renewing early never loses paid days).
 */
export async function activatePaidOrder(params: {
  razorpayOrderId: string;
  razorpayPaymentId?: string | null;
}): Promise<ActivationResult> {
  const admin = createAdminClient();

  const { data: order, error: orderErr } = await (admin
    .from('payment_orders' as any)
    .select('id, tenant_id, plan_tier, billing_cycle, months, status, activated_at')
    .eq('razorpay_order_id', params.razorpayOrderId)
    .maybeSingle() as any);

  if (orderErr || !order) return { ok: false, error: 'ORDER_NOT_FOUND' };
  if (order.activated_at) return { ok: true, alreadyActivated: true };

  const { data: tenant } = await (admin
    .from('tenants' as any)
    .select('id, subscription_end, subscription_start')
    .eq('id', order.tenant_id)
    .maybeSingle() as any);

  if (!tenant) return { ok: false, error: 'TENANT_NOT_FOUND' };

  const now = new Date();
  const currentEnd = tenant.subscription_end ? new Date(tenant.subscription_end) : null;
  const base = currentEnd && currentEnd.getTime() > now.getTime() ? currentEnd : now;
  const newEnd = addMonths(base, Number(order.months) || 1);

  const { error: tenantErr } = await (admin
    .from('tenants' as any)
    .update({
      subscription_status: 'active',
      subscription_start: tenant.subscription_start ?? now.toISOString(),
      subscription_end: newEnd.toISOString(),
      // Let the pre-expiry reminder fire again for the new date.
      trial_expiry_alert_sent: false,
    } as any)
    .eq('id', order.tenant_id) as any);

  if (tenantErr) {
    console.error('[razorpay] tenant activation failed:', tenantErr);
    return { ok: false, error: 'TENANT_UPDATE_FAILED' };
  }

  // Latch the order so a second callback can't extend again.
  await (admin
    .from('payment_orders' as any)
    .update({
      status: 'paid',
      razorpay_payment_id: params.razorpayPaymentId ?? null,
      activated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as any)
    .eq('id', order.id) as any);

  return { ok: true, newEnd: newEnd.toISOString() };
}
