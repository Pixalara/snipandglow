'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { MessageCircle } from 'lucide-react';

const OTP_EXPIRY_SECONDS = 5 * 60; // 5 minutes

function maskPhone(phone: string): string {
  if (phone.length < 10) return phone;
  const cleaned = phone.replace(/^91/, '');
  if (cleaned.length !== 10) return `+${phone}`;
  return `+91 ${cleaned.slice(0, 2)}****${cleaned.slice(6)}`;
}

export default function VerifyOtpPage() {
  return (
    <Suspense
      fallback={
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xl p-8 text-center">
          <p className="text-slate-500">Loading...</p>
        </div>
      }
    >
      <VerifyOtpContent />
    </Suspense>
  );
}

function VerifyOtpContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const phone = searchParams.get('phone') || '';

  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(OTP_EXPIRY_SECONDS);
  const [resending, setResending] = useState(false);

  // Countdown timer
  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = setInterval(() => {
      setSecondsLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [secondsLeft]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const handleResendOtp = useCallback(async () => {
    if (secondsLeft > 0 || !phone) return;
    setResending(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Failed to resend OTP.');
        return;
      }

      setSecondsLeft(OTP_EXPIRY_SECONDS);
      setOtp('');
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setResending(false);
    }
  }, [secondsLeft, phone]);

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (otp.length !== 6) {
      setError('Please enter the full 6-digit code.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, code: otp }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Invalid or expired OTP.');
        setLoading(false);
        return;
      }

      // Redirect to the magic link which will sign the user in
      if (data.action_link) {
        window.location.href = data.action_link;
      } else {
        router.push(data.redirect || '/dashboard');
      }
    } catch {
      setError('Network error. Please try again.');
      setLoading(false);
    }
  }

  if (!phone) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xl p-8 text-center space-y-4">
        <p className="text-slate-500">No phone number provided.</p>
        <button
          onClick={() => router.push('/login')}
          className="text-sm text-emerald-600 hover:underline font-medium"
        >
          Go back to login
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-gradient-to-br from-emerald-100 to-green-100 border border-emerald-200 mx-auto mb-2">
          <MessageCircle className="h-6 w-6 text-emerald-600" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Verify your phone</h1>
        <p className="text-sm text-slate-500">Enter the 6-digit code sent to your WhatsApp</p>
        <p className="text-sm font-medium text-slate-700">{maskPhone(phone)}</p>
      </div>

      {/* Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xl shadow-slate-100/50 p-6 sm:p-8 space-y-6">
        <form onSubmit={handleVerifyOtp} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="otp" className="text-sm font-medium text-slate-700">
              Verification code
            </label>
            <input
              id="otp"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              placeholder="000000"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              disabled={loading}
              className="w-full h-12 rounded-xl border border-slate-200 bg-white px-4 text-center text-xl tracking-[0.5em] font-mono text-slate-900 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 transition-all"
              autoComplete="one-time-code"
              autoFocus
            />
          </div>

          <button
            type="submit"
            disabled={loading || otp.length !== 6}
            className="w-full flex items-center justify-center gap-2 min-h-[48px] h-12 rounded-xl bg-emerald-600 text-white font-medium text-sm hover:bg-emerald-700 transition-all shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? 'Verifying...' : 'Verify & Sign In'}
          </button>
        </form>

        {/* Timer and resend */}
        <div className="text-center text-sm text-slate-500">
          {secondsLeft > 0 ? (
            <p>Code expires in <span className="font-medium text-slate-700">{formatTime(secondsLeft)}</span></p>
          ) : (
            <button
              type="button"
              onClick={handleResendOtp}
              disabled={resending}
              className="font-medium text-emerald-600 hover:underline disabled:opacity-50"
            >
              {resending ? 'Resending...' : 'Resend OTP'}
            </button>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-center">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {/* Back */}
        <div className="text-center">
          <button
            onClick={() => router.push('/login')}
            className="text-sm text-slate-500 hover:text-slate-700 transition-colors"
          >
            ← Back to login
          </button>
        </div>
      </div>
    </div>
  );
}
