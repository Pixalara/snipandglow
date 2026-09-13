'use server';

// =============================================================================
// Customer loyalty POINTS — server actions.
//
// Mirrors wallet-actions.ts: reads go through the RLS-scoped server client;
// the only write (manual adjust) goes through the SECURITY DEFINER RPC
// `loyalty_adjust` (migration 054), which re-validates tenant + role. Earning
// and redemption are handled by the DB trigger and `loyalty_redeem_for_invoice`
// during billing, so they are not exposed here.
// =============================================================================

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import type { ActionResult, LoyaltyTransaction } from '@/types';

export interface LoyaltySummary {
  balance: number;
  lifetime: number;
}

/** Current redeemable balance + lifetime points for a customer (0 when none). */
export async function getCustomerLoyalty(customerId: string): Promise<LoyaltySummary> {
  const supabase = await createClient();
  const { data } = await (supabase
    .from('customer_loyalty' as never)
    .select('points_balance, lifetime_points')
    .eq('customer_id', customerId)
    .maybeSingle() as never as Promise<{ data: { points_balance: number; lifetime_points: number } | null }>);
  return {
    balance: Number(data?.points_balance ?? 0),
    lifetime: Number(data?.lifetime_points ?? 0),
  };
}

/** Loyalty ledger for a customer, newest first (max 100). */
export async function getLoyaltyTransactions(customerId: string): Promise<LoyaltyTransaction[]> {
  const supabase = await createClient();
  const { data } = await (supabase
    .from('loyalty_transactions' as never)
    .select('id, tenant_id, branch_id, customer_id, invoice_id, type, points, balance_after, description, created_by, created_at')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false })
    .limit(100) as never as Promise<{ data: LoyaltyTransaction[] | null }>);
  return data ?? [];
}

/** Manually credit (+) or debit (−) a customer's points (owner/manager only). */
export async function adjustLoyaltyPoints(input: {
  customerId: string;
  points: number;
  reason?: string;
}): Promise<ActionResult<{ balance: number }>> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not authenticated' };

  const points = Math.trunc(Number(input.points) || 0);
  if (!points) return { success: false, error: 'Enter a non-zero number of points.' };
  if (Math.abs(points) > 1_000_000) return { success: false, error: 'That points amount looks too large.' };

  const { data, error } = await (supabase.rpc('loyalty_adjust' as never, {
    p_customer_id: input.customerId,
    p_points: points,
    p_reason: input.reason?.trim() || null,
  } as never) as never as Promise<{ data: { balance: number } | null; error: { message: string } | null }>);

  if (error) {
    const msg = String(error.message || '');
    if (msg.includes('INSUFFICIENT_POINTS')) return { success: false, error: 'The customer does not have enough points for that deduction.' };
    if (msg.includes('FORBIDDEN')) return { success: false, error: 'Only an owner or manager can adjust points.' };
    if (msg.includes('CUSTOMER_NOT_FOUND')) return { success: false, error: 'Customer not found.' };
    return { success: false, error: 'Could not adjust points. Please try again.' };
  }

  revalidatePath(`/dashboard/customers/${input.customerId}`);
  return { success: true, data: { balance: Number(data?.balance ?? 0) } };
}
