import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { consumeOtpCode, tenDigitPhone } from '@/lib/auth/otp';

export const runtime = 'nodejs';

// =============================================================================
// POST /api/auth/attach-phone
//
// Adds a WhatsApp-verified number to the account the caller is ALREADY signed
// into. Used by /verify-phone, the second half of Google-first signup.
//
// Why this exists as its own route: /verify-phone used to post to
// `/api/auth/verify-otp`, the SIGN-IN endpoint. For a freshly signed-in Google
// user with no employee row, that endpoint fell through to its "new user" branch
// and created a SECOND, orphan auth account with a fabricated
// `<phone>@phone.snipandglow.com` email — every single Google signup quietly
// littered auth.users with a duplicate, and those duplicates were then
// resurrectable by the phone sign-in path.
//
// This route never creates a user. It requires a session and only ever updates
// that user.
//
// Body: { phone: string, code: string }
// =============================================================================

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // A session is mandatory: this attaches to *you*, so there is nothing to do
    // without knowing who you are.
    if (!user) {
      return NextResponse.json(
        { error: 'NOT_AUTHENTICATED', message: 'Please sign in again to verify your number.' },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => null);
    const phoneInput = body?.phone as string | undefined;
    const code = body?.code as string | undefined;

    if (!phoneInput || !code) {
      return NextResponse.json({ error: 'Phone and OTP code are required' }, { status: 400 });
    }

    const admin = createAdminClient();

    const otp = await consumeOtpCode(admin, { phone: phoneInput, code });
    if (!otp.ok || !otp.phone) {
      return NextResponse.json({ error: otp.message ?? 'Verification failed' }, { status: 400 });
    }

    const phone = otp.phone; // 12-digit, e.g. 919586616092
    const phone10 = tenDigitPhone(phone);

    // Guard against two accounts claiming the same WhatsApp number. The number
    // drives booking notifications and OTP sign-in, so it has to be unique.
    // /verify-phone checks this before sending the code; re-checked here because
    // a client-side check is not a constraint.
    const { data: clash } = await admin
      .from('employees')
      .select('auth_user_id, tenant_id')
      .in('phone', [phone10, phone, `+${phone}`])
      .not('auth_user_id', 'is', null)
      .neq('auth_user_id', user.id)
      .limit(1)
      .maybeSingle();

    if (clash) {
      return NextResponse.json(
        {
          error: 'PHONE_IN_USE',
          message:
            'This WhatsApp number is already linked to another SnipandGlow account. Please sign in to that account, or verify a different number.',
        },
        { status: 409 }
      );
    }

    // Record the number. `user_metadata.phone` is what middleware, the OAuth
    // callback and onboarding all read; `app_metadata.phone_verified_at` is the
    // trustworthy copy, because app_metadata can only be written with the service
    // role — a browser cannot forge it via supabase.auth.updateUser.
    const nowIso = new Date().toISOString();
    const { error: updateErr } = await admin.auth.admin.updateUserById(user.id, {
      user_metadata: {
        ...(user.user_metadata ?? {}),
        phone: phone,
      },
      app_metadata: {
        ...(user.app_metadata ?? {}),
        phone_verified_at: nowIso,
        phone_verified: phone,
      },
    });

    if (updateErr) {
      console.error('[attach-phone] failed to record verified phone:', updateErr);
      return NextResponse.json(
        { error: 'Could not save your number. Please try again.' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, phone });
  } catch (err) {
    console.error('[attach-phone] unexpected error:', err);
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}
