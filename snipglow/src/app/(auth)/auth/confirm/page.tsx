'use client';

import { useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import { nextSignupStep } from '@/lib/auth/signup-state';

// =============================================================================
// Auth Confirm — the browser-side completion of an OAuth sign-in. It handles two
// cases, both of which can only finish in the browser:
//   1. IMPLICIT flow: the access token arrives in the URL hash (#access_token=)
//      and is auto-read on client init.
//   2. PKCE hand-off: /api/auth/callback normally exchanges the ?code= server
//      side, but when its copy of the code verifier is missing (e.g. a transient
//      failure, or the flow started on a different host) it forwards the code
//      here. The browser client holds the verifier and auto-exchanges the code
//      on init via detectSessionInUrl — which is precisely why we must NOT call
//      exchangeCodeForSession by hand (see the effect below).
//
// The routing decision (dashboard vs finish-signup) lives in `nextSignupStep`,
// shared with /api/auth/callback, /verify-phone and middleware so there is one
// definition of "signup finished". This page previously duplicated it twice and
// the copies had diverged: the fallback checked `user_metadata.tenant_id` while
// the listener queried the employees table.
// =============================================================================

export default function AuthConfirmPage() {
  const router = useRouter();

  const routeUser = useCallback(
    async (user: User) => {
      const supabase = createClient();

      // An existing salon member goes straight in — never re-verified.
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
        router.replace('/dashboard');
        return;
      }

      // Signup in progress: Google is done, so this resolves to /verify-phone
      // when the number is still missing, else /onboarding.
      const step = nextSignupStep(user);
      router.replace(step === '/dashboard' ? '/onboarding' : step);
    },
    [router]
  );

  useEffect(() => {
    const supabase = createClient();

    // Resolve exactly once. Whichever signal arrives first — an auth event, an
    // already-established session, or the fail-safe timeout — wins; the rest
    // become no-ops.
    let settled = false;
    const enter = (user: User) => {
      if (settled) return;
      settled = true;
      void routeUser(user);
    };
    const bail = () => {
      if (settled) return;
      settled = true;
      router.replace('/login?error=auth_failed');
    };

    // Both entry paths (implicit #access_token hash, or the ?code= PKCE hand-off
    // from /api/auth/callback) are auto-processed by the client on init: the
    // browser owns the code verifier and exchanges it itself via
    // detectSessionInUrl. We deliberately do NOT call exchangeCodeForSession
    // here — the code is single-use and the verifier is deleted after the first
    // exchange, so a manual retry would fail and bounce an already-signed-in
    // user back to /login. We just wait for the resulting session.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        enter(session.user);
      } else if (event === 'SIGNED_OUT') {
        bail();
      }
    });

    // The singleton client may have finished initialising (and its exchange)
    // before this effect subscribed, in which case SIGNED_IN won't replay.
    // Reading the session directly closes that gap — getSession() awaits init.
    void supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) enter(session.user);
    });

    // Unrecoverable: the code was already consumed, or this browser never held
    // the verifier. Don't spin on the loader forever — return to a clean login.
    const failSafe = setTimeout(bail, 10000);

    return () => {
      clearTimeout(failSafe);
      subscription.unsubscribe();
    };
  }, [router, routeUser]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-white via-fuchsia-50/30 to-violet-50/20">
      <div className="text-center space-y-4">
        <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-gradient-to-br from-fuchsia-100 to-violet-100 border border-fuchsia-200 mx-auto">
          <span className="text-lg font-bold bg-gradient-to-r from-fuchsia-500 to-violet-600 bg-clip-text text-transparent">S</span>
        </div>
        <div className="flex items-center gap-2 text-slate-500">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-fuchsia-500 border-t-transparent" />
          <span className="text-sm">Signing you in...</span>
        </div>
      </div>
    </div>
  );
}
