// =============================================================================
// Wallet calculation helpers (pure functions — no I/O).
//
// These keep the wallet maths in one place so the billing UI and the server
// action agree on how much can be applied. The authoritative debit still
// happens atomically in the database (wallet_debit_for_invoice), which
// re-validates the balance — these helpers are for display/clamping only.
// =============================================================================

/** Round to whole rupees (invoices/totals in this app are whole-rupee). */
function r(n: number): number {
  return Math.round(Number.isFinite(n) ? n : 0);
}

/** Maximum wallet top-up allowed per customer per Indian financial year (Apr–Mar). */
export const WALLET_ANNUAL_LIMIT = 50000;

/**
 * The amount that may actually be drawn from the wallet for a bill:
 * never more than the bill total, never more than the available balance,
 * never negative.
 */
export function clampWalletUse(requested: number, billTotal: number, balance: number): number {
  const req = Math.max(0, r(requested));
  const cap = Math.max(0, Math.min(r(billTotal), r(balance)));
  return Math.min(req, cap);
}

/** The remaining amount the customer must pay by cash/UPI/card after wallet use. */
export function externalPayable(billTotal: number, walletUsed: number): number {
  return Math.max(0, r(billTotal) - Math.max(0, r(walletUsed)));
}

/** True when the wallet fully covers the bill (and there is a bill to cover). */
export function isFullyWalletPaid(billTotal: number, walletUsed: number): boolean {
  return r(billTotal) > 0 && r(walletUsed) >= r(billTotal);
}
