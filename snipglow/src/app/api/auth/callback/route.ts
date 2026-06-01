import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/dashboard';

  if (code) {
    const cookieStore = await cookies();

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch {
              // Will be handled via response headers below
            }
          },
        },
      }
    );

    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        // Check if phone is verified
        const hasPhone = user.user_metadata?.phone || user.phone;
        if (!hasPhone) {
          const response = NextResponse.redirect(`${origin}/verify-phone`);
          // Forward any cookies set during exchange
          const newCookies = cookieStore.getAll();
          newCookies.forEach(({ name, value }) => {
            response.cookies.set(name, value);
          });
          return response;
        }

        // Check if user has an employee record
        const { data: employee } = await supabase
          .from('employees')
          .select('tenant_id, branch_id, role')
          .eq('auth_user_id', user.id)
          .eq('is_active', true)
          .single();

        let redirectUrl = `${origin}/onboarding`;

        if (employee) {
          // Update user metadata with tenant context
          await supabase.auth.updateUser({
            data: {
              tenant_id: employee.tenant_id,
              branch_id: employee.branch_id,
              role: employee.role,
            },
          });
          redirectUrl = `${origin}${next}`;
        }

        const response = NextResponse.redirect(redirectUrl);
        // Forward session cookies to the response so they persist
        cookieStore.getAll().forEach(({ name, value }) => {
          response.cookies.set(name, value, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
          });
        });
        return response;
      }
    }

    console.error('[Auth Callback] exchangeCodeForSession error:', error?.message);
  }

  // Auth failed — redirect to login with error
  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}
