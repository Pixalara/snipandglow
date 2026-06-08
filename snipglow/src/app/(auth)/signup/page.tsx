'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { ArrowRight, CheckCircle2 } from 'lucide-react';

export default function SignupPage() {
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGoogleSignUp() {
    setError(null);
    setGoogleLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/api/auth/callback`,
          queryParams: { access_type: 'offline', prompt: 'consent' },
        },
      });
      if (error) {
        setError(error.message);
        setGoogleLoading(false);
      }
    } catch {
      setError('Failed to initiate sign-up. Please try again.');
      setGoogleLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-gradient-to-br from-pink-500 via-fuchsia-500 to-violet-500 shadow-lg shadow-fuchsia-500/25 mx-auto">
          <span className="text-2xl font-bold text-white">S</span>
        </div>
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Create your account</h1>
          <p className="text-sm text-slate-500">
            Start managing your salon with <span className="font-semibold text-slate-700">snipand</span><span className="font-semibold bg-gradient-to-r from-pink-500 via-fuchsia-500 to-violet-500 bg-clip-text text-transparent">glow</span>
          </p>
        </div>
      </div>

      {/* Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xl shadow-slate-200/50 p-6 sm:p-7 space-y-6">

        {/* Steps */}
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-[10px] font-bold text-white">1</span>
            <span className="text-sm text-slate-700">Sign up with Google</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-slate-200 text-[10px] font-bold text-slate-500">2</span>
            <span className="text-sm text-slate-500">Verify your WhatsApp number</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-slate-200 text-[10px] font-bold text-slate-500">3</span>
            <span className="text-sm text-slate-500">Set up your salon</span>
          </div>
        </div>

        {/* Google Sign Up */}
        <button
          onClick={handleGoogleSignUp}
          disabled={googleLoading}
          className="w-full flex items-center justify-center gap-3 min-h-[48px] h-12 rounded-xl border border-slate-200 bg-white text-slate-700 font-medium text-sm hover:border-slate-300 hover:bg-slate-50 transition-all shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
          </svg>
          {googleLoading ? 'Redirecting to Google...' : 'Sign up with Google'}
        </button>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-center">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {/* Benefits */}
        <div className="bg-slate-50 rounded-xl px-4 py-3 space-y-2">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <CheckCircle2 className="h-3 w-3 text-emerald-500" />
            <span>15-day free trial, no credit card needed</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <CheckCircle2 className="h-3 w-3 text-emerald-500" />
            <span>WhatsApp automation included</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <CheckCircle2 className="h-3 w-3 text-emerald-500" />
            <span>Set up in under 5 minutes</span>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="text-center space-y-3">
        <p className="text-sm text-slate-500">
          Already have an account?{' '}
          <Link href="/login" className="text-emerald-600 font-medium hover:underline">
            Sign in
          </Link>
        </p>
        <div className="flex items-center justify-center gap-4 text-xs text-slate-400">
          <a href="/terms" className="hover:text-slate-600 transition-colors">Terms</a>
          <span>·</span>
          <a href="/privacy" className="hover:text-slate-600 transition-colors">Privacy</a>
        </div>
      </div>
    </div>
  );
}
