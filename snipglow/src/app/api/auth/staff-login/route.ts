import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

// =============================================================================
// POST /api/auth/staff-login
//
// Pre-flight check for owner-provisioned staff (email + password) login.
// Enforces the security gate: a staff account cannot log in until the OWNER has
// verified BOTH the email and the WhatsApp/phone from the owner dashboard.
//
// This endpoint does NOT issue a session itself — the client performs the
// actual signInWithPassword. It only validates that login is permitted and
// returns a clear reason if it is blocked, so we never leak a session for an
// unverified staff account. (signInWithPassword on the client will only be
// called after this returns ok.)
// =============================================================================

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const normalized = email.trim().toLowerCase();
    const admin = createAdminClient();

    // Look up the employee row by email (password-based staff).
    const { data: emp } = await ((admin
      .from('employees') as any)
      .select('id, is_active, login_method, email_verified_by_owner, phone_verified_by_owner, role')
      .ilike('email', normalized)
      .eq('login_method', 'password')
      .limit(1)
      .maybeSingle() as any);

    // Not a password-staff account — let the normal password flow proceed.
    // (Owners using email/password, if any, are unaffected.)
    if (!emp) {
      return NextResponse.json({ ok: true, gated: false });
    }

    if (!emp.is_active) {
      return NextResponse.json(
        { error: 'This staff account has been deactivated. Contact your salon owner.' },
        { status: 403 }
      );
    }

    if (!emp.email_verified_by_owner || !emp.phone_verified_by_owner) {
      const pending: string[] = [];
      if (!emp.email_verified_by_owner) pending.push('email');
      if (!emp.phone_verified_by_owner) pending.push('WhatsApp number');
      return NextResponse.json(
        {
          error: `Your account is awaiting owner verification (${pending.join(' and ')}). Please ask your salon owner to verify you before logging in.`,
        },
        { status: 403 }
      );
    }

    return NextResponse.json({ ok: true, gated: true });
  } catch (err) {
    console.error('[StaffLogin] Unexpected error:', err);
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}
