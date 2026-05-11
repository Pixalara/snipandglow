import { useEffect } from 'react';

interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
}

export default function Drawer({ isOpen, onClose, title, description, children }: DrawerProps) {
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

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.4)',
      backdropFilter: 'blur(8px)',
      WebkitBackdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '20px',
      animation: 'backdropIn 300ms ease-out',
    }}
    onClick={(e) => {
      if (e.target === e.currentTarget) onClose();
    }}>

    {/* Modal card */}
      <div style={{
        backgroundColor: '#FFFFFF',
        border: '1px solid #E5E7EB',
        borderRadius: '24px',
        width: '100%',
        maxWidth: '480px',
        boxShadow: '0 20px 40px rgba(0,0,0,0.1), 0 0 0 1px rgba(0,0,0,0.05)',
        animation: 'modalIn 250ms cubic-bezier(0.4, 0, 0.2, 1)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
      onClick={e => e.stopPropagation()}>
        
        {/* Modal Header */}
        <div style={{
          padding: '24px 32px',
          borderBottom: '1px solid #F1F5F9',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div>
            <h2 style={{
              fontFamily: "'Outfit', sans-serif",
              fontSize: '20px', fontWeight: '700',
              color: '#111827', margin: 0,
            }}>{title}</h2>
            <p style={{
              fontSize: '13px', color: '#64748B',
              margin: '4px 0 0',
            }}>{description || 'Fill in the details below'}</p>
          </div>
          <button
            onClick={onClose}
            style={{
              width: '32px', height: '32px',
              borderRadius: '10px',
              backgroundColor: '#F8FAFC',
              border: '1px solid #E5E7EB', cursor: 'pointer',
              color: '#64748B', fontSize: '14px',
              display: 'flex', alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 150ms',
            }}
          >✕</button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '32px', overflowY: 'auto', maxHeight: 'calc(90vh - 120px)' }}>
          {children}
        </div>
      </div>
    </div>
  );
}
