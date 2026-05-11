'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card';

const OTP_EXPIRY_SECONDS = 5 * 60; // 5 minutes

function maskPhone(phone: string): string {
  // Mask middle digits: +91 98***43210
  if (phone.length < 10) return phone;
  const cleaned = phone.replace(/^\+91\s?/, '');
  if (cleaned.length !== 10) return phone;
  return `+91 ${cleaned.slice(0, 2)}***${cleaned.slice(5)}`;
}

export default function VerifyOtpPage() {
  return (
    <Suspense
      fallback={
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground">Loading...</p>
          </CardContent>
        </Card>
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
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/send-whatsapp-otp`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone }),
        }
      );

      if (!response.ok) {
        const data = await response.json();
        setError(data.error || 'Failed to resend OTP.');
        return;
      }

      // Reset timer
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
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/verify-whatsapp-otp`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone, code: otp }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Invalid or expired OTP. Please try again.');
        return;
      }

      // On success, redirect based on whether user has a tenant
      if (data.tenant_id) {
        router.push('/');
      } else {
        router.push('/onboarding');
      }
    } catch {
      setError('Network error. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }

  // Redirect back to login if no phone provided
  if (!phone) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-muted-foreground">No phone number provided.</p>
          <Button
            variant="link"
            className="mt-2"
            onClick={() => router.push('/login')}
          >
            Go back to login
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-xl">Verify your phone</CardTitle>
        <CardDescription>
          Enter the 6-digit code sent to your WhatsApp
        </CardDescription>
        <p className="mt-1 text-sm font-medium text-foreground">
          {maskPhone(phone)}
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        <form onSubmit={handleVerifyOtp} className="space-y-4">
          <div className="space-y-2">
            <label
              htmlFor="otp"
              className="text-sm font-medium leading-none"
            >
              Verification code
            </label>
            <Input
              id="otp"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              placeholder="000000"
              value={otp}
              onChange={(e) => {
                const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                setOtp(value);
              }}
              disabled={loading}
              className="text-center text-lg tracking-[0.5em]"
              autoComplete="one-time-code"
              aria-describedby={error ? 'otp-error' : 'otp-timer'}
            />
          </div>

          <Button
            type="submit"
            size="lg"
            className="w-full"
            disabled={loading || otp.length !== 6}
          >
            {loading ? 'Verifying...' : 'Verify'}
          </Button>
        </form>

        {/* Timer and resend */}
        <div id="otp-timer" className="text-center text-sm text-muted-foreground">
          {secondsLeft > 0 ? (
            <p>Code expires in {formatTime(secondsLeft)}</p>
          ) : (
            <button
              type="button"
              onClick={handleResendOtp}
              disabled={resending}
              className="font-medium text-primary hover:underline disabled:opacity-50"
            >
              {resending ? 'Resending...' : 'Resend OTP'}
            </button>
          )}
        </div>

        {/* Error message */}
        {error && (
          <p
            id="otp-error"
            className="text-center text-sm text-destructive"
            role="alert"
          >
            {error}
          </p>
        )}

        {/* Back to login */}
        <div className="text-center">
          <Button
            variant="link"
            className="text-sm text-muted-foreground"
            onClick={() => router.push('/login')}
          >
            ← Back to login
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
