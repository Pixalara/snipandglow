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
  const [mode, setMode] = useState<'choose' | 'phone' | 'staff'>('choose');
  const [staffEmail, setStaffEmail] = useState('');
  const [staffPassword, setStaffPassword] = useState('');
  const [staffLoading, setStaffLoading] = useState(false);
  // Staff code-based verification (first-login proof of email + WhatsApp).
  const [verifyMode, setVerifyMode] = useState(false);
  const [verifySessionToken, setVerifySessionToken] = useState('');
  const [verifyMaskedPhone, setVerifyMaskedPhone] = useState('');
  const [phoneCode, setPhoneCode] = useState('');
  const [emailCode, setEmailCode] = useState('');
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verifyInfo, setVerifyInfo] = useState<string | null>(null);

  async function handleGoogleSignIn() {
    setError(null);
    setGoogleLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/api/auth/callback`,
          queryParams: { access_type: 'offline', prompt: 'select_account' },
          skipBrowserRedirect: false,
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

  async function handleStaffLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const email = staffEmail.trim().toLowerCase();
    if (!email || !staffPassword) {
      setError('Please enter your email and password.');
      return;
    }

    setStaffLoading(true);
    try {
      // 1. Pre-flight gate: blocks unverified / deactivated staff before any
      //    session is issued.
      const res = await fetch('/api/auth/staff-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        // If the block is because the account is awaiting verification, offer
        // the inline code-based verification flow instead of a dead end.
        if (res.status === 403 && /verif/i.test(data.error || '')) {
          setError(null);
          await startStaffVerification(email);
          setStaffLoading(false);
          return;
        }
        setError(data.error || 'Login is not allowed for this account.');
        setStaffLoading(false);
        return;
      }

      // 2. Gate passed — perform the actual password sign-in (sets cookies).
      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password: staffPassword,
      });
      if (signInError) {
        setError('Invalid email or password.');
        setStaffLoading(false);
        return;
      }

      // 3. Land on the dashboard; middleware routes by role/tenant.
      router.push('/dashboard');
    } catch {
      setError('Network error. Please try again.');
      setStaffLoading(false);
    }
  }

  async function startStaffVerification(email: string) {
    setVerifyInfo(null);
    setVerifyLoading(true);
    try {
      const res = await fetch('/api/auth/staff-verify/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Could not start verification.');
        setVerifyLoading(false);
        return;
      }
      if (data.alreadyVerified) {
        setVerifyInfo('Your account is already verified. Please sign in.');
        setVerifyLoading(false);
        return;
      }
      setVerifySessionToken(data.session_token);
      setVerifyMaskedPhone(data.maskedPhone || '');
      setVerifyMode(true);
      setVerifyInfo(
        `We sent a 6-digit code to your WhatsApp (${data.maskedPhone || ''}) and your email. Enter both to verify your account.`
      );
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setVerifyLoading(false);
    }
  }

  async function handleStaffVerify(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (phoneCode.length < 6 || emailCode.length < 6) {
      setError('Enter both 6-digit codes.');
      return;
    }
    setVerifyLoading(true);
    try {
      const res = await fetch('/api/auth/staff-verify/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_token: verifySessionToken,
          phone_code: phoneCode,
          email: staffEmail.trim().toLowerCase(),
          email_code: emailCode,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Verification failed.');
        setVerifyLoading(false);
        return;
      }
      // Verified — sign in immediately with the password they already entered.
      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: staffEmail.trim().toLowerCase(),
        password: staffPassword,
      });
      if (signInError) {
        // Verified but password missing/incorrect — send them back to sign in.
        setVerifyMode(false);
        setVerifyInfo('Your account is verified! Please sign in with your password.');
        setVerifyLoading(false);
        return;
      }
      router.push('/dashboard');
    } catch {
      setError('Network error. Please try again.');
      setVerifyLoading(false);
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

            {/* Staff login (email + password set by owner) */}
            <button
              onClick={() => { setMode('staff'); setError(null); }}
              className="w-full flex items-center justify-center gap-2 min-h-[44px] text-sm font-medium text-slate-500 hover:text-slate-700 transition-colors"
            >
              Staff member? Login with email & password
            </button>
          </>
        )}

        {mode === 'staff' && (
          <form onSubmit={handleStaffLogin} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="staff-email" className="text-sm font-medium text-slate-700">
                Staff Email
              </label>
              <input
                id="staff-email"
                type="email"
                placeholder="you@salon.com"
                value={staffEmail}
                onChange={(e) => setStaffEmail(e.target.value)}
                className="w-full h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400 transition-all"
                disabled={staffLoading}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="staff-password" className="text-sm font-medium text-slate-700">
                Password
              </label>
              <input
                id="staff-password"
                type="password"
                placeholder="Password set by your salon owner"
                value={staffPassword}
                onChange={(e) => setStaffPassword(e.target.value)}
                className="w-full h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400 transition-all"
                disabled={staffLoading}
              />
              <p className="text-xs text-slate-400">Your salon owner sets and shares these credentials.</p>
            </div>
            <button
              type="submit"
              disabled={staffLoading || !staffEmail || !staffPassword}
              className="w-full flex items-center justify-center gap-2 min-h-[48px] h-12 rounded-xl bg-violet-600 text-white font-medium text-sm hover:bg-violet-700 transition-all shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {staffLoading ? 'Signing in...' : 'Sign in'}
            </button>
            <button
              type="button"
              onClick={() => { setMode('choose'); setError(null); setVerifyMode(false); }}
              className="w-full text-sm text-slate-500 hover:text-slate-700 transition-colors"
            >
              ← Back to all options
            </button>

            {/* Inline verification (first login) */}
            {verifyMode && (
              <div className="mt-2 space-y-3 rounded-xl border border-violet-200 bg-violet-50/60 p-4">
                <p className="text-xs text-slate-600">
                  {verifyInfo || 'Enter the codes sent to your WhatsApp and email.'}
                </p>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-slate-700">WhatsApp code {verifyMaskedPhone && `(${verifyMaskedPhone})`}</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={phoneCode}
                    onChange={(e) => setPhoneCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="6-digit WhatsApp code"
                    className="w-full h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm tracking-widest text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-500/30"
                    disabled={verifyLoading}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-slate-700">Email code</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={emailCode}
                    onChange={(e) => setEmailCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="6-digit email code"
                    className="w-full h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm tracking-widest text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-500/30"
                    disabled={verifyLoading}
                  />
                </div>
                <button
                  type="button"
                  onClick={handleStaffVerify}
                  disabled={verifyLoading || phoneCode.length < 6 || emailCode.length < 6}
                  className="w-full flex items-center justify-center gap-2 min-h-[44px] h-11 rounded-xl bg-violet-600 text-white font-medium text-sm hover:bg-violet-700 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {verifyLoading ? 'Verifying...' : 'Verify & sign in'}
                </button>
                <button
                  type="button"
                  onClick={() => startStaffVerification(staffEmail.trim().toLowerCase())}
                  disabled={verifyLoading}
                  className="w-full text-xs text-slate-500 hover:text-slate-700 transition-colors"
                >
                  Resend codes
                </button>
              </div>
            )}
          </form>
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
              <span>New user? Sign up with Google first, then verify WhatsApp</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <ArrowRight className="h-3 w-3 text-emerald-500" />
              <span>Already signed up? Use either Google or WhatsApp OTP to login</span>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="text-center space-y-3">
        <p className="text-sm text-slate-500">
          Don't have an account?{' '}
          <a href="/signup" className="text-emerald-600 font-medium hover:underline">
            Sign up
          </a>
        </p>
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
