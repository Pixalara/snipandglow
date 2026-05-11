'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';

// =============================================================================
// ProfileTabs — Client component for toggling between Visit and Billing history
// =============================================================================

interface ProfileTabsProps {
  visitHistory: React.ReactNode;
  billingHistory: React.ReactNode;
}

export function ProfileTabs({ visitHistory, billingHistory }: ProfileTabsProps) {
  const [activeTab, setActiveTab] = useState<'visits' | 'billing'>('visits');

  return (
    <div className="space-y-4">
      {/* Tab Buttons */}
      <div className="flex gap-1 rounded-lg border border-border bg-muted/50 p-1">
        <button
          onClick={() => setActiveTab('visits')}
          className={cn(
            'flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors',
            activeTab === 'visits'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          Visit History
        </button>
        <button
          onClick={() => setActiveTab('billing')}
          className={cn(
            'flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors',
            activeTab === 'billing'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          Billing History
        </button>
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === 'visits' ? visitHistory : billingHistory}
      </div>
    </div>
  );
}
