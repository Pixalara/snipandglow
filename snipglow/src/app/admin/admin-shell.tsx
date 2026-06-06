'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Building2, Users, CreditCard, Zap, FileText, Shield, Trash2, Headphones, IndianRupee, MessageCircle } from 'lucide-react';
import { AdminThemeToggle } from './admin-theme-toggle';
import { AdminClock } from './admin-clock';

const navItems = [
  { label: 'Overview', href: '/admin', icon: LayoutDashboard },
  { label: 'Tenants', href: '/admin/tenants', icon: Building2 },
  { label: 'Customers', href: '/admin/customers', icon: Users },
  { label: 'Subscriptions', href: '/admin/subscriptions', icon: CreditCard },
  { label: 'Support Tickets', href: '/admin/support', icon: Headphones },
  { label: 'WhatsApp Setup', href: '/admin/whatsapp-setup', icon: MessageCircle, badgeKey: 'pendingSetupRequests' as const },
  { label: 'WhatsApp Health', href: '/admin/whatsapp', icon: Zap },
  { label: 'WhatsApp Costs', href: '/admin/whatsapp-costs', icon: IndianRupee },
  { label: 'Automation Logs', href: '/admin/automation-logs', icon: FileText },
  { label: 'Audit Logs', href: '/admin/audit', icon: Shield },
  { label: 'Force Delete', href: '/admin/force-delete', icon: Trash2 },
];

export function AdminShell({
  adminEmail,
  pendingSetupRequests = 0,
  children,
}: {
  adminEmail: string;
  pendingSetupRequests?: number;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const activeLabel = navItems.find(
    (item) => pathname === item.href || (item.href !== '/admin' && pathname.startsWith(item.href))
  )?.label ?? 'Admin';

  return (
    <div className="flex h-screen bg-background text-foreground">
      {/* Sidebar */}
      <aside className="w-56 shrink-0 border-r border-border bg-card flex flex-col">
        <div className="px-4 py-4 border-b border-border">
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Platform Admin</p>
          <p className="text-sm font-bold text-foreground mt-1">SnipandGlow</p>
        </div>
        <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || (item.href !== '/admin' && pathname.startsWith(item.href));
            const badgeCount = item.badgeKey === 'pendingSetupRequests' ? pendingSetupRequests : 0;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                  isActive
                    ? 'bg-accent text-foreground font-medium'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                }`}
              >
                <Icon className="size-4" />
                <span className="flex-1">{item.label}</span>
                {badgeCount > 0 && (
                  <span className="inline-flex items-center justify-center rounded-full bg-amber-500 px-1.5 min-w-[18px] h-[18px] text-[10px] font-bold text-white">
                    {badgeCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
        <div className="px-4 py-3 border-t border-border">
          <div className="flex items-center gap-2">
            <Shield className="size-3.5 text-emerald-500" />
            <p className="text-xs text-muted-foreground truncate">{adminEmail}</p>
          </div>
        </div>
      </aside>

      {/* Main column */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-card px-6">
          <p className="text-sm font-semibold text-foreground">{activeLabel}</p>
          <div className="flex items-center gap-3">
            <AdminClock />
            <AdminThemeToggle />
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
