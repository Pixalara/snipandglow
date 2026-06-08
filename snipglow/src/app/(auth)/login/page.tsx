'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { MessageCircle, ShieldCheck, Users, Lock, Phone } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [googleLoading, setGoogleLoading] = useState(false);
  const [phoneLoading, setPhoneLoading] = useState(false);
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  // Top-level audience tab: owners vs staff. Owners see Google + WhatsApp OTP;
  // staff see phone + password. This removes the old "buried link" confusion.
  const [tab, setTab] = useState<'owner' | 'staff'>('owner');
  const [staffPhone, setStaffPhone] = useState('');
  const [staffPassword, setStaffPassword] = useState('');
  const [staffLoading, setStaffLoading] = useState(false);

  function switchTab(next: 'owner' | 'staff') {
    setTab(next);
    setError(null);
  }

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

    const cleaned = staffPhone.replace(/\D/g, '').slice(0, 10);
    if (cleaned.length !== 10) {
      setError('Enter your 10-digit mobile number.');
      return;
    }
    if (!staffPassword) {
      setError('Enter your password.');
      return;
    }

    setStaffLoading(true);
    try {
      // 1. Pre-flight gate: blocks unverified / deactivated staff and resolves
      //    the internal login email for this phone.
      const res = await fetch('/api/auth/staff-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: cleaned }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Login is not allowed for this account.');
        setStaffLoading(false);
        return;
      }

      // 2. Gate passed — sign in with the resolved email + password (sets cookies).
      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: staffPassword,
      });
      if (signInError) {
        setError('Incorrect phone number or password.');
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl overflow-hidden shadow-lg shadow-fuchsia-500/25 mx-auto bg-white">
          <img src="/android-chrome-512x512.png" alt="Snip & Glow" className="h-full w-full object-cover" />
        </div>
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Welcome back
          </h1>
          <p className="text-sm text-slate-500">
            Sign in to <span className="font-semibold text-slate-700">snipand</span><span className="font-semibold bg-gradient-to-r from-pink-500 via-fuchsia-500 to-violet-500 bg-clip-text text-transparent">glow</span>
          </p>
        </div>
      </div>

      {/* Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xl shadow-slate-200/50 overflow-hidden">
        {/* Audience tabs */}
        <div className="grid grid-cols-2 gap-1 p-1.5 m-3 mb-0 rounded-xl bg-slate-100">
          <button
            onClick={() => switchTab('owner')}
            className={`flex items-center justify-center gap-2 h-10 rounded-lg text-sm font-semibold transition-all ${
              tab === 'owner'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <ShieldCheck className="h-4 w-4" />
            Salon Owner
          </button>
          <button
            onClick={() => switchTab('staff')}
            className={`flex items-center justify-center gap-2 h-10 rounded-lg text-sm font-semibold transition-all ${
              tab === 'staff'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Users className="h-4 w-4" />
            Staff
          </button>
        </div>

        <div className="p-6 sm:p-7 space-y-5">
          {/* ─── OWNER TAB ─── */}
          {tab === 'owner' && (
            <>
              <button
                onClick={handleGoogleSignIn}
                disabled={googleLoading}
                className="w-full flex items-center justify-center gap-3 min-h-[48px] h-12 rounded-xl border border-slate-200 bg-white text-slate-700 font-medium text-sm hover:border-slate-300 hover:bg-slate-50 transition-all shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
                {googleLoading ? 'Redirecting to Google...' : 'Continue with Google'}
              </button>

              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-slate-200" />
                <span className="text-xs text-slate-400 font-medium">OR</span>
                <div className="flex-1 h-px bg-slate-200" />
              </div>

              <form onSubmit={handleSendOtp} className="space-y-3">
                <div className="space-y-2">
                  <label htmlFor="phone" className="text-sm font-medium text-slate-700">
                    WhatsApp Number
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="flex items-center justify-center h-12 px-3 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-500 font-medium">
                      +91
                    </span>
                    <input
                      id="phone"
                      type="tel"
                      inputMode="numeric"
                      placeholder="10-digit mobile number"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                      className="flex-1 h-12 rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 transition-all"
                      disabled={phoneLoading}
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={phoneLoading || phone.length < 10}
                  className="w-full flex items-center justify-center gap-2 min-h-[48px] h-12 rounded-xl bg-emerald-600 text-white font-semibold text-sm hover:bg-emerald-700 transition-all shadow-sm shadow-emerald-600/20 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <MessageCircle className="h-4 w-4" />
                  {phoneLoading ? 'Sending code...' : 'Send code on WhatsApp'}
                </button>
                <p className="flex items-center justify-center gap-1.5 text-xs text-slate-400">
                  <Lock className="h-3 w-3" />
                  We'll send a 6-digit one-time code to your WhatsApp
                </p>
              </form>
            </>
          )}

          {/* ─── STAFF TAB ─── */}
          {tab === 'staff' && (
            <form onSubmit={handleStaffLogin} className="space-y-4">
              <div className="rounded-xl bg-violet-50 border border-violet-100 px-4 py-3">
                <p className="text-xs text-violet-700 leading-relaxed">
                  Use the mobile number and password your salon owner gave you.
                </p>
              </div>

              <div className="space-y-2">
                <label htmlFor="staff-phone" className="text-sm font-medium text-slate-700">
                  Mobile Number
                </label>
                <div className="flex items-center gap-2">
                  <span className="flex items-center justify-center h-12 px-3 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-500 font-medium">
                    +91
                  </span>
                  <input
                    id="staff-phone"
                    type="tel"
                    inputMode="numeric"
                    placeholder="Your 10-digit number"
                    value={staffPhone}
                    onChange={(e) => setStaffPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    className="flex-1 h-12 rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400 transition-all"
                    disabled={staffLoading}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="staff-password" className="text-sm font-medium text-slate-700">
                  Password
                </label>
                <input
                  id="staff-password"
                  type="password"
                  placeholder="Password from your salon owner"
                  value={staffPassword}
                  onChange={(e) => setStaffPassword(e.target.value)}
                  className="w-full h-12 rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400 transition-all"
                  disabled={staffLoading}
                />
              </div>

              <button
                type="submit"
                disabled={staffLoading || staffPhone.length !== 10 || !staffPassword}
                className="w-full flex items-center justify-center gap-2 min-h-[48px] h-12 rounded-xl bg-violet-600 text-white font-semibold text-sm hover:bg-violet-700 transition-all shadow-sm shadow-violet-600/20 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <Phone className="h-4 w-4" />
                {staffLoading ? 'Signing in...' : 'Sign in'}
              </button>

              <p className="flex items-center justify-center gap-1.5 text-xs text-slate-400">
                <Lock className="h-3 w-3" />
                Forgot your password? Ask your salon owner to reset it.
              </p>
            </form>
          )}

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-center">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="text-center space-y-3">
        {tab === 'owner' ? (
          <p className="text-sm text-slate-500">
            New to SnipandGlow?{' '}
            <a href="/signup" className="text-emerald-600 font-semibold hover:underline">
              Create your salon account
            </a>
          </p>
        ) : (
          <p className="text-sm text-slate-500">
            Don&apos;t have access yet? Ask your salon owner to add you.
          </p>
        )}
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
