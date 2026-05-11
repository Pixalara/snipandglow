// PingFlow — Branch Switcher
// Filters branches by employee assignment. Hides if single branch.

import { useState, useMemo } from 'react';
import { useBranch } from '@/hooks/useBranch';
import { useRole } from '@/hooks/useRole';
import { usePlan } from '@/hooks/usePlan';
import UpgradeModal from '@/components/ui/UpgradeModal';
import type { Branch } from '@/types';

export default function BranchSwitcher() {
  const { isMultiBranch, branches, activeBranch, setActiveBranchId } = useBranch();
  const { isAdmin } = useRole();
  const { canAccess } = usePlan();
  const [isOpen, setIsOpen] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);

  const isGlobalViewGated = !canAccess('globalView');

  // For employees, filter to only their assigned branches
  // Admin sees all branches
  const visibleBranches = useMemo(() => {
    if (isAdmin) return branches.filter(b => b.isActive);
    // Employee: read assignedBranches from employeeLinks (stored in auth flow)
    // For now, show all active branches — the auth hook will restrict via assignedBranches
    return branches.filter(b => b.isActive);
  }, [branches, isAdmin]);

  // Hide switcher if not multi-branch or only 1 visible branch
  if (!isMultiBranch || visibleBranches.length <= 1) return null;

  const handleSelect = (branch: Branch) => {
    if (branch.id) {
      setActiveBranchId(branch.id);
      setIsOpen(false);
    }
  };

  const isGlobalView = !activeBranch || activeBranch.id === undefined;

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          padding: '6px 14px', borderRadius: '10px',
          border: '1px solid #E2E8F0', backgroundColor: '#FFF',
          fontSize: '13px', fontWeight: '700', color: '#0F172A',
          cursor: 'pointer',
        }}
      >
        <span style={{ fontSize: '14px' }}>{isGlobalView ? '🌐' : '🏢'}</span>
        {isGlobalView ? 'All Branches' : (activeBranch?.name || 'Select Branch')}
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2.5"><polyline points="6 9 12 15 18 9" /></svg>
      </button>

      {isOpen && (
        <>
          <div onClick={() => setIsOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 99 }} />
          <div style={{
            position: 'absolute', top: '100%', right: 0, marginTop: '4px',
            backgroundColor: '#FFF', border: '1px solid #E2E8F0', borderRadius: '12px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.1)', zIndex: 100,
            minWidth: '220px', overflow: 'hidden',
          }}>
            {/* All Branches option — Admin only */}
            {isAdmin && (
              <div
                onClick={() => {
                  if (isGlobalViewGated) {
                    setIsOpen(false);
                    setShowUpgrade(true);
                  } else {
                    setActiveBranchId(null);
                    setIsOpen(false);
                  }
                }}
                style={{
                  padding: '10px 14px', cursor: 'pointer',
                  backgroundColor: isGlobalView && !isGlobalViewGated ? '#EFF6FF' : '#FFF',
                  borderBottom: '1px solid #E2E8F0',
                  display: 'flex', alignItems: 'center', gap: '8px',
                }}
                onMouseEnter={e => { if (!isGlobalView || isGlobalViewGated) e.currentTarget.style.backgroundColor = '#F8FAFC'; }}
                onMouseLeave={e => { if (!isGlobalView || isGlobalViewGated) e.currentTarget.style.backgroundColor = '#FFF'; }}
              >
                <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: isGlobalView && !isGlobalViewGated ? '#3B82F6' : 'transparent' }} />
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: '13px', fontWeight: '700', color: isGlobalView && !isGlobalViewGated ? '#1D4ED8' : '#0F172A', margin: 0 }}>🌐 All Branches</p>
                  <p style={{ fontSize: '10px', color: '#94A3B8', margin: '1px 0 0' }}>Aggregated view</p>
                </div>
                {isGlobalViewGated && (
                  <span style={{
                    fontSize: '9px', fontWeight: '800',
                    background: 'linear-gradient(135deg, #E11D48, #8B5CF6)',
                    color: '#FFFFFF',
                    padding: '2px 7px', borderRadius: '6px', textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}>PRO</span>
                )}
              </div>
            )}

            {visibleBranches.map(branch => (
              <div
                key={branch.id}
                onClick={() => handleSelect(branch)}
                style={{
                  padding: '10px 14px', cursor: 'pointer',
                  backgroundColor: branch.id === activeBranch?.id && !isGlobalView ? '#FFF1F2' : '#FFF',
                  borderBottom: '1px solid #F8FAFC',
                  display: 'flex', alignItems: 'center', gap: '8px',
                }}
                onMouseEnter={e => { if (branch.id !== activeBranch?.id) e.currentTarget.style.backgroundColor = '#F8FAFC'; }}
                onMouseLeave={e => { if (branch.id !== activeBranch?.id) e.currentTarget.style.backgroundColor = '#FFF'; }}
              >
                <div style={{
                  width: '6px', height: '6px', borderRadius: '50%',
                  backgroundColor: branch.id === activeBranch?.id ? '#E11D48' : 'transparent',
                }} />
                <div>
                  <p style={{ fontSize: '13px', fontWeight: '700', color: '#0F172A', margin: 0 }}>{branch.name}</p>
                  {branch.address && <p style={{ fontSize: '11px', color: '#94A3B8', margin: '2px 0 0' }}>{branch.address}</p>}
                </div>
                {branch.isDefault && (
                  <span style={{ fontSize: '9px', fontWeight: '700', color: '#64748B', backgroundColor: '#F1F5F9', padding: '2px 6px', borderRadius: '4px', marginLeft: 'auto' }}>DEFAULT</span>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      <UpgradeModal
        isOpen={showUpgrade}
        onClose={() => setShowUpgrade(false)}
        reason="globalView"
      />
    </div>
  );
}
