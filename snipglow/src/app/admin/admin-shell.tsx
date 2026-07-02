'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Building2, Users, CreditCard, Zap, FileText, Shield, Trash2, Headphones, IndianRupee, MessageCircle, Mail, Menu, X } from 'lucide-react';
import { AdminThemeToggle } from './admin-theme-toggle';
import { AdminClock } from './admin-clock';

const navItems = [
  { label: 'Overview', href: '/admin', icon: LayoutDashboard },
  { label: 'Tenants', href: '/admin/tenants', icon: Building2 },
  { label: 'Customers', href: '/admin/customers', icon: Users },
  { label: 'Subscriptions', href: '/admin/subscriptions', icon: CreditCard },
  { label: 'Announcements', href: '/admin/announcements', icon: Mail },
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
  const [mobileOpen, setMobileOpen] = useState(false);

  const activeLabel = navItems.find(
    (item) => pathname === item.href || (item.href !== '/admin' && pathname.startsWith(item.href))
  )?.label ?? 'Admin';

  // Close the mobile drawer whenever the route changes.
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Shared nav content (used by the desktop sidebar + the mobile drawer).
  const navContent = (
    <>
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
              onClick={() => setMobileOpen(false)}
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
          <Shield className="size-3.5 text-emerald-500 shrink-0" />
          <p className="text-xs text-muted-foreground truncate">{adminEmail}</p>
        </div>
      </div>
    </>
  );

  return (
    <div className="flex h-screen bg-background text-foreground">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-56 shrink-0 border-r border-border bg-card flex-col">
        {navContent}
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <aside className="absolute inset-y-0 left-0 w-64 max-w-[80%] border-r border-border bg-card flex flex-col shadow-xl animate-in slide-in-from-left duration-200">
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute right-3 top-3 flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent"
              aria-label="Close menu"
            >
              <X className="size-4" />
            </button>
            {navContent}
          </aside>
        </div>
      )}

      {/* Main column */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-card px-4 sm:px-6 gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <button
              onClick={() => setMobileOpen(true)}
              className="lg:hidden flex size-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent shrink-0"
              aria-label="Open menu"
            >
              <Menu className="size-5" />
            </button>
            <p className="text-sm font-semibold text-foreground truncate">{activeLabel}</p>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <span className="hidden sm:inline-flex">
              <AdminClock />
            </span>
            <AdminThemeToggle />
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
