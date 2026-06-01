import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/dashboard';

  // With implicit flow, there's no code — the token is in the hash fragment
  // handled client-side. But we still handle PKCE code flow as fallback.
  if (code) {
    const response = NextResponse.redirect(`${origin}${next}`);

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
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
      console.error('[Auth Callback] PKCE exchange failed:', error.message);
      // Don't fail — redirect to dashboard and let client-side handle it
      return NextResponse.redirect(`${origin}/login?error=auth_failed`);
    }

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.redirect(`${origin}/login?error=auth_failed`);
    }

    const hasPhone = user.user_metadata?.phone || user.phone;
    if (!hasPhone) {
      response.headers.set('Location', `${origin}/verify-phone`);
      return response;
    }

    const { data: employee } = await supabase
      .from('employees')
      .select('tenant_id, branch_id, role')
      .eq('auth_user_id', user.id)
      .eq('is_active', true)
      .single();

    if (employee) {
      await supabase.auth.updateUser({
        data: {
          tenant_id: employee.tenant_id,
          branch_id: employee.branch_id,
          role: employee.role,
        },
      });
      response.headers.set('Location', `${origin}${next}`);
    } else {
      response.headers.set('Location', `${origin}/onboarding`);
    }

    return response;
  }

  // No code — with implicit flow, redirect to a client-side handler page
  // that reads the hash fragment and sets the session
  return NextResponse.redirect(`${origin}/auth/confirm`);
}
