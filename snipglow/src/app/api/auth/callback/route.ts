import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { nextSignupStep } from '@/lib/auth/signup-state';

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
      console.error('[Auth Callback] PKCE exchange failed, handing off to client:', error.message);
      // The browser that STARTED this OAuth flow still holds the PKCE code
      // verifier (it generated and stored it before redirecting to Google).
      // When the server copy is missing — e.g. the verifier cookie was written
      // on a different host during domain canonicalisation — the server
      // exchange fails even though the browser could complete it. That is the
      // "first attempt errors, second works" bug. Instead of dead-ending at
      // /login, hand the code to the client-side confirm page, which runs the
      // exchange with the browser client that owns the verifier.
      const confirmUrl = new URL(`${origin}/auth/confirm`);
      confirmUrl.searchParams.set('code', code);
      confirmUrl.searchParams.set('next', next);
      return NextResponse.redirect(confirmUrl);
    }

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.redirect(`${origin}/login?error=auth_failed`);
    }

    // Resolve the salon FIRST. An existing member (owner or staff) must reach the
    // dashboard without being re-verified — only signups in progress are gated.
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
      return response;
    }

    // Signup in progress. Google is done by definition (we just came back from
    // it), so the shared helper decides whether the WhatsApp number is still
    // outstanding. Using the helper rather than an inline check keeps this route,
    // /auth/confirm, /verify-phone and middleware in agreement.
    const step = nextSignupStep(user);
    response.headers.set(
      'Location',
      `${origin}${step === '/dashboard' ? '/onboarding' : step}`
    );
    return response;
  }

  // No code — with implicit flow, redirect to a client-side handler page
  // that reads the hash fragment and sets the session
  return NextResponse.redirect(`${origin}/auth/confirm`);
}
