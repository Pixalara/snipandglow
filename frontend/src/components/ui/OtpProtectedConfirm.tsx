// PingFlow — OTP-Protected Confirm Dialog
// Requires WhatsApp OTP verification before executing destructive actions

import { useState, useRef, useEffect } from 'react';
import Modal from '@/components/ui/Modal';
import { PrimaryButton, GhostButton } from '@/components/ui/ModalButtons';
import { toast } from '@/components/ui/Toast';
import { useAuthStore } from '@/store/authStore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import app from '@/services/firebase';

interface OtpProtectedConfirmProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  title: string;
  message: string;
  confirmLabel?: string;
  variant?: 'danger' | 'warning';
}

type Step = 'confirm' | 'otp';

export default function OtpProtectedConfirm({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  variant = 'danger',
}: OtpProtectedConfirmProps) {
  const { gym } = useAuthStore();
  const [step, setStep] = useState<Step>('confirm');
  const [verificationId, setVerificationId] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [isSending, setIsSending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [phoneLast4, setPhoneLast4] = useState('');
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Reset state when dialog closes
  useEffect(() => {
    if (!isOpen) {
      setStep('confirm');
      setVerificationId('');
      setOtp(['', '', '', '', '', '']);
      setPhoneLast4('');
    }
  }, [isOpen]);

  // Auto-focus first OTP input
  useEffect(() => {
    if (step === 'otp') {
      setTimeout(() => inputRefs.current[0]?.focus(), 100);
    }
  }, [step]);

  const handleSendOtp = async () => {
    if (!gym?.phone) {
      toast('Admin phone number not found. Update it in Settings.', 'error');
      return;
    }
    setIsSending(true);
    try {
      const functions = getFunctions(app, 'asia-south1');
      const sendOtp = httpsCallable(functions, 'sendWhatsAppOnlyOTP');
      const result = await sendOtp({ phone: gym.phone });
      const data = result.data as { success: boolean; verificationId: string; phoneLast4: string };
      if (data.success) {
        setVerificationId(data.verificationId);
        setPhoneLast4(data.phoneLast4);
        setStep('otp');
        toast('OTP sent to your WhatsApp', 'success');
      } else {
        toast('Failed to send OTP', 'error');
      }
    } catch (err: any) {
      toast(err.message || 'Failed to send OTP', 'error');
    } finally {
      setIsSending(false);
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value.slice(-1);
    setOtp(newOtp);
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 6) {
      setOtp(pasted.split(''));
      inputRefs.current[5]?.focus();
    }
  };

  const handleVerifyAndExecute = async () => {
    const code = otp.join('');
    if (code.length !== 6) {
      toast('Enter the 6-digit code', 'error');
      return;
    }
    setIsVerifying(true);
    try {
      const functions = getFunctions(app, 'asia-south1');
      const confirmOtp = httpsCallable(functions, 'confirmWhatsAppOTP');
      const result = await confirmOtp({ verificationId, code });
      const data = result.data as { success: boolean };
      if (data.success) {
        await onConfirm();
        onClose();
      } else {
        toast('Invalid OTP', 'error');
      }
    } catch (err: any) {
      const msg = err.message || 'Verification failed';
      toast(msg.includes('Invalid code') ? msg : 'Verification failed. Try again.', 'error');
    } finally {
      setIsVerifying(false);
    }
  };

  const variantBg = variant === 'danger' ? '#FEF2F2' : '#FFFBEB';
  const variantBorder = variant === 'danger' ? '#FECDD3' : '#FDE68A';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={step === 'confirm' ? title : '🔐 WhatsApp Verification'}
      subtitle={step === 'confirm' ? undefined : `Enter the 6-digit code sent to ****${phoneLast4}`}
      maxWidth="420px"
      footer={
        step === 'confirm' ? (
          <>
            <GhostButton onClick={onClose}>Cancel</GhostButton>
            <PrimaryButton onClick={handleSendOtp} loading={isSending}>
              {isSending ? 'Sending OTP...' : confirmLabel}
            </PrimaryButton>
          </>
        ) : (
          <>
            <GhostButton onClick={() => setStep('confirm')}>Back</GhostButton>
            <PrimaryButton onClick={handleVerifyAndExecute} loading={isVerifying}>
              {isVerifying ? 'Verifying...' : 'Verify & Confirm'}
            </PrimaryButton>
          </>
        )
      }
    >
      {step === 'confirm' ? (
        <div>
          <div style={{
            padding: '16px', backgroundColor: variantBg,
            border: `1px solid ${variantBorder}`,
            borderRadius: '14px', marginBottom: '16px',
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
              <span style={{ fontSize: '20px', flexShrink: 0 }}>⚠️</span>
              <div>
                <p style={{ fontSize: '14px', fontWeight: '700', color: '#0F172A', margin: '0 0 4px' }}>This action requires verification</p>
                <p style={{ fontSize: '13px', color: '#64748B', margin: 0, lineHeight: '1.5' }}>{message}</p>
              </div>
            </div>
          </div>
          <div style={{
            padding: '12px 16px', backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0',
            borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '10px',
          }}>
            <span style={{ fontSize: '16px' }}>📱</span>
            <p style={{ fontSize: '12px', color: '#166534', fontWeight: '600', margin: 0 }}>
              A 6-digit OTP will be sent to the admin's WhatsApp ({gym?.phone ? `****${gym.phone.slice(-4)}` : 'not set'}) for verification.
            </p>
          </div>
        </div>
      ) : (
        <div>
          {/* OTP Input Boxes */}
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', margin: '20px 0 24px' }}>
            {otp.map((digit, i) => (
              <input
                key={i}
                ref={el => { inputRefs.current[i] = el; }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={e => handleOtpChange(i, e.target.value)}
                onKeyDown={e => handleOtpKeyDown(i, e)}
                onPaste={i === 0 ? handleOtpPaste : undefined}
                style={{
                  width: '48px', height: '56px', textAlign: 'center',
                  fontSize: '22px', fontWeight: '900', fontFamily: "'JetBrains Mono', monospace",
                  border: `2px solid ${digit ? '#E11D48' : '#E2E8F0'}`,
                  borderRadius: '14px', outline: 'none', color: '#0F172A',
                  backgroundColor: digit ? '#FFF1F2' : '#FFF',
                  transition: 'all 150ms',
                }}
                onFocus={e => { e.currentTarget.style.borderColor = '#E11D48'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(225,29,72,0.1)'; }}
                onBlur={e => { e.currentTarget.style.borderColor = digit ? '#E11D48' : '#E2E8F0'; e.currentTarget.style.boxShadow = 'none'; }}
              />
            ))}
          </div>
          <p style={{ textAlign: 'center', fontSize: '12px', color: '#94A3B8', margin: 0 }}>
            Didn't receive the code?{' '}
            <button onClick={handleSendOtp} disabled={isSending} style={{ background: 'none', border: 'none', color: '#E11D48', fontWeight: '700', cursor: 'pointer', fontSize: '12px', padding: 0 }}>
              {isSending ? 'Sending...' : 'Resend'}
            </button>
          </p>
        </div>
      )}
    </Modal>
  );
}
