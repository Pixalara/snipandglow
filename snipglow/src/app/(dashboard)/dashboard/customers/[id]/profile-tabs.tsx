'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';

// =============================================================================
// ProfileTabs — Client component for toggling between Visit and Billing history
// =============================================================================

interface ProfileTabsProps {
  visitHistory: React.ReactNode;
  billingHistory: React.ReactNode;
  walletHistory: React.ReactNode;
}

export function ProfileTabs({ visitHistory, billingHistory, walletHistory }: ProfileTabsProps) {
  const [activeTab, setActiveTab] = useState<'visits' | 'billing' | 'wallet'>('visits');

  const tabClass = (active: boolean) =>
    cn(
      'flex-1 rounded-md px-2 sm:px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap',
      active ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
    );

  return (
    <div className="space-y-4">
      {/* Tab Buttons */}
      <div className="flex gap-1 rounded-lg border border-border bg-muted/50 p-1">
        <button onClick={() => setActiveTab('visits')} className={tabClass(activeTab === 'visits')}>
          <span className="sm:hidden">Visits</span>
          <span className="hidden sm:inline">Visit History</span>
        </button>
        <button onClick={() => setActiveTab('billing')} className={tabClass(activeTab === 'billing')}>
          <span className="sm:hidden">Billing</span>
          <span className="hidden sm:inline">Billing History</span>
        </button>
        <button onClick={() => setActiveTab('wallet')} className={tabClass(activeTab === 'wallet')}>
          Wallet
        </button>
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === 'visits' && visitHistory}
        {activeTab === 'billing' && billingHistory}
        {activeTab === 'wallet' && walletHistory}
      </div>
    </div>
  );
}
