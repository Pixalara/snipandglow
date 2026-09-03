'use client';

import { useTransition } from 'react';
import { useTheme } from 'next-themes';
import { Menu, LogOut, Sun, Moon } from 'lucide-react';
import { usePathname } from 'next/navigation';
import type { UserRole, Branch } from '@/types';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { BranchSwitcher } from '@/components/branch-switcher';
import { NotificationBell } from '@/components/notification-bell';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

interface TopbarProps {
  role: UserRole;
  userName: string;
  branches: Branch[];
  activeBranchId: string;
  onMenuToggle: () => void;
}

// Map route segments to friendly page titles for orientation in the topbar.
const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/dashboard/appointments': 'Appointments',
  '/dashboard/customers': 'Customers',
  '/dashboard/billing': 'Billing',
  '/dashboard/whatsapp': 'WhatsApp',
  '/dashboard/leads': 'Leads',
  '/dashboard/feedback': 'Feedback',
  '/dashboard/memberships': 'Memberships',
  '/dashboard/services': 'Services',
  '/dashboard/analytics': 'Revenue',
  '/dashboard/staff': 'Staff & Payroll',
  '/dashboard/expenses': 'Expenses',
  '/dashboard/branches': 'Branches',
  '/dashboard/audit-log': 'Audit Log',
  '/dashboard/support': 'Help & Support',
  '/dashboard/settings': 'Settings',
};

function getPageTitle(pathname: string): string {
  // Exact match first, then longest prefix match for nested routes.
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname];
  const match = Object.keys(PAGE_TITLES)
    .filter((p) => p !== '/dashboard' && pathname.startsWith(p))
    .sort((a, b) => b.length - a.length)[0];
  return match ? PAGE_TITLES[match] : 'Dashboard';
}

export function Topbar({ role, userName, branches, activeBranchId, onMenuToggle }: TopbarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const { theme, setTheme } = useTheme();

  const pageTitle = getPageTitle(pathname);

  const initials = userName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  function handleLogout() {
    startTransition(async () => {
      const supabase = createClient();
      await supabase.auth.signOut();
      router.push('/login');
      router.refresh();
    });
  }

  function toggleTheme() {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  }

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border/70 bg-background/80 px-4 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60">
      {/* Left: mobile menu toggle + page title */}
      <div className="flex items-center gap-2 min-w-0">
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          onClick={onMenuToggle}
          aria-label="Open menu"
        >
          <Menu className="size-5" />
        </Button>
        <h1 className="truncate text-base font-semibold tracking-tight text-foreground">
          {pageTitle}
        </h1>
      </div>

      {/* Right: branch switcher + theme toggle + user info + logout */}
      <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
        {/* Branch switcher (owner only) */}
        {role === 'owner' && (
          <BranchSwitcher branches={branches} activeBranchId={activeBranchId} />
        )}

        {/* Dark mode toggle */}
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          aria-label="Toggle dark mode"
          className="relative overflow-hidden rounded-full"
        >
          <Sun className="size-4 rotate-0 scale-100 transition-transform duration-300 dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute size-4 rotate-90 scale-0 transition-transform duration-300 dark:rotate-0 dark:scale-100" />
        </Button>

        {/* Notification Bell */}
        <NotificationBell />

        {/* Divider */}
        <span className="hidden sm:block h-6 w-px bg-border mx-0.5" aria-hidden="true" />

        {/* User avatar + role badge */}
        <div className="flex items-center gap-2">
          <div
            className="flex size-8 items-center justify-center rounded-full bg-gradient-to-br from-salon-rose to-salon-gold text-xs font-semibold text-white shadow-sm ring-2 ring-background"
            aria-label={`User: ${userName}`}
          >
            {initials}
          </div>
          <div className="hidden sm:flex flex-col leading-tight">
            <span className="text-xs font-medium text-foreground max-w-[120px] truncate">{userName}</span>
            <span
              className={cn(
                'text-[10px] font-medium capitalize',
                role === 'owner' && 'text-salon-rose',
                role === 'manager' && 'text-salon-gold',
                role === 'staff' && 'text-salon-lavender'
              )}
            >
              {role}
            </span>
          </div>
        </div>

        {/* Logout button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={handleLogout}
          disabled={isPending}
          aria-label="Logout"
          className="rounded-full text-muted-foreground hover:text-destructive"
        >
          <LogOut className="size-4" />
        </Button>
      </div>
    </header>
  );
}
