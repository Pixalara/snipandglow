'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Phone, Smartphone, CheckCircle2, Shield, AlertTriangle } from 'lucide-react';

// =============================================================================
// Phone Verification Page
// Shows after Google sign-in if user hasn't verified their phone yet.
// Sends 6-digit OTP via WhatsApp, verifies, then continues to onboarding/dashboard.
// =============================================================================

export default function VerifyPhonePage() {
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [sentPhone, setSentPhone] = useState('');
  const [phoneLoading, setPhoneLoading] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [checking, setChecking] = useState(true);
  // Set when the email/number already belongs to an existing account.
  const [existing, setExisting] = useState<{ email: string; reason: 'email' | 'phone' } | null>(null);

  // Check if user is authenticated and if phone is already verified
  useEffect(() => {
    async function checkUser() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.push('/login');
        return;
      }

      // If phone is already verified, skip this step
      const phone = user.user_metadata?.phone || user.phone;
      if (phone) {
        // Phone already verified — continue to appropriate page
        const tenantId = user.user_metadata?.tenant_id;
        router.push(tenantId ? '/dashboard' : '/onboarding');
        return;
      }

      setUserName(user.user_metadata?.name || user.email?.split('@')[0] || 'there');
      setUserEmail(user.email || '');
      setChecking(false);

      // Detect if this Google email already belongs to an existing account.
      try {
        const res = await fetch('/api/auth/check-existing', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        });
        const data = await res.json();
        if (data?.exists) setExisting({ email: data.email, reason: data.reason });
      } catch {
        // Non-fatal: never block on a check error.
      }
    }
    checkUser();
  }, [router]);

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
      // Block duplicate signups: if this WhatsApp number (or email) already
      // belongs to an account, prompt the user to sign in instead.
      const checkRes = await fetch('/api/auth/check-existing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: cleaned }),
      });
      const checkData = await checkRes.json();
      if (checkData?.exists) {
        setExisting({ email: checkData.email, reason: checkData.reason });
        setPhoneLoading(false);
        return;
      }

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
      // Verify OTP
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: sentPhone, code: otp }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Verification failed');
        setOtpLoading(false);
        return;
      }

      // OTP verified — update user metadata with phone number
      const supabase = createClient();
      await supabase.auth.updateUser({
        data: { phone: sentPhone },
      });

      // Continue to onboarding or dashboard
      const { data: { user } } = await supabase.auth.getUser();
      const tenantId = user?.user_metadata?.tenant_id;
      router.push(tenantId ? '/dashboard' : '/onboarding');
      router.refresh();
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setOtpLoading(false);
    }
  }

  if (checking) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="size-6 animate-spin rounded-full border-2 border-pink-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Existing-account popup — blocks duplicate signup */}
      {existing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setExisting(null)} aria-hidden="true" />
          <div role="alertdialog" aria-modal="true" className="relative w-full max-w-sm rounded-2xl border border-slate-200 bg-white shadow-2xl p-6 space-y-4 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-amber-100 mx-auto">
              <AlertTriangle className="size-6 text-amber-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Account already exists</h2>
              <p className="text-sm text-slate-500 mt-1.5 leading-relaxed">
                {existing.reason === 'email' ? (
                  <>An account is already registered with this Google email (<span className="font-medium text-slate-700">{existing.email}</span>). Please sign in instead.</>
                ) : (
                  <>This WhatsApp number is already linked to an existing account (<span className="font-medium text-slate-700">{existing.email}</span>). Please sign in instead.</>
                )}
              </p>
            </div>
            <div className="flex flex-col gap-2 pt-1">
              <Link
                href="/login"
                className="w-full flex items-center justify-center h-11 rounded-xl bg-emerald-600 text-white font-semibold text-sm hover:bg-emerald-700 transition-colors"
              >
                Sign in
              </Link>
              <button
                type="button"
                onClick={() => setExisting(null)}
                className="w-full h-10 rounded-xl text-sm text-slate-500 hover:text-slate-700 transition-colors"
              >
                {existing.reason === 'email' ? 'Close' : 'Use a different number'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-gradient-to-br from-green-100 to-emerald-100 border border-green-200 mx-auto mb-2">
          <Shield className="h-6 w-6 text-green-600" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Verify Your Phone</h1>
        <p className="text-sm text-slate-500">
          Hi {userName}! One last step — verify your WhatsApp number for secure access.
        </p>
      </div>

      {/* Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xl shadow-slate-100/50 p-6 sm:p-8 space-y-5">

        {/* Authenticated user info */}
        <div className="flex items-center gap-3 rounded-xl bg-emerald-50 border border-emerald-100 px-4 py-3">
          <CheckCircle2 className="size-5 text-emerald-600 shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-emerald-800 truncate">Google verified: {userEmail}</p>
            <p className="text-xs text-emerald-600">Now verify your phone number</p>
          </div>
        </div>

        {!otpSent ? (
          /* Phone Number Input */
          <form onSubmit={handleSendOtp} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="phone" className="text-sm font-medium text-slate-700">
                WhatsApp Number
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
                  Send OTP via WhatsApp
                </>
              )}
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
      </div>

      {/* Why we need this */}
      <div className="text-center">
        <p className="text-xs text-slate-400">
          🔒 Phone verification ensures secure access and enables WhatsApp notifications for your salon.
        </p>
      </div>
    </div>
  );
}
