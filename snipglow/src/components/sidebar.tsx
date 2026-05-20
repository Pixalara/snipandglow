'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Calendar,
  Users,
  Target,
  Scissors,
  Receipt,
  CreditCard,
  UserCog,
  Building2,
  BarChart3,
  FileText,
  Settings,
  X,
  Wallet,
  BadgeDollarSign,
  MessageCircle,
  Star,
  Headphones,
  Zap,
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
  { label: 'Leads', href: '/dashboard/leads', icon: Target, resource: 'leads' },
  { label: 'Services', href: '/dashboard/services', icon: Scissors, resource: 'services' },
  { label: 'Billing', href: '/dashboard/billing', icon: Receipt, resource: 'billing' },
  { label: 'Expenses', href: '/dashboard/expenses', icon: Wallet, resource: 'expenses' },
  { label: 'Memberships', href: '/dashboard/memberships', icon: CreditCard, resource: 'memberships' },
  { label: 'Staff', href: '/dashboard/staff', icon: UserCog, resource: 'staff' },
  { label: 'Payroll', href: '/dashboard/payroll', icon: BadgeDollarSign, resource: 'payroll' },
  { label: 'Branches', href: '/dashboard/branches', icon: Building2, resource: 'branches' },
  { label: 'WhatsApp', href: '/dashboard/whatsapp', icon: MessageCircle, resource: 'settings' },
  { label: 'Automation Logs', href: '/dashboard/automation-logs', icon: Zap, resource: 'settings' },
  { label: 'Feedback', href: '/dashboard/feedback', icon: Star, resource: 'analytics' },
  { label: 'Analytics', href: '/dashboard/analytics', icon: BarChart3, resource: 'analytics' },
  { label: 'Audit Log', href: '/dashboard/audit-log', icon: FileText, resource: 'audit' },
  { label: 'Help & Support', href: '/dashboard/support', icon: Headphones, resource: 'dashboard' },
  { label: 'Settings', href: '/dashboard/settings', icon: Settings, resource: 'settings' },
];

interface SidebarProps {
  role: UserRole;
  planTier?: string;
  isOpen: boolean;
  onClose: () => void;
}

export function Sidebar({ role, planTier, isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();

  const filteredNavItems = navItems.filter((item) => {
    // Hide Branches for non-enterprise users
    if (item.href === '/dashboard/branches' && planTier !== 'enterprise') {
      return false;
    }
    return can(role, 'read', item.resource);
  });

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
          'fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-sidebar-border bg-sidebar transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] md:static md:translate-x-0',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Logo header */}
        <div className="flex h-14 items-center justify-between border-b border-sidebar-border px-4">
          <Link href="/dashboard" className="flex items-center gap-2">
            <span className="font-bold tracking-tight text-lg">
              <span className="text-sidebar-foreground">snipand</span>
              <span className="bg-gradient-to-r from-pink-500 via-fuchsia-500 to-violet-500 bg-clip-text text-transparent">glow</span>
            </span>
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
                    prefetch={true}
                    className={cn(
                      'group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200',
                      isActive
                        ? 'bg-sidebar-accent text-sidebar-primary shadow-sm'
                        : 'text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground hover:translate-x-0.5'
                    )}
                  >
                    <Icon className={cn(
                      'size-4 shrink-0 transition-transform duration-200',
                      isActive ? 'scale-110' : 'group-hover:scale-105'
                    )} />
                    {item.label}
                    {isActive && (
                      <span className="ml-auto size-1.5 rounded-full bg-sidebar-primary" />
                    )}
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
