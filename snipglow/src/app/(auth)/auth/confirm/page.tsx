'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

// =============================================================================
// Auth Confirm — Handles implicit flow OAuth callback
// The access token is in the URL hash fragment (#access_token=...)
// This page reads it, sets the session, then redirects to dashboard.
// =============================================================================

export default function AuthConfirmPage() {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();

    // Listen for auth state change — Supabase client auto-processes the hash
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        const user = session.user;

        // Check phone verification
        const hasPhone = user.user_metadata?.phone || user.phone;
        if (!hasPhone) {
          router.replace('/verify-phone');
          return;
        }

        // Check employee record
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
        } else {
          router.replace('/onboarding');
        }
      } else if (event === 'SIGNED_OUT' || (!session && event !== 'INITIAL_SESSION')) {
        router.replace('/login?error=auth_failed');
      }
    });

    // Fallback: if already signed in, redirect immediately
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        const user = session.user;
        const hasPhone = user.user_metadata?.phone || user.phone;
        if (!hasPhone) {
          router.replace('/verify-phone');
        } else if (user.user_metadata?.tenant_id) {
          router.replace('/dashboard');
        } else {
          router.replace('/onboarding');
        }
      }
    });

    return () => subscription.unsubscribe();
  }, [router]);

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
