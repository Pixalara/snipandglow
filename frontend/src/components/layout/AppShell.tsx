import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '@/services/firebase';
import { useAuthStore } from '@/store/authStore';
import { useResponsive } from '@/hooks/useResponsive';
import { useScrollToTop } from '@/hooks/useScrollToTop';
import { logActivity } from '@/services/audit.service';
import Sidebar from './Sidebar';
import PageTransition from './PageTransition';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import BranchSwitcher from '@/components/ui/BranchSwitcher';

interface AppShellProps {
  children: React.ReactNode;
}

export default function AppShell({ children }: AppShellProps) {
  const { user, gym } = useAuthStore();
  const navigate = useNavigate();
  const { isMobile, isTablet } = useResponsive();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false);
  useScrollToTop();

  const handleLogout = async () => {
    try {
      await logActivity('LOGOUT', `Signed out of ${gym?.name || 'Snip & Glow'}`);
      await signOut(auth);
      window.location.href = '/'; 
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  if (!user) return null;

  const sidebarWidth = isTablet ? '220px' : '250px';

  return (
    <div style={{
      display: 'flex',
      flexDirection: isMobile ? 'column' : 'row',
      minHeight: '100vh',
      backgroundColor: 'var(--pf-bg)',
      fontFamily: "'Inter', -apple-system, sans-serif",
      transition: 'background-color 300ms ease',
    }}>
      
      {/* MOBILE TOP BAR */}
      {isMobile && (
        <div style={{
          height: '56px',
          padding: '0 16px',
          backgroundColor: 'var(--pf-topbar-bg)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderBottom: '1px solid var(--pf-border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          position: 'sticky',
          top: 0,
          zIndex: 90,
        }}>
          <div 
            onClick={() => navigate('/')}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
          >
            <img src="/pingflow-logo.svg" alt="Snip & Glow" style={{ width: '28px', height: '28px', borderRadius: '8px' }} />
            <span style={{ fontFamily: "'Outfit', sans-serif", fontWeight: '800', fontSize: '18px', color: 'var(--pf-text)', letterSpacing: '-0.02em' }}>Snip & Glow</span>
          </div>

          <button 
            onClick={() => setIsSidebarOpen(true)}
            className="btn-press"
            style={{
              padding: '7px',
              backgroundColor: 'var(--pf-surface-2)',
              border: '1px solid var(--pf-border)',
              borderRadius: '8px',
              cursor: 'pointer',
              color: 'var(--pf-text-secondary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
        </div>
      )}

      {/* BACKDROP (Mobile) */}
      {isMobile && isSidebarOpen && (
        <div 
          onClick={() => setIsSidebarOpen(false)}
          style={{
            position: 'fixed', inset: 0,
            backgroundColor: 'var(--pf-modal-overlay)',
            backdropFilter: 'blur(4px)',
            WebkitBackdropFilter: 'blur(4px)',
            zIndex: 110,
            animation: 'fadeIn 200ms ease',
          }}
        />
      )}

      <Sidebar 
        isMobile={isMobile}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        onLogout={() => setIsLogoutConfirmOpen(true)}
        sidebarWidth={sidebarWidth}
      />

      <ConfirmDialog
        isOpen={isLogoutConfirmOpen}
        onClose={() => setIsLogoutConfirmOpen(false)}
        onConfirm={handleLogout}
        title="See you soon!"
        message="Your salon's progress is saved and waiting for your return. Are you sure you want to sign out?"
        confirmLabel="Sign Out Safely"
        variant="primary"
      />

      {/* Main Content */}
      <main className="content-area" style={{
        flex: 1,
        padding: isMobile ? '20px 16px' : (isTablet ? '24px 20px' : '28px 32px'),
        backgroundColor: 'var(--pf-bg)',
        minHeight: isMobile ? 'calc(100vh - 56px)' : '100vh',
        overflowX: 'hidden',
      }}>
        <div style={{ maxWidth: isMobile ? '100%' : '1320px', margin: '0 auto' }}>
          {/* Branch switcher — shown only for multi-branch gyms */}
          <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'flex-end' }}>
            <BranchSwitcher />
          </div>
          <PageTransition>
            {children}
          </PageTransition>
        </div>
      </main>
    </div>
  );
}
