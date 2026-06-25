import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

// =============================================================================
// POST /api/auth/check-existing
// Signup guard: detects whether the currently signing-up Google user — or the
// WhatsApp number they are trying to verify — already belongs to an existing
// SnipandGlow account. Used by the verify-phone step to block duplicate
// signups and prompt the user to sign in instead.
//
// IMPORTANT: this is scoped to the SIGNUP flow only (requires an authenticated
// Google session that has NOT completed onboarding). The login OTP flow does
// NOT call this, so existing users can still sign in normally.
// =============================================================================

function digits(s?: string | null): string {
  return (s || '').replace(/\D/g, '');
}

function maskEmail(email?: string | null): string {
  if (!email) return 'an existing account';
  const [name, domain] = email.split('@');
  if (!domain) return email;
  const shown = name.slice(0, Math.min(2, name.length));
  return `${shown}${'\u2022'.repeat(Math.max(2, name.length - shown.length))}@${domain}`;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const rawPhone: string | undefined = body?.phone;

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const admin = createAdminClient();
    const currentEmail = (user.email || '').trim().toLowerCase();

    // ── 1) Email already linked to an onboarded account (different auth user) ──
    if (currentEmail) {
      const { data: empByEmail } = await (admin
        .from('employees')
        .select('auth_user_id, tenant_id, email')
        .ilike('email', currentEmail)
        .eq('is_active', true) as any);
      const emailHit = (empByEmail ?? []).find(
        (e: any) => e.tenant_id && e.auth_user_id && e.auth_user_id !== user.id,
      );
      if (emailHit) {
        return NextResponse.json({ exists: true, reason: 'email', email: maskEmail(currentEmail) });
      }
    }

    // ── 2) WhatsApp number checks (only when a valid number is supplied) ──────
    const cleaned = digits(rawPhone);
    const phone10 = cleaned.length > 10 ? cleaned.slice(-10) : cleaned;
    if (phone10.length === 10) {
      const phoneE164 = `91${phone10}`;
      const variants = [phone10, phoneE164, `+${phoneE164}`];

      // 2a) Number tied to an existing employee/owner of another account.
      const { data: empByPhone } = await (admin
        .from('employees')
        .select('auth_user_id, tenant_id, email, phone')
        .in('phone', variants)
        .eq('is_active', true) as any);
      const phoneHit = (empByPhone ?? []).find(
        (e: any) => e.auth_user_id && e.auth_user_id !== user.id,
      );
      if (phoneHit) {
        return NextResponse.json({ exists: true, reason: 'phone', email: maskEmail(phoneHit.email) });
      }

      // 2b) Number verified as another user's WhatsApp login (auth metadata).
      const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
      const other = (list?.users ?? []).find((u: any) => {
        if (u.id === user.id) return false;
        const metaPhone = digits(u.user_metadata?.phone);
        const authPhone = digits(u.phone);
        const matches =
          (metaPhone && metaPhone.endsWith(phone10)) || (authPhone && authPhone.endsWith(phone10));
        const hasAccount = !!u.user_metadata?.tenant_id;
        return matches && hasAccount;
      });
      if (other) {
        return NextResponse.json({ exists: true, reason: 'phone', email: maskEmail(other.email) });
      }
    }

    return NextResponse.json({ exists: false });
  } catch (err) {
    console.error('[check-existing] error:', err);
    // Fail open so a transient error never hard-blocks a legitimate signup.
    return NextResponse.json({ exists: false });
  }
}
