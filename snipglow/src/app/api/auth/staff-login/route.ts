import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

// =============================================================================
// POST /api/auth/staff-login
//
// Pre-flight check for staff login. Staff log in with their PHONE NUMBER as the
// user id + the password the owner set. Internally the phone maps to a synthetic
// auth email (`<digits>@staff.snipandglow.com`).
//
// Enforces the security gate: a staff account cannot log in until the OWNER has
// verified the staff member's WhatsApp number from the owner dashboard.
//
// Returns the synthetic email so the client can call signInWithPassword.
// =============================================================================

function normalizeStaffPhone(raw: string): string | null {
  const digits = (raw || '').replace(/\D/g, '');
  const ten = digits.length === 12 && digits.startsWith('91') ? digits.slice(2) : digits;
  if (ten.length !== 10 || !/^[6-9]/.test(ten)) return null;
  return ten;
}

export async function POST(request: NextRequest) {
  try {
    const { phone } = await request.json();

    if (!phone || typeof phone !== 'string') {
      return NextResponse.json({ error: 'Phone number is required' }, { status: 400 });
    }

    const phone10 = normalizeStaffPhone(phone);
    if (!phone10) {
      return NextResponse.json({ error: 'Enter a valid 10-digit mobile number.' }, { status: 400 });
    }

    const loginEmail = `${phone10}@staff.snipandglow.com`;
    const admin = createAdminClient();

    // Find the password-staff employee row by phone.
    const { data: emp } = await ((admin
      .from('employees') as any)
      .select('id, is_active, login_method, phone_verified_by_owner')
      .eq('phone', phone10)
      .eq('login_method', 'password')
      .limit(1)
      .maybeSingle() as any);

    if (!emp) {
      return NextResponse.json(
        { error: 'No staff login found for this number. Ask your salon owner to create your access.' },
        { status: 404 }
      );
    }

    if (!emp.is_active) {
      return NextResponse.json(
        { error: 'This staff account has been deactivated. Contact your salon owner.' },
        { status: 403 }
      );
    }

    if (!emp.phone_verified_by_owner) {
      return NextResponse.json(
        { error: 'Your account is awaiting verification by your salon owner. Please ask them to verify your WhatsApp number.' },
        { status: 403 }
      );
    }

    return NextResponse.json({ ok: true, email: loginEmail });
  } catch (err) {
    console.error('[StaffLogin] Unexpected error:', err);
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}
