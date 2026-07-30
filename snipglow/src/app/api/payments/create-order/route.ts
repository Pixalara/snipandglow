import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getRazorpay, isRazorpayConfigured } from '@/lib/razorpay/client';
import { getBillingCycle, planMonthlyPrice, planYearlyTotal } from '@/lib/subscription';
import { isAdminEmail } from '@/lib/admin/auth';

// Razorpay SDK + crypto need the Node runtime.
export const runtime = 'nodejs';

// =============================================================================
// POST /api/payments/create-order
//
// Creates a Razorpay order for the signed-in OWNER's subscription renewal.
// The amount is computed SERVER-SIDE from the tenant's plan + billing cycle —
// the browser never supplies a price.
//
// Body (optional): { cycle?: 'monthly' | 'yearly' }  — overrides the saved cycle
// Returns: { orderId, amount, currency, keyId, planLabel, months }
// =============================================================================

export async function POST(req: Request) {
  try {
    if (!isRazorpayConfigured()) {
      return NextResponse.json({ error: 'Payments are not configured yet.' }, { status: 503 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    // Only the salon owner can pay for the subscription.
    const role = user.user_metadata?.role as string | undefined;
    if (role !== 'owner') {
      return NextResponse.json({ error: 'Only the salon owner can make this payment.' }, { status: 403 });
    }

    const tenantId = user.user_metadata?.tenant_id as string | undefined;
    if (!tenantId) return NextResponse.json({ error: 'No tenant context found.' }, { status: 400 });

    const admin = createAdminClient();
    const { data: tenant } = await (admin
      .from('tenants' as any)
      .select('id, name, phone, plan_tier, settings')
      .eq('id', tenantId)
      .maybeSingle() as any);

    if (!tenant) return NextResponse.json({ error: 'Tenant not found.' }, { status: 404 });

    // Billing cycle: allow an explicit choice, else fall back to the saved one.
    let cycle = getBillingCycle(tenant.settings);
    try {
      const body = await req.json().catch(() => null);
      if (body?.cycle === 'monthly' || body?.cycle === 'yearly') cycle = body.cycle;
    } catch { /* no body is fine */ }

    const planTier = (tenant.plan_tier as string) || 'starter';
    const months = cycle === 'yearly' ? 12 : 1;
    const rupees = cycle === 'yearly' ? planYearlyTotal(planTier) : planMonthlyPrice(planTier, 'monthly');
    let amountPaise = Math.round(rupees * 100);

    // ── Live-mode smoke test (platform admins only) ────────────────────────
    // With live keys every charge is real money. To verify the end-to-end flow
    // without paying a full plan price, a PLATFORM ADMIN may pay a token amount
    // (default ₹1) when PAYMENT_TEST_AMOUNT_PAISE is set. Never available to
    // regular salon owners — they always pay the real plan price.
    let isTestCharge = false;
    const testPaise = parseInt(process.env.PAYMENT_TEST_AMOUNT_PAISE || '0', 10);
    if (testPaise > 0 && isAdminEmail(user.email)) {
      amountPaise = Math.max(100, testPaise); // Razorpay minimum is ₹1
      isTestCharge = true;
      console.warn(`[create-order] TEST CHARGE ₹${amountPaise / 100} for admin ${user.email}`);
    }

    if (!Number.isFinite(amountPaise) || amountPaise <= 0) {
      return NextResponse.json({ error: 'Could not determine the amount payable.' }, { status: 400 });
    }

    // `receipt` is capped at 40 chars by Razorpay.
    const receipt = `sg_${tenantId.replace(/-/g, '').slice(0, 18)}_${Date.now().toString(36)}`.slice(0, 40);

    const order = await getRazorpay().orders.create({
      amount: amountPaise,
      currency: 'INR',
      receipt,
      notes: {
        tenant_id: tenantId,
        salon: String(tenant.name ?? '').slice(0, 100),
        plan_tier: planTier,
        billing_cycle: cycle,
        months: String(months),
        ...(isTestCharge ? { test_charge: 'true' } : {}),
      },
    });

    // Record the order BEFORE the customer pays, so verification/webhook can
    // trust the amount + months and stay idempotent.
    const { error: insertErr } = await (admin
      .from('payment_orders' as any)
      .insert({
        tenant_id: tenantId,
        razorpay_order_id: order.id,
        amount: amountPaise,
        currency: 'INR',
        plan_tier: planTier,
        billing_cycle: cycle,
        months,
        status: 'created',
        created_by: user.email ?? null,
        notes: isTestCharge ? { test_charge: true, real_amount_paise: Math.round(rupees * 100) } : {},
      } as any) as any);

    if (insertErr) {
      console.error('[create-order] failed to record order:', insertErr);
      return NextResponse.json({ error: 'Could not start the payment. Please try again.' }, { status: 500 });
    }

    return NextResponse.json({
      orderId: order.id,
      amount: amountPaise,
      currency: 'INR',
      keyId: process.env.RAZORPAY_KEY_ID,
      months,
      cycle,
      planTier,
      salonName: tenant.name ?? '',
      contact: tenant.phone ?? '',
      email: user.email ?? '',
    });
  } catch (err) {
    console.error('[create-order] error:', err);
    return NextResponse.json({ error: 'Could not start the payment. Please try again.' }, { status: 500 });
  }
}
