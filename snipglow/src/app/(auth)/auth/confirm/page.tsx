'use client';

import { useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import { nextSignupStep } from '@/lib/auth/signup-state';

// =============================================================================
// Auth Confirm — handles the IMPLICIT flow OAuth callback, where the access token
// arrives in the URL hash (#access_token=...) and so can only be read in the
// browser. The PKCE equivalent is /api/auth/callback.
//
// Both must make the same routing decision, and both must require the WhatsApp
// number before onboarding. That decision lives in `nextSignupStep` — this page
// previously duplicated it twice (once in the listener, once in the fallback) and
// the two copies had already diverged: the fallback checked
// `user_metadata.tenant_id` while the listener queried the employees table.
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

    // Supabase auto-processes the hash and emits SIGNED_IN.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        void routeUser(session.user);
      } else if (event === 'SIGNED_OUT' || (!session && event !== 'INITIAL_SESSION')) {
        router.replace('/login?error=auth_failed');
      }
    });

    // Fallback for an already-established session, where no event fires.
    void supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) void routeUser(session.user);
    });

    return () => subscription.unsubscribe();
  }, [router, routeUser]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-white via-pink-50/30 to-fuchsia-50/20">
      <div className="text-center space-y-4">
        <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-gradient-to-br from-pink-100 to-violet-100 border border-pink-200 mx-auto">
          <span className="text-lg font-bold bg-gradient-to-r from-pink-500 to-violet-500 bg-clip-text text-transparent">S</span>
        </div>
        <div className="flex items-center gap-2 text-slate-500">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-pink-500 border-t-transparent" />
          <span className="text-sm">Signing you in...</span>
        </div>
      </div>
    </div>
  );
}
