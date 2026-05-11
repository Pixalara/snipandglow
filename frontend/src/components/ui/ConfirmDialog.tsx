import { useEffect } from 'react';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  isLoading?: boolean;
  variant?: 'danger' | 'warning' | 'primary';
}

export default function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  isLoading = false,
  variant = 'primary',
}: ConfirmDialogProps) {
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEsc);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const getVariantStyles = () => {
    switch (variant) {
      case 'danger': return {
        base: '#EF4444',
        shadow: 'rgba(239, 68, 68, 0.3)',
        gradient: 'linear-gradient(135deg, #EF4444 0%, #B91C1C 100%)'
      };
      case 'warning': return {
        base: '#F59E0B',
        shadow: 'rgba(245, 158, 11, 0.3)',
        gradient: 'linear-gradient(135deg, #F59E0B 0%, #B45309 100%)'
      };
      default: return {
        base: '#E11D48',
        shadow: 'rgba(225, 29, 72, 0.3)',
        gradient: 'linear-gradient(135deg, #E11D48 0%, #9F1239 100%)'
      };
    }
  };

  const styles = getVariantStyles();

  const getIcon = () => {
    if (variant === 'danger') return '⚠️';
    if (variant === 'warning') return '🔔';
    return (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
        <polyline points="16 17 21 12 16 7" />
        <line x1="21" y1="12" x2="9" y2="12" />
      </svg>
    );
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.3)',
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      padding: '24px',
      animation: 'backdropIn 400ms ease-out',
    }}
    onClick={(e) => {
      if (e.target === e.currentTarget) onClose();
    }}>

      {/* Dialog Card */}
      <div style={{
        backgroundColor: '#FFFFFF',
        borderRadius: '32px',
        width: '100%',
        maxWidth: '440px',
        boxShadow: '0 40px 100px -20px rgba(0, 0, 0, 0.2), 0 0 0 1px rgba(0,0,0,0.03)',
        animation: 'modalIn 500ms cubic-bezier(0.34, 1.56, 0.64, 1)',
        position: 'relative',
        padding: '64px 40px 40px',
        textAlign: 'center',
        overflow: 'visible',
        border: '1px solid rgba(255,255,255,0.8)',
      }}
      onClick={e => e.stopPropagation()}>
        
        {/* Floating Icon Badge with Glow - Center Aligned */}
        <div style={{
          position: 'absolute',
          top: '-40px',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '80px',
          height: '80px',
          borderRadius: '24px',
          background: styles.gradient,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: `0 20px 40px -10px ${styles.shadow}`,
          zIndex: 10,
        }}>
          {getIcon()}
          {/* Internal Shine */}
          <div style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '24px',
            border: '2px solid rgba(255,255,255,0.2)',
          }} />
        </div>

        <div style={{ marginBottom: '32px' }}>
          <h3 style={{
            fontFamily: "'Outfit', sans-serif",
            fontSize: '28px',
            fontWeight: '900',
            color: '#0F172A',
            marginBottom: '12px',
            letterSpacing: '-0.02em',
            lineHeight: '1.2',
          }}>{title}</h3>
          
          <p style={{
            fontSize: '16px',
            color: '#64748B',
            lineHeight: '1.6',
            fontFamily: "'Inter', sans-serif",
            fontWeight: '500',
            maxWidth: '320px',
            margin: '0 auto',
          }}>{message}</p>
        </div>

        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          width: '100%',
        }}>
          <button 
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            style={{
              height: '56px',
              borderRadius: '18px',
              border: 'none',
              background: styles.gradient,
              color: '#FFFFFF',
              cursor: 'pointer',
              fontSize: '16px',
              fontWeight: '800',
              fontFamily: "'Outfit', sans-serif",
              boxShadow: `0 12px 24px -6px ${styles.shadow}`,
              opacity: isLoading ? 0.7 : 1,
              transition: 'all 300ms cubic-bezier(0.4, 0, 0.2, 1)',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.transform = 'translateY(-2px) scale(1.02)';
              e.currentTarget.style.boxShadow = `0 20px 32px -8px ${styles.shadow}`;
            }}
            onMouseLeave={e => {
              e.currentTarget.style.transform = 'translateY(0) scale(1)';
              e.currentTarget.style.boxShadow = `0 12px 24px -6px ${styles.shadow}`;
            }}
          >
            {isLoading ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                <div className="spinner" style={{ width: '20px', height: '20px', border: '3px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                Signing out...
              </div>
            ) : confirmLabel}
          </button>

          <button 
            type="button"
            onClick={onClose}
            disabled={isLoading}
            style={{
              height: '56px',
              borderRadius: '18px',
              border: '1px solid #E5E7EB',
              backgroundColor: '#FFFFFF',
              color: '#94A3B8',
              cursor: 'pointer',
              fontSize: '15px',
              fontWeight: '700',
              fontFamily: "'Inter', sans-serif",
              transition: 'all 200ms ease',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.backgroundColor = '#F8FAFC';
              e.currentTarget.style.color = '#111827';
              e.currentTarget.style.borderColor = '#D1D5DB';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.backgroundColor = '#FFFFFF';
              e.currentTarget.style.color = '#94A3B8';
              e.currentTarget.style.borderColor = '#E5E7EB';
            }}
          >Cancel and stay</button>
        </div>
      </div>
    </div>
  );
}

