'use client';

import { useState } from 'react';
import type { UserRole, Branch } from '@/types';
import { Sidebar } from '@/components/sidebar';
import { Topbar } from '@/components/topbar';

interface AppShellProps {
  role: UserRole;
  userName: string;
  branches: Branch[];
  activeBranchId: string;
  children: React.ReactNode;
}

export function AppShell({ role, userName, branches, activeBranchId, children }: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <Sidebar
        role={role}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Main area */}
      <div className="flex flex-1 flex-col">
        {/* Topbar */}
        <Topbar
          role={role}
          userName={userName}
          branches={branches}
          activeBranchId={activeBranchId}
          onMenuToggle={() => setSidebarOpen((prev) => !prev)}
        />

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
