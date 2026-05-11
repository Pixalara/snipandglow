import { useLocation, Link } from 'react-router-dom';
import { useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import { useThemeStore } from '@/store/themeStore';
import { useRole } from '@/hooks/useRole';
import { usePlan } from '@/hooks/usePlan';
import { prefetchRoute } from '@/hooks/usePrefetch';
import type { FeatureName } from '@/config/planConfig';
import type { Resource } from '@/config/permissionMap';
import UpgradeModal from '@/components/ui/UpgradeModal';

interface SidebarProps {
  isMobile: boolean;
  isOpen: boolean;
  onClose: () => void;
  onLogout: () => void;
  sidebarWidth: string;
}

/* Lucide-style SVG Icons */
const Icons = {
  dashboard: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  ),
  members: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  plans: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" /><polyline points="14,2 14,8 20,8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><line x1="10" y1="9" x2="8" y2="9" />
    </svg>
  ),
  billing: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="4" width="22" height="16" rx="2" /><line x1="1" y1="10" x2="23" y2="10" />
    </svg>
  ),
  automations: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
    </svg>
  ),
  broadcast: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  ),
  employees: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  activity: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  ),
  settings: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  ),
  expenses: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  ),
  analytics: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  ),
  leads: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 17.5l-9.5-5L3 17.5" /><path d="M22 12.5l-9.5-5L3 12.5" /><path d="M22 7.5l-9.5-5L3 7.5" />
    </svg>
  ),
  logout: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16,17 21,12 16,7" /><line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  ),
};

