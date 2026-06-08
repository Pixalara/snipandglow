import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSbClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';

// =============================================================================
// POST /api/auth/staff-verify/confirm
//
// Confirms a staff member's WhatsApp + email OTP codes. On success it flips
// email_verified_by_owner / phone_verified_by_owner to true, which unlocks
// login. Both codes must be valid — proving the real person controls both
// channels.
//
// Body: { session_token, phone_code, email, email_code }
// =============================================================================

export async function POST(request: NextRequest) {
  try {
    const { session_token, phone_code, email, email_code } = await request.json();

    if (!session_token || !phone_code || !email || !email_code) {
      return NextResponse.json({ error: 'All codes are required.' }, { status: 400 });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const admin = createAdminClient();

    // ── 1. Validate the WhatsApp code against the stored row ──
    const { data: codeRow } = await ((admin as any)
      .from('staff_verification_codes')
      .select('id, employee_id, phone_code, expires_at')
      .eq('session_token', session_token)
      .limit(1)
      .maybeSingle() as any);

    if (!codeRow) {
      return NextResponse.json({ error: 'Verification session not found. Please restart.' }, { status: 400 });
    }
    if (new Date(codeRow.expires_at) < new Date()) {
      await ((admin as any).from('staff_verification_codes').delete().eq('id', codeRow.id) as any);
      return NextResponse.json({ error: 'Codes expired. Please request new ones.' }, { status: 400 });
    }
    if (String(codeRow.phone_code) !== String(phone_code).trim()) {
      return NextResponse.json({ error: 'Incorrect WhatsApp code.' }, { status: 400 });
    }

    // Confirm the employee row matches this email (defense in depth).
    const { data: emp } = await ((admin
      .from('employees') as any)
      .select('id, email')
      .eq('id', codeRow.employee_id)
      .limit(1)
      .maybeSingle() as any);
    if (!emp || (emp.email || '').toLowerCase() !== normalizedEmail) {
      return NextResponse.json({ error: 'Verification mismatch. Please restart.' }, { status: 400 });
    }

    // ── 2. Validate the email code via Supabase Auth OTP verification ──
    const sb = createSbClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );
    const { error: verifyErr } = await sb.auth.verifyOtp({
      email: normalizedEmail,
      token: String(email_code).trim(),
      type: 'email',
    });
    if (verifyErr) {
      return NextResponse.json({ error: 'Incorrect email code.' }, { status: 400 });
    }

    // ── 3. Both proven — mark verified and clear the code row ──
    await ((admin
      .from('employees') as any)
      .update({ email_verified_by_owner: true, phone_verified_by_owner: true })
      .eq('id', emp.id) as any);
    await ((admin as any).from('staff_verification_codes').delete().eq('id', codeRow.id) as any);

    return NextResponse.json({ ok: true, verified: true });
  } catch (err) {
    console.error('[StaffVerify/confirm] Unexpected error:', err);
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}

