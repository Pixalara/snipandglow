// PingFlow — UPI Payment Redirect Page
// Public page linked from WhatsApp "Renew Online" button.
// Attempts UPI deep link first, falls back to a branded payment info page.

import { useEffect, useState } from 'react';

const UPI_ID = 'adileepkumar123@oksbi';
const UPI_NAME = 'Dileep Kumar';
const UPI_INTENT = `upi://pay?pa=${UPI_ID}&pn=${encodeURIComponent(UPI_NAME)}&cu=INR`;

export default function PayPage() {
  const [showFallback, setShowFallback] = useState(false);

  useEffect(() => {
    // Try to open UPI intent immediately
    window.location.href = UPI_INTENT;

    // If still on this page after 1.5s, the device doesn't have a UPI app — show fallback
    const timer = setTimeout(() => setShowFallback(true), 1500);
    return () => clearTimeout(timer);
  }, []);

  if (!showFallback) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FAFBFC',
        fontFamily: "'Inter', sans-serif",
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '48px', height: '48px', border: '3px solid #E2E8F0',
            borderTopColor: '#E11D48', borderRadius: '50%',
            animation: 'spin 0.8s linear infinite', margin: '0 auto 16px',
          }} />
          <p style={{ color: '#64748B', fontSize: '14px', fontWeight: '600' }}>Opening payment app...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#FAFBFC',
      fontFamily: "'Inter', sans-serif",
      padding: '24px',
    }}>
      <div style={{
        maxWidth: '400px',
        width: '100%',
        backgroundColor: '#FFFFFF',
        borderRadius: '24px',
        border: '1px solid #E2E8F0',
        padding: '40px 32px',
        textAlign: 'center',
        boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
      }}>
        {/* Logo */}
        <div style={{
          width: '56px', height: '56px',
          borderRadius: '16px',
          margin: '0 auto 24px',
          boxShadow: '0 8px 20px rgba(5,8,16,0.25)',
          overflow: 'hidden',
        }}>
          <img src="/pingflow-logo.svg" alt="PingFlow" style={{ width: '100%', height: '100%' }} />
        </div>

        <h1 style={{
          fontFamily: "'Outfit', sans-serif",
          fontSize: '22px', fontWeight: '800',
          color: '#0F172A', margin: '0 0 8px',
          letterSpacing: '-0.02em',
        }}>
          Renew Your Membership
        </h1>

        <p style={{
          fontSize: '14px', color: '#64748B',
          margin: '0 0 32px', lineHeight: '1.6', fontWeight: '500',
        }}>
          Pay using any UPI app to renew your salon membership instantly.
        </p>

        {/* UPI ID Display */}
        <div style={{
          backgroundColor: '#F8FAFC',
          border: '1px solid #E2E8F0',
          borderRadius: '14px',
          padding: '16px',
          marginBottom: '24px',
        }}>
          <p style={{
            fontSize: '11px', fontWeight: '800', color: '#94A3B8',
            textTransform: 'uppercase', letterSpacing: '0.08em',
            margin: '0 0 6px',
          }}>
            UPI ID
          </p>
          <p style={{
            fontSize: '16px', fontWeight: '700', color: '#0F172A',
            margin: 0, fontFamily: "'JetBrains Mono', monospace",
            letterSpacing: '0.02em',
          }}>
            {UPI_ID}
          </p>
          <p style={{
            fontSize: '12px', color: '#64748B', margin: '4px 0 0',
            fontWeight: '600',
          }}>
            {UPI_NAME}
          </p>
        </div>

        {/* Pay Now Button */}
        <a
          href={UPI_INTENT}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            width: '100%',
            height: '52px',
            background: 'linear-gradient(135deg, #E11D48 0%, #BE123C 100%)',
            color: '#FFFFFF',
            border: 'none',
            borderRadius: '14px',
            fontSize: '15px',
            fontWeight: '800',
            textDecoration: 'none',
            boxShadow: '0 8px 20px rgba(225,29,72,0.25)',
          }}
        >
          Pay with UPI
        </a>

        <p style={{
          fontSize: '11px', color: '#94A3B8',
          margin: '20px 0 0', fontWeight: '500',
        }}>
          Powered by PingFlow
        </p>
      </div>
    </div>
  );
}
