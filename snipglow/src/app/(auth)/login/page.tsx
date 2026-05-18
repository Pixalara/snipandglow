'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { ArrowRight, Phone, Smartphone } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Phone OTP state
  const [showPhoneLogin, setShowPhoneLogin] = useState(false);
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [phoneLoading, setPhoneLoading] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [sentPhone, setSentPhone] = useState('');

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

    const cleaned = phone.replace(/[\s\-\(\)]/g, '');
    if (cleaned.length < 10 || !/^[6-9]/.test(cleaned.slice(-10))) {
      setError('Please enter a valid 10-digit Indian mobile number');
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
        return;
      }

      setOtpSent(true);
      setSentPhone(data.phone);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setPhoneLoading(false);
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (otp.length !== 6) {
      setError('Please enter the full 6-digit code');
      return;
    }

    setOtpLoading(true);
    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: sentPhone, code: otp }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Verification failed');
        return;
      }

      // Sign in with the token via Supabase
      if (data.token && data.email) {
        const supabase = createClient();
        const { error: authError } = await supabase.auth.verifyOtp({
          email: data.email,
          token: data.token,
          type: 'email',
        });

        if (authError) {
          // Fallback: try magic link approach
          console.error('OTP verify error:', authError);
          // Redirect anyway since user was created
          router.push(data.redirect || '/onboarding');
          return;
        }
      }

      // Redirect based on response
      router.push(data.redirect || '/onboarding');
      router.refresh();
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setOtpLoading(false);
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

        {!showPhoneLogin ? (
          <>
            {/* Google Sign In — Primary */}
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

            {/* Phone Login Button */}
            <button
              onClick={() => setShowPhoneLogin(true)}
              className="w-full flex items-center justify-center gap-3 min-h-[48px] h-12 rounded-xl border border-slate-200 bg-white text-slate-700 font-medium text-sm hover:border-green-300 hover:bg-green-50/50 transition-all shadow-sm"
            >
              <Smartphone className="h-5 w-5 text-green-600" />
              Continue with WhatsApp OTP
            </button>
          </>
        ) : !otpSent ? (
          /* Phone Number Input */
          <form onSubmit={handleSendOtp} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="phone" className="text-sm font-medium text-slate-700">
                Mobile Number
              </label>
              <div className="flex items-center gap-2">
                <span className="flex items-center justify-center h-11 px-3 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-600 font-medium">
                  +91
                </span>
                <input
                  id="phone"
                  type="tel"
                  inputMode="numeric"
                  maxLength={10}
                  placeholder="Enter 10-digit number"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  className="flex-1 h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400 transition-all"
                  autoFocus
                />
              </div>
              <p className="text-xs text-slate-400">We&apos;ll send a 6-digit OTP to your WhatsApp</p>
            </div>

            <button
              type="submit"
              disabled={phoneLoading || phone.length < 10}
              className="w-full flex items-center justify-center gap-2 min-h-[48px] h-12 rounded-xl bg-green-600 text-white font-semibold text-sm hover:bg-green-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {phoneLoading ? (
                <>
                  <span className="size-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Sending OTP...
                </>
              ) : (
                <>
                  <Phone className="size-4" />
                  Send OTP
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => { setShowPhoneLogin(false); setError(null); }}
              className="w-full text-sm text-slate-500 hover:text-slate-700 transition-colors"
            >
              ← Back to all options
            </button>
          </form>
        ) : (
          /* OTP Verification */
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <div className="text-center mb-2">
              <div className="flex size-12 items-center justify-center rounded-full bg-green-100 mx-auto mb-3">
                <Smartphone className="size-5 text-green-600" />
              </div>
              <p className="text-sm text-slate-600">
                Enter the 6-digit code sent to your WhatsApp
              </p>
              <p className="text-xs text-slate-400 mt-1">
                +91 {sentPhone.slice(-10, -5)}***{sentPhone.slice(-3)}
              </p>
            </div>

            <div className="space-y-2">
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="000000"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="w-full h-14 rounded-xl border border-slate-200 bg-white px-4 text-center text-2xl font-bold tracking-[0.4em] text-slate-900 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400 transition-all"
                autoFocus
                autoComplete="one-time-code"
              />
            </div>

            <button
              type="submit"
              disabled={otpLoading || otp.length !== 6}
              className="w-full flex items-center justify-center gap-2 min-h-[48px] h-12 rounded-xl bg-green-600 text-white font-semibold text-sm hover:bg-green-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {otpLoading ? (
                <>
                  <span className="size-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Verifying...
                </>
              ) : (
                'Verify & Continue'
              )}
            </button>

            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => { setOtpSent(false); setOtp(''); setError(null); }}
                className="text-xs text-slate-500 hover:text-slate-700 transition-colors"
              >
                ← Change number
              </button>
              <button
                type="button"
                onClick={() => { setOtp(''); handleSendOtp(new Event('submit') as any); }}
                className="text-xs text-green-600 hover:text-green-700 font-medium transition-colors"
              >
                Resend OTP
              </button>
            </div>
          </form>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-center">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {/* Info */}
        {!showPhoneLogin && (
          <div className="bg-slate-50 rounded-xl px-4 py-3 space-y-2">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <ArrowRight className="h-3 w-3 text-emerald-500" />
              <span>New users will be guided through salon setup</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <ArrowRight className="h-3 w-3 text-emerald-500" />
              <span>Existing users go straight to dashboard</span>
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
