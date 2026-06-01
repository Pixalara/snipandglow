import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/dashboard';

  if (!code) {
    console.error('[Auth Callback] No code in request');
    return NextResponse.redirect(`${origin}/login?error=auth_failed`);
  }

  // Build the response object first — cookies will be set on it
  const response = NextResponse.redirect(`${origin}${next}`);

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          // Read cookies from the incoming request
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // Write cookies to BOTH the request (for subsequent reads) and the response
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error('[Auth Callback] exchangeCodeForSession failed:', error.message);
    return NextResponse.redirect(`${origin}/login?error=auth_failed`);
  }

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    console.error('[Auth Callback] No user after exchange');
    return NextResponse.redirect(`${origin}/login?error=auth_failed`);
  }

  // Check if phone is verified
  const hasPhone = user.user_metadata?.phone || user.phone;
  if (!hasPhone) {
    response.headers.set('Location', `${origin}/verify-phone`);
    return response;
  }

  // Check if user has an employee record (tenant context)
  const { data: employee } = await supabase
    .from('employees')
    .select('tenant_id, branch_id, role')
    .eq('auth_user_id', user.id)
    .eq('is_active', true)
    .single();

  if (employee) {
    // Inject tenant context into user metadata
    await supabase.auth.updateUser({
      data: {
        tenant_id: employee.tenant_id,
        branch_id: employee.branch_id,
        role: employee.role,
      },
    });
    response.headers.set('Location', `${origin}${next}`);
  } else {
    // No employee record — go to onboarding
    response.headers.set('Location', `${origin}/onboarding`);
  }

  return response;
}
