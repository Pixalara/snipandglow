'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { ArrowRight, MessageCircle } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [googleLoading, setGoogleLoading] = useState(false);
  const [phoneLoading, setPhoneLoading] = useState(false);
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'choose' | 'phone'>('choose');

  async function handleGoogleSignIn() {
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
      setError('Failed to initiate sign-in. Please try again.');
      setGoogleLoading(false);
    }
  }

  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const cleaned = phone.replace(/[\s\-\(\)\+]/g, '');
    if (cleaned.length < 10) {
      setError('Please enter a valid 10-digit mobile number');
      return;
    }

    setPhoneLoading(true);
    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: cleaned }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to send OTP');
        setPhoneLoading(false);
        return;
      }

      // Redirect to verify-otp page
      router.push(`/verify-otp?phone=${data.phone}`);
    } catch {
      setError('Network error. Please try again.');
      setPhoneLoading(false);
    }
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-gradient-to-br from-pink-100 to-violet-100 border border-pink-200 mx-auto mb-2">
          <span className="text-lg font-bold bg-gradient-to-r from-pink-500 to-violet-500 bg-clip-text text-transparent">S</span>
        </div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Welcome to <span className="text-slate-900">snipand</span><span className="bg-gradient-to-r from-pink-500 via-fuchsia-500 to-violet-500 bg-clip-text text-transparent">glow</span></h1>
        <p className="text-sm text-slate-500">Sign in to manage your salon on autopilot</p>
      </div>

      {/* Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xl shadow-slate-100/50 p-6 sm:p-8 space-y-5">

        {mode === 'choose' && (
          <>
            {/* Google Sign In */}
            <button
              onClick={handleGoogleSignIn}
              disabled={googleLoading}
              className="w-full flex items-center justify-center gap-3 min-h-[48px] h-12 rounded-xl border border-slate-200 bg-white text-slate-700 font-medium text-sm hover:border-emerald-300 hover:bg-emerald-50/50 transition-all shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              {googleLoading ? 'Redirecting to Google...' : 'Continue with Google'}
            </button>

            {/* Divider */}
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-slate-200" />
              <span className="text-xs text-slate-400 font-medium">OR</span>
              <div className="flex-1 h-px bg-slate-200" />
            </div>

            {/* WhatsApp OTP */}
            <button
              onClick={() => setMode('phone')}
              className="w-full flex items-center justify-center gap-3 min-h-[48px] h-12 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 font-medium text-sm hover:border-emerald-300 hover:bg-emerald-100 transition-all shadow-sm"
            >
              <MessageCircle className="h-5 w-5" />
              Login with WhatsApp OTP
            </button>
          </>
        )}

        {mode === 'phone' && (
          <form onSubmit={handleSendOtp} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="phone" className="text-sm font-medium text-slate-700">
                WhatsApp Number
              </label>
              <div className="flex items-center gap-2">
                <span className="flex items-center justify-center h-11 px-3 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-500 font-medium">
                  +91
                </span>
                <input
                  id="phone"
                  type="tel"
                  inputMode="numeric"
                  placeholder="Enter your 10-digit number"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  className="flex-1 h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 transition-all"
                  disabled={phoneLoading}
                  autoFocus
                />
              </div>
              <p className="text-xs text-slate-400">We'll send a 6-digit OTP to your WhatsApp</p>
            </div>

            <button
              type="submit"
              disabled={phoneLoading || phone.length < 10}
              className="w-full flex items-center justify-center gap-2 min-h-[48px] h-12 rounded-xl bg-emerald-600 text-white font-medium text-sm hover:bg-emerald-700 transition-all shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <MessageCircle className="h-4 w-4" />
              {phoneLoading ? 'Sending OTP...' : 'Send OTP via WhatsApp'}
            </button>

            <button
              type="button"
              onClick={() => { setMode('choose'); setError(null); }}
              className="w-full text-sm text-slate-500 hover:text-slate-700 transition-colors"
            >
              ← Back to all options
            </button>
          </form>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-center">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {/* Info */}
        {mode === 'choose' && (
          <div className="bg-slate-50 rounded-xl px-4 py-3 space-y-2">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <ArrowRight className="h-3 w-3 text-emerald-500" />
              <span>Use Google if you signed up with Google</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <ArrowRight className="h-3 w-3 text-emerald-500" />
              <span>Use WhatsApp OTP with the number you registered</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <ArrowRight className="h-3 w-3 text-emerald-500" />
              <span>New users will be guided through salon setup</span>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="text-center space-y-3">
        <p className="text-xs text-slate-400">
          15-day free trial · No credit card required
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