export default function Sidebar({ isMobile, isOpen, onClose, onLogout, sidebarWidth }: SidebarProps) {
  const { gym, user } = useAuthStore();
  const { theme, toggleTheme } = useThemeStore();
  const { sidebarItems } = useRole();
  const { canAccess } = usePlan();
  const [upgradeReason, setUpgradeReason] = useState<string | null>(null);
  const location = useLocation();

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  const allNavItems: { icon: React.ReactNode; label: string; path: string; resource: Resource; badge?: string; feature?: FeatureName }[] = [
    { icon: Icons.dashboard, label: 'Dashboard', path: '/', resource: 'dashboard' },
    { icon: Icons.members, label: 'Clients', path: '/members', resource: 'members' },
    { icon: Icons.leads, label: 'Leads', path: '/leads', resource: 'leads', feature: 'leads' },
    { icon: Icons.plans, label: 'Packages', path: '/plans', resource: 'plans' },
    { icon: Icons.billing, label: 'Billing', path: '/billing', resource: 'billing' },
    { icon: Icons.automations, label: 'Automations', path: '/automations', badge: 'Live', resource: 'automations' },
    { icon: Icons.broadcast, label: 'Broadcast', path: '/broadcast', resource: 'broadcast', feature: 'broadcast' },
    { icon: Icons.expenses, label: 'Expenses', path: '/expenses', resource: 'expenses', feature: 'expenses' },
    { icon: Icons.analytics, label: 'Analytics', path: '/analytics', resource: 'analytics', feature: 'analytics' },
    { icon: Icons.employees, label: 'Staff', path: '/employees', resource: 'employees' },
    { icon: Icons.activity, label: 'Branches', path: '/branches', resource: 'branches' },
    { icon: Icons.activity, label: 'Activity Log', path: '/activity', resource: 'activity' },
    { icon: Icons.settings, label: 'Settings', path: '/settings', resource: 'settings' },
  ];

  const navItems = allNavItems.filter(item => sidebarItems.includes(item.resource));

  if (!user) return null;

  return (
    <aside className="sidebar-smooth" style={{
      width: sidebarWidth,
      height: '100vh',
      background: `linear-gradient(180deg, var(--pf-sidebar-bg) 0%, var(--pf-bg) 100%)`,
      borderRight: '1px solid var(--pf-border)',
      display: 'flex',
      flexDirection: 'column',
      position: isMobile ? 'fixed' : 'sticky',
      left: isMobile ? (isOpen ? 0 : `-${sidebarWidth}`) : 0,
      top: 0,
      zIndex: 120,
      transition: 'left 300ms cubic-bezier(0.16, 1, 0.3, 1)',
      boxShadow: isMobile && isOpen ? '8px 0 40px rgba(0,0,0,0.08)' : 'none',
    }}>

      {/* Logo */}
      <div style={{
        padding: '20px 18px',
        borderBottom: '1px solid var(--pf-sidebar-border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none' }}>
          {gym?.logoUrl ? (
            <img src={gym.logoUrl} alt={gym.name} style={{
              width: '34px', height: '34px', borderRadius: '10px', objectFit: 'cover',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            }} />
          ) : (
            <img src="/pingflow-logo.svg" alt="Snip & Glow" style={{ width: '34px', height: '34px', borderRadius: '10px' }} />
          )}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: '17px', fontWeight: '800', color: 'var(--pf-text)', letterSpacing: '-0.02em' }}>Snip & Glow</span>
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10B981' }} className="glow-dot" />
            </div>
            <span style={{ fontSize: '10px', color: 'var(--pf-text-dim)', fontWeight: '600', letterSpacing: '0.04em', textTransform: 'uppercase' }}>{gym?.name || 'Salon CRM'}</span>
          </div>
        </Link>

        {isMobile && (
          <button 
            onClick={onClose} 
            style={{ width: '30px', height: '30px', borderRadius: '8px', backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', color: '#64748B', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px' }}
          >✕</button>
        )}
      </div>

      {/* Section Label */}
      <div style={{ padding: '16px 18px 6px', fontSize: '10px', fontWeight: '700', color: '#94A3B8', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
        Menu
      </div>

      {/* Nav Items */}
      <nav style={{ padding: '0 10px', flex: 1, overflowY: 'auto' }}>
        {navItems.map(item => {
          const active = isActive(item.path);
          const isGated = item.feature ? !canAccess(item.feature) : false;
          return (
            <Link 
              key={item.label}
              to={isGated ? '#' : item.path}
              onMouseEnter={() => !isGated && prefetchRoute(item.path)}
              onFocus={() => !isGated && prefetchRoute(item.path)}
              onTouchStart={() => !isGated && prefetchRoute(item.path)}
              onClick={(e) => {
                if (isGated) {
                  e.preventDefault();
                  setUpgradeReason(item.feature!);
                } else if (isMobile) {
                  onClose();
                }
              }}
              className="nav-item"
              style={{
                display: 'flex', alignItems: 'center',
                justifyContent: 'space-between',
                padding: '9px 12px',
                borderRadius: '10px',
                marginBottom: '2px',
                textDecoration: 'none',
                backgroundColor: active && !isGated ? 'var(--pf-sidebar-active-bg)' : 'transparent',
                borderLeft: active && !isGated ? '3px solid #E11D48' : '3px solid transparent',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ color: active && !isGated ? '#E11D48' : 'var(--pf-text-muted)', display: 'flex', transition: 'color 200ms' }}>{item.icon}</span>
                <span style={{
                  fontSize: '13.5px', fontWeight: active && !isGated ? '700' : '500',
                  color: active && !isGated ? '#E11D48' : 'var(--pf-text-secondary)',
                  letterSpacing: '-0.01em',
                }}>{item.label}</span>
              </div>
              {isGated ? (
                <span style={{
                  fontSize: '9px', fontWeight: '800',
                  background: 'linear-gradient(135deg, #E11D48, #8B5CF6)',
                  color: '#FFFFFF',
                  padding: '2px 7px', borderRadius: '6px', textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}>PRO</span>
              ) : item.badge ? (
                <span style={{
                  fontSize: '9px', fontWeight: '700',
                  background: active ? 'linear-gradient(135deg, #E11D48, #BE123C)' : 'var(--pf-badge-bg)',
                  color: active ? '#FFFFFF' : 'var(--pf-text-muted)', 
                  padding: '2px 7px', borderRadius: '6px', textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}>{item.badge}</span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      {/* Upgrade Modal for gated sidebar items */}
      <UpgradeModal
        isOpen={upgradeReason !== null}
        onClose={() => setUpgradeReason(null)}
        reason={upgradeReason ?? undefined}
      />

      {/* Dark Mode Toggle */}
      <div style={{ padding: '0 14px 8px' }}>
        <button
          onClick={toggleTheme}
          className="btn-press"
          style={{
            width: '100%',
            padding: '10px 14px',
            borderRadius: '10px',
            border: '1px solid var(--pf-border)',
            backgroundColor: 'var(--pf-surface-hover)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            transition: 'all 200ms',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '16px' }}>{theme === 'dark' ? '☀️' : '🌙'}</span>
            <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--pf-text-secondary)' }}>
              {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
            </span>
          </div>
          <div style={{
            width: '36px', height: '20px', borderRadius: '10px',
            backgroundColor: theme === 'dark' ? '#E11D48' : 'var(--pf-border)',
            position: 'relative', transition: 'background-color 300ms ease',
          }}>
            <div style={{
              width: '16px', height: '16px', borderRadius: '50%',
              backgroundColor: '#FFFFFF',
              position: 'absolute', top: '2px',
              left: theme === 'dark' ? '18px' : '2px',
              transition: 'left 300ms cubic-bezier(0.16, 1, 0.3, 1)',
              boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
            }} />
          </div>
        </button>
      </div>

      {/* User Profile */}
      <div style={{
        padding: '14px',
        borderTop: '1px solid var(--pf-sidebar-border)',
        display: 'flex', alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
          <div style={{
            width: '34px', height: '34px', borderRadius: '10px',
            background: 'linear-gradient(135deg, #E11D48 0%, #BE123C 100%)',
            color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '13px', fontWeight: '700',
            boxShadow: '0 2px 8px rgba(225,29,72,0.2)',
          }}>
            {(gym?.ownerName || 'U').charAt(0).toUpperCase()}
          </div>
          <div style={{ minWidth: 0 }}>
            <p style={{ fontSize: '13px', fontWeight: '700', color: 'var(--pf-text)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{gym?.ownerName || 'User'}</p>
            <p style={{ fontSize: '10px', color: 'var(--pf-text-dim)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.email}</p>
          </div>
        </div>
        <button 
          onClick={onLogout} 
          className="btn-press"
          title="Sign Out"
          style={{ 
            width: '30px', height: '30px', borderRadius: '8px',
            backgroundColor: 'var(--pf-surface-hover)', border: '1px solid var(--pf-border)',
            color: 'var(--pf-text-dim)', cursor: 'pointer', 
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 200ms',
          }}
          onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#FEF2F2'; e.currentTarget.style.color = '#E11D48'; e.currentTarget.style.borderColor = '#FECDD3'; }}
          onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#F8FAFC'; e.currentTarget.style.color = '#94A3B8'; e.currentTarget.style.borderColor = '#E2E8F0'; }}
        >{Icons.logout}</button>
      </div>
    </aside>
  );
}
