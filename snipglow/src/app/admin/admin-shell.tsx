'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Building2, Users, CreditCard, Zap, FileText, Shield, Trash2, Headphones } from 'lucide-react';

const navItems = [
  { label: 'Overview', href: '/admin', icon: LayoutDashboard },
  { label: 'Tenants', href: '/admin/tenants', icon: Building2 },
  { label: 'Customers', href: '/admin/customers', icon: Users },
  { label: 'Subscriptions', href: '/admin/subscriptions', icon: CreditCard },
  { label: 'Support Tickets', href: '/admin/support', icon: Headphones },
  { label: 'WhatsApp Health', href: '/admin/whatsapp', icon: Zap },
  { label: 'Audit Logs', href: '/admin/audit', icon: FileText },
  { label: 'Force Delete', href: '/admin/force-delete', icon: Trash2 },
];

export function AdminShell({ adminEmail, children }: { adminEmail: string; children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100">
      {/* Sidebar */}
      <aside className="w-56 shrink-0 border-r border-slate-800 bg-slate-900 flex flex-col">
        <div className="px-4 py-4 border-b border-slate-800">
          <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Platform Admin</p>
          <p className="text-sm font-bold text-white mt-1">SnipandGlow</p>
        </div>
        <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || (item.href !== '/admin' && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                  isActive
                    ? 'bg-slate-800 text-white font-medium'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                }`}
              >
                <Icon className="size-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="px-4 py-3 border-t border-slate-800">
          <div className="flex items-center gap-2">
            <Shield className="size-3.5 text-emerald-400" />
            <p className="text-xs text-slate-400 truncate">{adminEmail}</p>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto p-6">
        {children}
      </main>
    </div>
  );
}
