import 'server-only';
import crypto from 'crypto';
import { createAdminClient } from '@/lib/supabase/admin';
import { computeSubscriptionWindow } from './subscription-window';

// =============================================================================
// Razorpay payment verification + subscription activation.
//
// Both the browser success callback and the server webhook funnel through
// `activatePaidOrder()`, which is IDEMPOTENT: the first caller extends the
// subscription and stamps `activated_at`; later callers no-op. That prevents a
// double extension when both paths report the same payment.
//
// The latch MUST be claimed with a conditional UPDATE ... WHERE activated_at IS
// NULL before the tenant row is touched. A plain read-then-write is not enough:
// /api/payments/verify and /api/payments/webhook land within milliseconds of one
// another (and Razorpay sends both `payment.captured` and `order.paid` for a
// single payment), so both callers would see activated_at = null and both would
// extend. That is precisely how a 26 Aug renewal became 27 Sep → 27 Oct: the
// first pass moved the end to 26 Sep, then the second pass chained onto it.
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

export interface ActivationResult {
  ok: boolean;
  alreadyActivated?: boolean;
  error?: string;
  newStart?: string;
  newEnd?: string;
}

/**
 * Mark an order paid and extend the tenant's subscription — exactly once.
 *
 * The window itself is decided by `computeSubscriptionWindow`: a first payment
 * or a lapsed renewal starts on the payment date, while renewing an already
 * live paid plan starts the day after the current expiry.
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
  // Cheap early exit for the common "webhook arrives well after the browser
  // already activated" case. Not a substitute for the atomic claim below.
  if (order.activated_at) return { ok: true, alreadyActivated: true };

  // Claim the order atomically BEFORE extending the subscription. The
  // `.is('activated_at', null)` predicate is evaluated by Postgres as part of the
  // UPDATE, so exactly one concurrent caller gets a row back and the losers
  // no-op. Deliberately restricted to columns that have always existed, so
  // activation can never be broken by a pending migration.
  const claimedAt = new Date().toISOString();
  const { data: claimedOrder, error: claimErr } = await (admin
    .from('payment_orders' as any)
    .update({
      status: 'paid',
      razorpay_payment_id: params.razorpayPaymentId ?? null,
      activated_at: claimedAt,
      updated_at: claimedAt,
    } as any)
    .eq('id', order.id)
    .is('activated_at', null)
    .select('id')
    .maybeSingle() as any);

  if (claimErr) {
    console.error('[razorpay] could not claim order for activation:', claimErr);
    return { ok: false, error: 'ORDER_CLAIM_FAILED' };
  }

  // Someone else won the race and is already extending this order.
  if (!claimedOrder) return { ok: true, alreadyActivated: true };

  const { data: tenant } = await (admin
    .from('tenants' as any)
    .select('id, subscription_end, subscription_start, subscription_status')
    .eq('id', order.tenant_id)
    .maybeSingle() as any);

  // The claim is held at this point, so any bail-out from here on must release it
  // — otherwise the order looks activated while the subscription was never
  // extended, and no retry or webhook redelivery could ever put that right.
  const releaseClaim = async () => {
    await (admin
      .from('payment_orders' as any)
      .update({
        status: order.status ?? 'created',
        activated_at: null,
        updated_at: new Date().toISOString(),
      } as any)
      .eq('id', order.id)
      .eq('activated_at', claimedAt) as any);
  };

  if (!tenant) {
    await releaseClaim();
    return { ok: false, error: 'TENANT_NOT_FOUND' };
  }

  const now = new Date();
  const parsedEnd = tenant.subscription_end ? new Date(tenant.subscription_end) : null;
  const window = computeSubscriptionWindow({
    now,
    currentEnd: parsedEnd && !Number.isNaN(parsedEnd.getTime()) ? parsedEnd : null,
    status: tenant.subscription_status,
    months: Number(order.months) || 1,
  });

  const { error: tenantErr } = await (admin
    .from('tenants' as any)
    .update({
      subscription_status: 'active',
      // The paid term's own start date, per the activation rules.
      subscription_start: window.start.toISOString(),
      subscription_end: window.end.toISOString(),
      // Let the pre-expiry reminder fire again for the new date.
      trial_expiry_alert_sent: false,
    } as any)
    .eq('id', order.tenant_id) as any);

  if (tenantErr) {
    console.error('[razorpay] tenant activation failed:', tenantErr);
    await releaseClaim();
    return { ok: false, error: 'TENANT_UPDATE_FAILED' };
  }

  // Audit trail of the exact term purchased (migration 048). Best-effort and
  // separate from the latch: this is derivable data, so if the migration has not
  // been applied yet we log and move on rather than failing a payment.
  const { error: periodErr } = await (admin
    .from('payment_orders' as any)
    .update({
      period_start: window.start.toISOString(),
      period_end: window.end.toISOString(),
      activation_basis: window.basis,
    } as any)
    .eq('id', order.id) as any);

  if (periodErr) {
    console.warn('[razorpay] could not record the billing period (migration 048?):', periodErr.message);
  }

  return { ok: true, newStart: window.start.toISOString(), newEnd: window.end.toISOString() };
}
