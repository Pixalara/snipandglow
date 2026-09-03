'use client';

import Link from 'next/link';
import Image from 'next/image';
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
  MessageCircle,
  Star,
  Headphones,
  Package,
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
  enterpriseOnly?: boolean;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    label: 'Main',
    items: [
      { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, resource: 'dashboard' },
      { label: 'Customers', href: '/dashboard/customers', icon: Users, resource: 'customers' },
      { label: 'Appointments', href: '/dashboard/appointments', icon: Calendar, resource: 'appointments' },
      { label: 'Billing', href: '/dashboard/billing', icon: Receipt, resource: 'billing' },
    ],
  },
  {
    label: 'Growth',
    items: [
      { label: 'WhatsApp', href: '/dashboard/whatsapp', icon: MessageCircle, resource: 'settings' },
      { label: 'Leads', href: '/dashboard/leads', icon: Target, resource: 'leads' },
      { label: 'Feedback', href: '/dashboard/feedback', icon: Star, resource: 'analytics' },
      { label: 'Memberships', href: '/dashboard/memberships', icon: CreditCard, resource: 'memberships' },
    ],
  },
  {
    label: 'Business',
    items: [
      { label: 'Services', href: '/dashboard/services', icon: Scissors, resource: 'services' },
      { label: 'Inventory', href: '/dashboard/inventory', icon: Package, resource: 'inventory' },
      { label: 'Revenue', href: '/dashboard/analytics', icon: BarChart3, resource: 'analytics' },
      // Roster, attendance, payroll and payslips are one module — see
      // dashboard/staff/staff-workspace.tsx. The old /dashboard/payroll route
      // still exists purely to redirect old bookmarks into the Payroll tab.
      { label: 'Staff & Payroll', href: '/dashboard/staff', icon: UserCog, resource: 'staff' },
      { label: 'Expenses', href: '/dashboard/expenses', icon: Wallet, resource: 'expenses' },
      { label: 'Branches', href: '/dashboard/branches', icon: Building2, resource: 'branches', enterpriseOnly: true },
    ],
  },
  {
    label: 'Admin',
    items: [
      { label: 'Audit Log', href: '/dashboard/audit-log', icon: FileText, resource: 'audit' },
      { label: 'Help & Support', href: '/dashboard/support', icon: Headphones, resource: 'dashboard' },
      { label: 'Settings', href: '/dashboard/settings', icon: Settings, resource: 'settings' },
    ],
  },
];

interface SidebarProps {
  role: UserRole;
  planTier?: string;
  isOpen: boolean;
  onClose: () => void;
}

export function Sidebar({ role, planTier, isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();

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
          <Link href="/dashboard" className="flex items-center gap-2 group">
            <span className="relative flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-xl shadow-sm transition-transform duration-300 group-hover:scale-105">
              <Image
                src="/android-chrome-512x512.png"
                alt="SnipandGlow"
                width={32}
                height={32}
                priority
                className="size-8 object-contain"
              />
            </span>
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
          <div className="space-y-5">
            {navGroups.map((group) => {
              // Filter items by role and plan
              const visibleItems = group.items.filter((item) => {
                if (item.enterpriseOnly && planTier !== 'enterprise') return false;
                return can(role, 'read', item.resource);
              });

              if (visibleItems.length === 0) return null;

              return (
                <div key={group.label}>
                  {/* Group label */}
                  <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/40 select-none">
                    {group.label}
                  </p>

                  <ul className="space-y-0.5">
                    {visibleItems.map((item) => {
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
                              'group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200',
                              isActive
                                ? 'bg-sidebar-accent text-sidebar-primary shadow-sm'
                                : 'text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground'
                            )}
                          >
                            {/* Active indicator bar */}
                            <span
                              className={cn(
                                'absolute left-0 top-1/2 -translate-y-1/2 h-5 w-0.5 rounded-r-full bg-sidebar-primary transition-all duration-300',
                                isActive ? 'opacity-100' : 'opacity-0 -translate-x-1'
                              )}
                              aria-hidden="true"
                            />
                            <Icon className={cn(
                              'size-4 shrink-0 transition-transform duration-200',
                              isActive ? 'scale-110' : 'group-hover:scale-110'
                            )} />
                            {item.label}
                            {isActive && (
                              <span className="ml-auto size-1.5 rounded-full bg-sidebar-primary animate-pulse" />
                            )}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </div>
        </nav>

        {/* Footer */}
        <div className="border-t border-sidebar-border px-4 py-3">
          <p className="text-[10px] text-sidebar-foreground/40 text-center select-none">
            © {new Date().getFullYear()} SnipandGlow
          </p>
        </div>
      </aside>
    </>
  );
}
