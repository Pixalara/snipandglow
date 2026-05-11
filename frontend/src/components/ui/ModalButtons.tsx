import React from 'react';

interface ButtonProps {
  onClick?: (e?: any) => void | Promise<void>;
  children: React.ReactNode;
  type?: 'button' | 'submit';
  loading?: boolean;
  danger?: boolean;
  disabled?: boolean;
}

export const PrimaryButton: React.FC<ButtonProps> = ({
  onClick, children, type = 'button', loading, disabled
}) => (
  <button
    type={type}
    onClick={onClick}
    disabled={loading || disabled}
      style={{
        padding: '10px 24px',
        borderRadius: '10px',
        border: 'none',
        backgroundColor: loading || disabled ? '#F1F5F9' : '#E11D48',
        color: loading || disabled ? '#94A3B8' : '#FFFFFF',
        cursor: loading || disabled ? 'not-allowed' : 'pointer',
        fontSize: '14px',
        fontWeight: '700',
        fontFamily: "'Inter', sans-serif",
        boxShadow: loading || disabled 
          ? 'none' 
          : '0 4px 12px rgba(225,29,72,0.25)',
        transition: 'all 150ms ease',
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      whiteSpace: 'nowrap' as const,
    }}
  >
    {loading && (
      <div style={{
        width: '14px', height: '14px',
        border: '2px solid rgba(100,116,139,0.3)',
        borderTopColor: '#64748B',
        borderRadius: '50%',
        animation: 'spin 0.7s linear infinite',
      }}/>
    )}
    {loading ? 'Saving...' : children}
  </button>
);

export const GhostButton: React.FC<ButtonProps> = ({
  onClick, children, type = 'button'
}) => (
  <button
    type={type}
    onClick={onClick}
      style={{
        padding: '10px 20px',
        borderRadius: '10px',
        border: '1px solid #E5E7EB',
        backgroundColor: 'transparent',
        color: '#64748B',
        cursor: 'pointer',
        fontSize: '14px',
        fontWeight: '500',
        fontFamily: "'Inter', sans-serif",
        transition: 'all 150ms ease',
      }}
    onMouseEnter={(e: any) => {
      e.currentTarget.style.borderColor = '#D1D5DB';
      e.currentTarget.style.color = '#111827';
    }}
    onMouseLeave={(e: any) => {
      e.currentTarget.style.borderColor = '#E5E7EB';
      e.currentTarget.style.color = '#64748B';
    }}
  >
    {children}
  </button>
);

export const DangerButton: React.FC<ButtonProps> = ({
  onClick, children, loading
}) => (
  <button
    onClick={onClick}
    disabled={loading}
      style={{
        padding: '10px 24px',
        borderRadius: '10px',
        border: '1px solid #FECACA',
        backgroundColor: '#FFF1F2',
        color: '#E11D48',
        cursor: loading ? 'not-allowed' : 'pointer',
        fontSize: '14px',
        fontWeight: '600',
        fontFamily: "'Inter', sans-serif",
        transition: 'all 150ms ease',
      }}
  >
    {loading ? 'Deleting...' : children}
  </button>
);
