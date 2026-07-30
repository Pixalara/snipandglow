'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { after } from 'next/server';
import { sendWalletRechargeReceipt } from '@/lib/invoice/send-bill-receipt';
import { WALLET_ANNUAL_LIMIT } from '@/lib/wallet';
import type { ActionResult, WalletTransaction, PaymentMethod } from '@/types';

/** Start of the current Indian financial year (1 Apr) as an IST ISO timestamp. */
function fyStartISO(): string {
  const istNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  const year = istNow.getFullYear();
  const month = istNow.getMonth() + 1; // 1–12
  const fyYear = month >= 4 ? year : year - 1;
  return `${fyYear}-04-01T00:00:00+05:30`;
}

/**
 * How much has been loaded into this customer's wallet during the current
 * Indian financial year, plus the limit and remaining allowance.
 */
export async function getWalletFyRechargeTotal(
  customerId: string
): Promise<{ used: number; limit: number; remaining: number }> {
  const limit = WALLET_ANNUAL_LIMIT;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { used: 0, limit, remaining: limit };

  const { data } = await (supabase as any)
    .from('wallet_transactions')
    .select('amount')
    .eq('customer_id', customerId)
    .eq('type', 'credit')
    .gte('created_at', fyStartISO());

  const used = (data ?? []).reduce((s: number, t: any) => s + Number(t.amount || 0), 0);
  return { used, limit, remaining: Math.max(0, limit - used) };
}

// =============================================================================
// Customer Wallet — server actions
//
// Reads use the RLS-scoped client (tenant isolation enforced by policies).
// The top-up write goes through the atomic `wallet_recharge` SQL function so
// the invoice + line item + wallet credit either all succeed or all roll back.
// =============================================================================

/** Current wallet balance for a customer (0 when no wallet row exists yet). */
export async function getCustomerWalletBalance(customerId: string): Promise<number> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return 0;

  const { data } = await (supabase as any)
    .from('customer_wallets')
    .select('balance')
    .eq('customer_id', customerId)
    .maybeSingle();

  return data ? Number(data.balance) || 0 : 0;
}

/** Wallet ledger for a customer, newest first. */
export async function getWalletTransactions(customerId: string): Promise<WalletTransaction[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await (supabase as any)
    .from('wallet_transactions')
    .select('id, tenant_id, branch_id, customer_id, invoice_id, type, amount, balance_after, description, created_by, created_at')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false })
    .limit(100);

  return (data ?? []) as WalletTransaction[];
}

/**
 * Top up a customer's wallet: creates a wallet-recharge invoice + credits the
 * wallet atomically, then sends the customer a receipt (no feedback ask).
 */
export async function addWalletBalance(input: {
  customerId: string;
  amount: number;
  paymentMethod: PaymentMethod;
  note?: string;
  promoAmount?: number;
}): Promise<ActionResult<{ balance: number; invoiceNumber: string }>> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not authenticated' };

  const tenantId = user.user_metadata?.tenant_id as string | undefined;
  if (!tenantId) return { success: false, error: 'No tenant context found.' };

  const amount = Math.round(Number(input.amount));
  if (!amount || amount <= 0) {
    return { success: false, error: 'Enter a valid amount greater than zero.' };
  }
  if (amount > 1_000_000) {
    return { success: false, error: 'Amount is too large.' };
  }
  const promoAmount = Math.round(Number(input.promoAmount ?? 0));
  if (!Number.isFinite(promoAmount) || promoAmount < 0) {
    return { success: false, error: 'Enter a valid promotional amount.' };
  }
  if (promoAmount > 1_000_000) {
    return { success: false, error: 'Promotional amount is too large.' };
  }
  if (!['cash', 'upi', 'card'].includes(input.paymentMethod)) {
    return { success: false, error: 'Select a valid payment method.' };
  }

  // Friendly annual-cap pre-check — the cap applies to PAID money only, not the
  // promotional bonus (the RPC enforces this authoritatively too).
  const fy = await getWalletFyRechargeTotal(input.customerId);
  if (amount > fy.remaining) {
    return {
      success: false,
      error:
        fy.remaining <= 0
          ? `Annual top-up limit of ₹${fy.limit.toLocaleString('en-IN')} (Apr–Mar) already reached for this customer.`
          : `Annual top-up limit reached. Only ₹${fy.remaining.toLocaleString('en-IN')} can be added this financial year (max ₹${fy.limit.toLocaleString('en-IN')}).`,
    };
  }

  const { data, error } = await (supabase as any).rpc('wallet_recharge', {
    p_customer_id: input.customerId,
    p_amount: amount,
    p_payment_method: input.paymentMethod,
    p_note: input.note?.trim() || null,
    p_promo: promoAmount,
  });

  if (error) {
    const msg = String(error.message || '');
    if (msg.includes('WALLET_LIMIT_EXCEEDED')) {
      return {
        success: false,
        error: `Annual top-up limit of ₹${WALLET_ANNUAL_LIMIT.toLocaleString('en-IN')} (Apr–Mar) reached for this customer.`,
      };
    }
    if (msg.includes('FORBIDDEN')) return { success: false, error: 'You do not have permission to add wallet balance.' };
    if (msg.includes('CUSTOMER_NOT_FOUND')) return { success: false, error: 'Customer not found.' };
    if (msg.includes('INVALID_AMOUNT')) return { success: false, error: 'Enter a valid amount greater than zero.' };
    if (msg.includes('INVALID_PROMO')) return { success: false, error: 'Enter a valid promotional amount.' };
    if (msg.includes('INVALID_PAYMENT_METHOD')) return { success: false, error: 'Select a valid payment method.' };
    console.error('wallet_recharge error:', error);
    return { success: false, error: 'Failed to add wallet balance. Please try again.' };
  }

  const result = (data ?? {}) as { invoice_number?: string; balance?: number };
  const newBalance = Number(result.balance ?? 0);
  const invoiceNumber = result.invoice_number ?? '';

  // Send the customer a wallet-recharge receipt via the approved
  // `wallet_recharge_v1` template (PDF header + amount/balance/receipt), with a
  // fallback to bill_receipt_v1. Best-effort — never blocks the top-up. The
  // "amount added" shown is the total credited (paid + any promotional bonus).
  const receipt = {
    tenantId,
    customerId: input.customerId,
    invoiceNumber,
    amount: amount + promoAmount,
    newBalance,
  };
  after(async () => {
    try {
      await sendWalletRechargeReceipt(receipt);
    } catch (e) {
      console.error('Wallet recharge receipt send failed (non-fatal):', e);
    }
  });

  revalidatePath(`/dashboard/customers/${input.customerId}`);
  revalidatePath('/dashboard/billing');
  return { success: true, data: { balance: newBalance, invoiceNumber } };
}
