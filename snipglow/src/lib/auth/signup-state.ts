// =============================================================================
// Signup completeness — the single source of truth for "has this owner finished
// signing up?".
//
// Every new salon owner must clear BOTH checks before they can reach the
// dashboard:
//
//   1. GOOGLE  — a real, Google-verified email address. This is what makes the
//                account contactable: invoices, receipts, renewal notices and
//                password recovery all depend on it.
//   2. WHATSAPP — a verified phone number, since the whole product runs on
//                WhatsApp bookings and reminders.
//
// Why this module exists: the same decision used to be made independently in
// middleware, the OAuth callback route, the client-side /auth/confirm twin and
// the onboarding action — and they disagreed. A phone-only signup could walk
// straight into onboarding and create a tenant with a fabricated
// `<phone>@phone.snipandglow.com` address, which is how SNG-009 ended up with no
// reachable email. One helper, used by all of them, keeps that from drifting
// again.
//
// IMPORTANT — this is deliberately NOT the security boundary. `user_metadata` is
// writable from the browser via `supabase.auth.updateUser`, so these helpers
// decide *routing* only. The real enforcement is the server-side check inside
// `completeOnboarding`, which is the one and only place a tenant row is created.
// =============================================================================

/** Fabricated addresses minted for phone/staff logins. Never contactable. */
const SYNTHETIC_EMAIL_DOMAINS = [
  '@phone.snipandglow.com',
  '@staff.snipandglow.com',
  // The retired edge function used a different host; treat it as synthetic too
  // so any session it created is still caught.
  '@phone.snipglow.app',
] as const;

/**
 * True when the address is an internal placeholder rather than something a
 * human can receive mail at.
 */
export function isSyntheticEmail(email: string | null | undefined): boolean {
  const e = (email || '').toLowerCase().trim();
  if (!e) return false;
  return SYNTHETIC_EMAIL_DOMAINS.some((d) => e.endsWith(d));
}

/** The minimal shape we need from a Supabase user. */
export interface SignupUserLike {
  email?: string | null;
  phone?: string | null;
  user_metadata?: Record<string, unknown> | null;
  app_metadata?: Record<string, unknown> | null;
}

/**
 * Has this account completed Google sign-in?
 *
 * Checked two ways because the two are populated at different moments: the
 * provider list is set by Supabase the instant OAuth completes, while a real
 * email is what we actually care about downstream. Either is sufficient.
 */
export function hasGoogleVerified(user: SignupUserLike | null | undefined): boolean {
  if (!user) return false;

  const app = user.app_metadata ?? {};
  const providers = Array.isArray(app.providers) ? (app.providers as unknown[]) : [];
  const provider = typeof app.provider === 'string' ? app.provider : null;
  if (provider === 'google' || providers.includes('google')) return true;

  // Fall back to "the address is real", which covers accounts verified before
  // provider metadata was recorded.
  return !!user.email && !isSyntheticEmail(user.email);
}

/**
 * Has this account completed WhatsApp OTP verification?
 *
 * `user_metadata.phone` is set by the verification step; `user.phone` is the
 * native Supabase column set when an account is created with a phone.
 */
export function hasPhoneVerified(user: SignupUserLike | null | undefined): boolean {
  if (!user) return false;
  const metaPhone = user.user_metadata?.phone;
  const fromMeta = typeof metaPhone === 'string' && metaPhone.trim().length > 0;
  return fromMeta || !!(user.phone && String(user.phone).trim().length > 0);
}

/** Does this account already belong to a salon? */
export function hasTenant(user: SignupUserLike | null | undefined): boolean {
  const t = user?.user_metadata?.tenant_id;
  return typeof t === 'string' && t.trim().length > 0;
}

/** The verified phone number, preferring the value the OTP step recorded. */
export function verifiedPhone(user: SignupUserLike | null | undefined): string | null {
  const metaPhone = user?.user_metadata?.phone;
  if (typeof metaPhone === 'string' && metaPhone.trim()) return metaPhone.trim();
  const native = user?.phone ? String(user.phone).trim() : '';
  return native || null;
}

/** The contactable email, or null when it is a placeholder. */
export function realEmail(user: SignupUserLike | null | undefined): string | null {
  const e = (user?.email || '').trim();
  if (!e || isSyntheticEmail(e)) return null;
  return e;
}

export type SignupStep = '/verify-phone' | '/signup' | '/onboarding' | '/dashboard';

export interface SignupState {
  google: boolean;
  phone: boolean;
  tenant: boolean;
  /** Where this user should be sent right now. */
  next: SignupStep;
}

/**
 * Work out where a signed-in user belongs.
 *
 * Order matters. An existing salon (`tenant_id` present) is ALWAYS sent to the
 * dashboard and never re-gated: accounts created before this rule existed would
 * otherwise be locked out of the product they are paying for. The two-factor
 * requirement applies to signups still in progress.
 */
export function getSignupState(user: SignupUserLike | null | undefined): SignupState {
  const google = hasGoogleVerified(user);
  const phone = hasPhoneVerified(user);
  const tenant = hasTenant(user);

  // Grandfathering: already has a salon → straight through, no re-verification.
  if (tenant) return { google, phone, tenant, next: '/dashboard' };

  // Missing Google means there is no real email on the account. The only way to
  // add one is to start again from Google sign-in, which is why this points at
  // /signup rather than a mid-flow step.
  if (!google) return { google, phone, tenant, next: '/signup' };

  if (!phone) return { google, phone, tenant, next: '/verify-phone' };

  return { google, phone, tenant, next: '/onboarding' };
}

/** Convenience wrapper for the common "where do I send them" question. */
export function nextSignupStep(user: SignupUserLike | null | undefined): SignupStep {
  return getSignupState(user).next;
}
