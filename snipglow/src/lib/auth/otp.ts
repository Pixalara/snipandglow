// =============================================================================
// One-time code verification.
//
// Extracted so the two endpoints that consume an OTP — `/api/auth/verify-otp`
// (sign in to an existing account) and `/api/auth/attach-phone` (add a verified
// WhatsApp number to the account you are already signed into) — share exactly
// one implementation. Duplicating expiry and single-use handling across two
// routes is how one of them eventually stops enforcing it.
// =============================================================================

/**
 * Normalise an Indian mobile number to the 12-digit form `send-otp` stores.
 *
 * Note the stored value has NO leading `+` despite the variable in `send-otp`
 * being named `phoneE164`; this returns the same shape so lookups line up.
 */
export function normalizeIndianPhone(input: string): string {
  const cleaned = String(input ?? '').replace(/[\s\-()+]/g, '');
  if (cleaned.length === 10 && /^[6-9]/.test(cleaned)) return `91${cleaned}`;
  return cleaned.startsWith('91') ? cleaned : `91${cleaned}`;
}

/** The bare 10-digit subscriber number, as stored on `employees.phone`. */
export function tenDigitPhone(input: string): string {
  const n = normalizeIndianPhone(input);
  return n.length === 12 && n.startsWith('91') ? n.slice(2) : n;
}

export type OtpFailure =
  | 'INVALID_INPUT'
  | 'NOT_FOUND'
  | 'EXPIRED'
  | 'MISMATCH';

export interface OtpResult {
  ok: boolean;
  failure?: OtpFailure;
  /** User-facing message, safe to show as-is. */
  message?: string;
  /** Normalised 12-digit phone, present on success. */
  phone?: string;
}

interface OtpRow {
  id: string;
  code: string;
  expires_at: string;
}

/**
 * The slice of the Supabase query-builder chain used below. Builders are
 * thenable, hence `PromiseLike`, which is what lets `delete().eq()` be awaited.
 */
interface OtpQuery extends PromiseLike<unknown> {
  select(columns: string): OtpQuery;
  order(column: string, options: { ascending: boolean }): OtpQuery;
  limit(count: number): OtpQuery;
  eq(column: string, value: string): OtpQuery;
  delete(): OtpQuery;
  maybeSingle(): Promise<{ data: OtpRow | null }>;
}

/**
 * Minimal shape of the admin Supabase client this needs. Kept structural so the
 * module stays unit-testable with a small fake instead of a real client.
 */
type AdminLike = {
  from: (table: string) => unknown;
};

/** Narrow the loosely-typed client down to the chain we actually use. */
const otpTable = (admin: AdminLike): OtpQuery => admin.from('otp_codes') as OtpQuery;

/**
 * Verify a submitted code against `otp_codes` and CONSUME it.
 *
 * Single-use is enforced by deleting the row: a valid code is deleted on success,
 * and an expired one is deleted rather than left to linger. A wrong code is left
 * in place so the user can retry within the 5-minute window.
 */
export async function consumeOtpCode(
  admin: AdminLike,
  input: { phone: string; code: string }
): Promise<OtpResult> {
  const code = String(input.code ?? '').trim();
  if (!input.phone || !code) {
    return { ok: false, failure: 'INVALID_INPUT', message: 'Phone and OTP code are required' };
  }
  if (code.length !== 6) {
    return { ok: false, failure: 'INVALID_INPUT', message: 'Please enter a valid 6-digit code' };
  }

  const phone = normalizeIndianPhone(input.phone);

  // Try every shape the code could have been stored under. `send-otp` writes the
  // 12-digit form, but older rows and other callers have used the raw input and a
  // `+`-prefixed variant, and a lookup miss here reads to the user as "no OTP
  // found" immediately after they received one.
  let record: OtpRow | null = null;
  for (const candidate of [input.phone, phone, `+${phone}`]) {
    const { data } = await otpTable(admin)
      .select('id, code, expires_at')
      .eq('phone', candidate)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) {
      record = data;
      break;
    }
  }

  if (!record) {
    return { ok: false, failure: 'NOT_FOUND', message: 'No OTP found. Please request a new one.' };
  }

  if (new Date(record.expires_at) < new Date()) {
    await otpTable(admin).delete().eq('id', record.id);
    return { ok: false, failure: 'EXPIRED', message: 'OTP has expired. Please request a new one.' };
  }

  if (record.code !== code) {
    // Deliberately NOT deleted: the user should be able to retype it.
    return { ok: false, failure: 'MISMATCH', message: 'Invalid OTP. Please try again.' };
  }

  await otpTable(admin).delete().eq('id', record.id);
  return { ok: true, phone };
}
