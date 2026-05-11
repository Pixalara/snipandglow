// PingFlow — WhatsApp Connect Card
// Dashboard card for connecting a gym's own WhatsApp Business number via Meta Embedded Signup

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRole } from '@/hooks/useRole';
import { useAuthStore } from '@/store/authStore';
import { useResponsive } from '@/hooks/useResponsive';
import { connectWhatsApp, getWhatsAppStatus, disconnectWhatsApp } from '@/services/whatsapp.service';
import { toast } from '@/components/ui/Toast';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import type { WhatsAppConnectionStatus } from '@/types';

const META_APP_ID = import.meta.env.VITE_META_APP_ID || '';
const META_CONFIG_ID = import.meta.env.VITE_META_CONFIG_ID || '';

// Extend window for Meta JS SDK
declare global {
  interface Window {
    FB?: {
      init: (params: { appId: string; cookie?: boolean; xfbml?: boolean; version: string }) => void;
      login: (
        callback: (response: { authResponse?: { code?: string } }) => void,
        options: { config_id: string; response_type: string; override_default_response_type: boolean }
      ) => void;
    };
    fbAsyncInit?: () => void;
  }
}

export default function WhatsAppConnectCard() {
  const { isAdmin } = useRole();
  const user = useAuthStore((s) => s.user);
  const gymId = useAuthStore((s) => s.gymId) || user?.uid;
  const { isMobile } = useResponsive();

  const [status, setStatus] = useState<WhatsAppConnectionStatus>('not_connected');
  const [phoneNumber, setPhoneNumber] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [sdkLoaded, setSdkLoaded] = useState(false);
  const [sdkError, setSdkError] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);

  // Don't render for non-admin users
  if (!isAdmin) return null;

  // Load initial status
  useEffect(() => {
    if (!gymId) return;
    getWhatsAppStatus(gymId).then((data) => {
      if (!mountedRef.current) return;
      setStatus(data.status);
      setPhoneNumber(data.phoneNumber);
      setDisplayName(data.displayName);
    });
  }, [gymId]);

  // Load Meta JS SDK dynamically
  useEffect(() => {
    // Skip if already loaded
    if (window.FB) {
      setSdkLoaded(true);
      return;
    }

    // Skip if no app ID configured
    if (!META_APP_ID) {
      setSdkError(true);
      return;
    }

    window.fbAsyncInit = () => {
      window.FB?.init({
        appId: META_APP_ID,
        cookie: true,
        xfbml: false,
        version: 'v21.0',
      });
      if (mountedRef.current) setSdkLoaded(true);
    };

    // Load the SDK script
    if (!document.getElementById('facebook-jssdk')) {
      const script = document.createElement('script');
      script.id = 'facebook-jssdk';
      script.src = 'https://connect.facebook.net/en_US/sdk.js';
      script.async = true;
      script.defer = true;
      script.onerror = () => {
        if (mountedRef.current) setSdkError(true);
      };
      document.body.appendChild(script);
    }

    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  // Poll for status when pending
  useEffect(() => {
    if (status !== 'pending' || !gymId) return;

    pollRef.current = setInterval(async () => {
      try {
        const data = await getWhatsAppStatus(gymId);
        if (!mountedRef.current) return;
        if (data.status !== 'pending') {
          setStatus(data.status);
          setPhoneNumber(data.phoneNumber);
          setDisplayName(data.displayName);
          if (pollRef.current) clearInterval(pollRef.current);
        }
      } catch {
        // Retry on next interval
      }
    }, 3000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [status, gymId]);

  const handleConnect = useCallback(() => {
    if (!window.FB || !gymId) return;

    window.FB.login(
      (response) => {
        const code = response?.authResponse?.code;
        if (!code) {
          // Popup closed without completing — stay in not_connected, no error
          return;
        }

        setStatus('pending');

        connectWhatsApp(gymId, code)
          .then((result) => {
            if (!mountedRef.current) return;
            if (!result.success) {
              setStatus('not_connected');
              toast(result.error || 'Failed to connect WhatsApp', 'error');
            }
            // If success, polling will pick up the live status
          })
          .catch(() => {
            if (!mountedRef.current) return;
            setStatus('not_connected');
            toast('Failed to connect WhatsApp', 'error');
          });
      },
      {
        config_id: META_CONFIG_ID,
        response_type: 'code',
        override_default_response_type: true,
      }
    );
  }, [gymId]);

  const handleDisconnect = useCallback(async () => {
    if (!gymId) return;
    setIsDisconnecting(true);
    setShowDisconnectConfirm(false);

    try {
      const result = await disconnectWhatsApp(gymId);
      if (!mountedRef.current) return;
      if (result.success) {
        setStatus('not_connected');
        setPhoneNumber(null);
        setDisplayName(null);
        toast('WhatsApp disconnected', 'success');
      } else {
        toast(result.error || 'Failed to disconnect', 'error');
      }
    } catch {
      if (mountedRef.current) toast('Failed to disconnect WhatsApp', 'error');
    } finally {
      if (mountedRef.current) setIsDisconnecting(false);
    }
  }, [gymId]);

  // ─── Render states ────────────────────────────────────────────────────────

  const renderNotConnected = () => (
    <>
      <div style={{ marginBottom: '16px' }}>
        <p style={{ fontSize: '13px', color: '#64748B', margin: '0 0 12px', lineHeight: 1.5 }}>
          Connect your own WhatsApp Business number for:
        </p>
        <ul style={{ margin: 0, paddingLeft: '18px', listStyle: 'none' }}>
          {[
            { icon: '📱', text: 'Messages from your own number' },
            { icon: '🚀', text: 'Direct delivery via Meta Cloud API' },
            { icon: '📊', text: 'Real-time delivery status tracking' },
          ].map((item) => (
            <li key={item.text} style={{
              fontSize: '13px', color: '#334155', marginBottom: '8px',
              display: 'flex', alignItems: 'center', gap: '8px',
            }}>
              <span>{item.icon}</span> {item.text}
            </li>
          ))}
        </ul>
      </div>
      <button
        onClick={handleConnect}
        disabled={!sdkLoaded || sdkError}
        title={sdkError ? 'Unable to load Meta SDK' : (!sdkLoaded ? 'Loading Meta SDK...' : '')}
        className="btn-press"
        style={{
          width: '100%',
          padding: '12px 16px',
          borderRadius: '12px',
          background: (!sdkLoaded || sdkError)
            ? '#E2E8F0'
            : 'linear-gradient(135deg, #25D366, #128C7E)',
          color: (!sdkLoaded || sdkError) ? '#94A3B8' : '#FFFFFF',
          border: 'none',
          cursor: (!sdkLoaded || sdkError) ? 'not-allowed' : 'pointer',
          fontSize: '14px',
          fontWeight: '700',
          fontFamily: "'Outfit', sans-serif",
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          boxShadow: (!sdkLoaded || sdkError) ? 'none' : '0 4px 12px rgba(37,211,102,0.3)',
          transition: 'all 200ms',
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
        </svg>
        Connect WhatsApp
      </button>
      <p style={{
        fontSize: '11px', color: '#94A3B8', textAlign: 'center',
        margin: '10px 0 0', lineHeight: 1.4,
      }}>
        Or continue using the default PingFlow number
      </p>
    </>
  );

  const renderPending = () => (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: '24px 0',
    }}>
      <div
        className="spinner"
        style={{
          width: '36px', height: '36px',
          border: '3px solid #E2E8F0',
          borderTopColor: '#25D366',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
          marginBottom: '14px',
        }}
      />
      <p style={{
        fontSize: '14px', fontWeight: '600', color: '#334155', margin: '0 0 4px',
        fontFamily: "'Outfit', sans-serif",
      }}>
        Connecting...
      </p>
      <p style={{ fontSize: '12px', color: '#94A3B8', margin: 0 }}>
        Setting up your WhatsApp Business number
      </p>
    </div>
  );

  const renderLive = () => (
    <>
      <div style={{
        display: 'flex', alignItems: 'center', gap: '12px',
        padding: '14px', borderRadius: '12px',
        backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0',
        marginBottom: '14px',
      }}>
        <div style={{
          width: '40px', height: '40px', borderRadius: '12px',
          background: 'linear-gradient(135deg, #25D366, #128C7E)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <div style={{ minWidth: 0 }}>
          <p style={{
            fontSize: '14px', fontWeight: '700', color: '#166534', margin: '0 0 2px',
            fontFamily: "'Outfit', sans-serif",
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {displayName || 'Connected'}
          </p>
          <p style={{
            fontSize: '12px', color: '#15803D', margin: 0, fontWeight: '500',
          }}>
            {phoneNumber || 'WhatsApp Business'}
          </p>
        </div>
      </div>
      <button
        onClick={() => setShowDisconnectConfirm(true)}
        disabled={isDisconnecting}
        style={{
          width: '100%',
          padding: '10px 16px',
          borderRadius: '10px',
          backgroundColor: '#FFFFFF',
          color: '#EF4444',
          border: '1px solid #FECACA',
          cursor: isDisconnecting ? 'not-allowed' : 'pointer',
          fontSize: '13px',
          fontWeight: '600',
          fontFamily: "'Outfit', sans-serif",
          opacity: isDisconnecting ? 0.6 : 1,
          transition: 'all 200ms',
        }}
      >
        {isDisconnecting ? 'Disconnecting...' : 'Disconnect'}
      </button>
    </>
  );

  return (
    <>
      <div
        className="card-hover"
        style={{
          background: '#FFFFFF',
          border: '1px solid #E2E8F0',
          borderRadius: '14px',
          padding: isMobile ? '16px' : '20px',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Top accent */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: '3px',
          background: status === 'live'
            ? 'linear-gradient(90deg, #25D366, transparent)'
            : 'linear-gradient(90deg, #25D366, #128C7E)',
          opacity: 0.6,
        }} />

        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: '14px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              width: '34px', height: '34px', borderRadius: '10px',
              backgroundColor: 'rgba(37,211,102,0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '16px',
            }}>
              💬
            </div>
            <span style={{
              fontFamily: "'Outfit', sans-serif",
              fontSize: '14px', fontWeight: '700', color: '#0F172A',
            }}>
              WhatsApp Connect
            </span>
          </div>
          {status === 'live' && (
            <span style={{
              fontSize: '10px', fontWeight: '700',
              color: '#166534', backgroundColor: '#DCFCE7',
              padding: '2px 8px', borderRadius: '6px',
            }}>
              LIVE
            </span>
          )}
        </div>

        {/* Body */}
        {status === 'not_connected' && renderNotConnected()}
        {status === 'pending' && renderPending()}
        {status === 'live' && renderLive()}
      </div>

      {/* Disconnect confirmation dialog */}
      <ConfirmDialog
        isOpen={showDisconnectConfirm}
        onClose={() => setShowDisconnectConfirm(false)}
        onConfirm={handleDisconnect}
        title="Disconnect WhatsApp?"
        message="Messages will be sent from the default PingFlow number until you reconnect."
        confirmLabel="Disconnect"
        variant="danger"
        isLoading={isDisconnecting}
      />
    </>
  );
}
