'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { sendWalletRechargeReceipt } from '@/lib/invoice/send-bill-receipt';
import type { ActionResult, WalletTransaction, PaymentMethod } from '@/types';

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
  if (!['cash', 'upi', 'card'].includes(input.paymentMethod)) {
    return { success: false, error: 'Select a valid payment method.' };
  }

  const { data, error } = await (supabase as any).rpc('wallet_recharge', {
    p_customer_id: input.customerId,
    p_amount: amount,
    p_payment_method: input.paymentMethod,
    p_note: input.note?.trim() || null,
  });

  if (error) {
    const msg = String(error.message || '');
    if (msg.includes('FORBIDDEN')) return { success: false, error: 'You do not have permission to add wallet balance.' };
    if (msg.includes('CUSTOMER_NOT_FOUND')) return { success: false, error: 'Customer not found.' };
    if (msg.includes('INVALID_AMOUNT')) return { success: false, error: 'Enter a valid amount greater than zero.' };
    if (msg.includes('INVALID_PAYMENT_METHOD')) return { success: false, error: 'Select a valid payment method.' };
    console.error('wallet_recharge error:', error);
    return { success: false, error: 'Failed to add wallet balance. Please try again.' };
  }

  const result = (data ?? {}) as { invoice_number?: string; balance?: number };
  const newBalance = Number(result.balance ?? 0);
  const invoiceNumber = result.invoice_number ?? '';

  // Send the customer a wallet-recharge receipt via the approved
  // `wallet_recharge_v1` template (PDF header + amount/balance/receipt), with a
  // fallback to bill_receipt_v1. Best-effort — never blocks the top-up.
  try {
    await sendWalletRechargeReceipt({
      tenantId,
      customerId: input.customerId,
      invoiceNumber,
      amount,
      newBalance,
    });
  } catch (e) {
    console.error('Wallet recharge receipt send failed (non-fatal):', e);
  }

  revalidatePath(`/dashboard/customers/${input.customerId}`);
  revalidatePath('/dashboard/billing');
  return { success: true, data: { balance: newBalance, invoiceNumber } };
}
