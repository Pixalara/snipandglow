import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  getBillingCycle,
  amountPayable,
  hasCustomPrice,
  planLabel,
  planYearlyDiscountPct,
  effectiveMonthlyPrice,
} from '@/lib/subscription';
import { computeSubscriptionWindow } from '@/lib/razorpay/subscription-window';

export const runtime = 'nodejs';

// =============================================================================
// GET /api/payments/plans
//
// The monthly / yearly choices offered before checkout. Prices are computed
// SERVER-SIDE (honouring any negotiated per-tenant rate) using the very same
// amountPayable() that create-order charges with, so what the owner sees is
// exactly what Razorpay collects.
//
// Also returns the subscription window each option would buy, so the owner can
// see the term before paying rather than discovering it afterwards.
// =============================================================================

interface PlanOption {
  cycle: 'monthly' | 'yearly';
  /** Rupees charged now. */
  amount: number;
  months: number;
  /** Effective rupees per month, for comparison. */
  perMonth: number;
  periodStart: string;
  periodEnd: string;
}

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    // Same guard as create-order: only the owner pays.
    const role = user.user_metadata?.role as string | undefined;
    if (role !== 'owner') {
      return NextResponse.json({ error: 'Only the salon owner can make this payment.' }, { status: 403 });
    }

    const tenantId = user.user_metadata?.tenant_id as string | undefined;
    if (!tenantId) return NextResponse.json({ error: 'No tenant context found.' }, { status: 400 });

    const admin = createAdminClient();
    const { data: tenantRow } = await admin
      .from('tenants')
      .select('id, plan_tier, settings, subscription_end, subscription_status')
      .eq('id', tenantId)
      .maybeSingle();

    if (!tenantRow) return NextResponse.json({ error: 'Tenant not found.' }, { status: 404 });

    const tenant = tenantRow as Record<string, unknown>;
    const planTier = (tenant.plan_tier as string) || 'starter';
    const settings = (tenant.settings ?? {}) as Record<string, unknown>;
    const status = (tenant.subscription_status as string | null) ?? null;
    const endRaw = tenant.subscription_end as string | null;

    const now = new Date();
    const parsedEnd = endRaw ? new Date(endRaw) : null;
    const currentEnd = parsedEnd && !Number.isNaN(parsedEnd.getTime()) ? parsedEnd : null;

    const build = (cycle: 'monthly' | 'yearly'): PlanOption => {
      const months = cycle === 'yearly' ? 12 : 1;
      const window = computeSubscriptionWindow({ now, currentEnd, status, months });
      return {
        cycle,
        amount: amountPayable(planTier, cycle, settings),
        months,
        perMonth: effectiveMonthlyPrice(planTier, cycle, settings),
        periodStart: window.start.toISOString(),
        periodEnd: window.end.toISOString(),
      };
    };

    return NextResponse.json({
      planLabel: planLabel(planTier),
      // Preselect whatever the tenant is already on.
      currentCycle: getBillingCycle(settings),
      // Only advertise the standard yearly saving when on list pricing; a
      // negotiated rate makes the headline discount meaningless.
      yearlyDiscountPct: hasCustomPrice(settings, 'yearly') ? 0 : planYearlyDiscountPct(planTier),
      customRate: hasCustomPrice(settings, 'monthly') || hasCustomPrice(settings, 'yearly'),
      options: [build('monthly'), build('yearly')],
    });
  } catch (err) {
    console.error('[payments/plans] failed:', err);
    return NextResponse.json({ error: 'Could not load plans.' }, { status: 500 });
  }
}
