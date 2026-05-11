'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Calendar,
  Users,
  Scissors,
  Receipt,
  CreditCard,
  UserCog,
  Building2,
  BarChart3,
  FileText,
  Settings,
  X,
} from 'lucide-react';
import type { UserRole } from '@/types';
import { can, type Resource } from '@/lib/permissions';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  resource: Resource;
}

const navItems: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, resource: 'dashboard' },
  { label: 'Appointments', href: '/dashboard/appointments', icon: Calendar, resource: 'appointments' },
  { label: 'Customers', href: '/dashboard/customers', icon: Users, resource: 'customers' },
  { label: 'Services', href: '/dashboard/services', icon: Scissors, resource: 'services' },
  { label: 'Billing', href: '/dashboard/billing', icon: Receipt, resource: 'billing' },
  { label: 'Memberships', href: '/dashboard/memberships', icon: CreditCard, resource: 'memberships' },
  { label: 'Staff', href: '/dashboard/staff', icon: UserCog, resource: 'staff' },
  { label: 'Branches', href: '/dashboard/branches', icon: Building2, resource: 'branches' },
  { label: 'Analytics', href: '/dashboard/analytics', icon: BarChart3, resource: 'analytics' },
  { label: 'Audit Log', href: '/dashboard/audit-log', icon: FileText, resource: 'audit' },
  { label: 'Settings', href: '/dashboard/settings', icon: Settings, resource: 'settings' },
];

interface SidebarProps {
  role: UserRole;
  isOpen: boolean;
  onClose: () => void;
}

export function Sidebar({ role, isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();

  const filteredNavItems = navItems.filter((item) => can(role, 'read', item.resource));

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-sidebar-border bg-sidebar transition-transform duration-200 ease-in-out md:static md:translate-x-0',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Logo header */}
        <div className="flex h-14 items-center justify-between border-b border-sidebar-border px-4">
          <Link href="/dashboard" className="flex items-center gap-2">
            <Scissors className="size-5 text-sidebar-primary" />
            <span className="text-lg font-bold text-sidebar-primary">Snip &amp; Glow</span>
          </Link>
          {/* Mobile close button */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={onClose}
            aria-label="Close sidebar"
          >
            <X className="size-5" />
          </Button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <ul className="space-y-1">
            {filteredNavItems.map((item) => {
              const Icon = item.icon;
              const isActive =
                pathname === item.href ||
                (item.href !== '/dashboard' && pathname.startsWith(item.href));

              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onClose}
                    className={cn(
                      'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-sidebar-accent text-sidebar-primary'
                        : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                    )}
                  >
                    <Icon className="size-4 shrink-0" />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </aside>
    </>
  );
}
