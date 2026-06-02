'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import type { UserRole, Branch } from '@/types';
import { Sidebar } from '@/components/sidebar';
import { Topbar } from '@/components/topbar';

interface AppShellProps {
  role: UserRole;
  userName: string;
  branches: Branch[];
  activeBranchId: string;
  planTier?: string;
  children: React.ReactNode;
}

export function AppShell({ role, userName, branches, activeBranchId, planTier, children }: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <Sidebar
        role={role}
        planTier={planTier}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Main area */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Topbar */}
        <Topbar
          role={role}
          userName={userName}
          branches={branches}
          activeBranchId={activeBranchId}
          onMenuToggle={() => setSidebarOpen((prev) => !prev)}
        />

        {/* Content with smooth page transition */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <div
            key={pathname}
            className="mx-auto w-full max-w-7xl animate-in fade-in slide-in-from-bottom-2 duration-300 ease-out"
          >
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
