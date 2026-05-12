'use client';

import { useTransition } from 'react';
import { useTheme } from 'next-themes';
import { Menu, LogOut, Sun, Moon } from 'lucide-react';
import type { UserRole, Branch } from '@/types';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { BranchSwitcher } from '@/components/branch-switcher';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

interface TopbarProps {
  role: UserRole;
  userName: string;
  branches: Branch[];
  activeBranchId: string;
  onMenuToggle: () => void;
}

export function Topbar({ role, userName, branches, activeBranchId, onMenuToggle }: TopbarProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const { theme, setTheme } = useTheme();

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
    <header className="flex h-14 items-center justify-between border-b border-border bg-background px-4">
      {/* Left: mobile menu toggle */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          onClick={onMenuToggle}
          aria-label="Open menu"
        >
          <Menu className="size-5" />
        </Button>
      </div>

      {/* Right: branch switcher + theme toggle + user info + logout */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
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
          className="relative overflow-hidden"
        >
          <Sun className="size-4 rotate-0 scale-100 transition-transform dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute size-4 rotate-90 scale-0 transition-transform dark:rotate-0 dark:scale-100" />
        </Button>

        {/* User avatar + role badge */}
        <div className="flex items-center gap-2">
          <div
            className="flex size-8 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground"
            aria-label={`User: ${userName}`}
          >
            {initials}
          </div>
          <span
            className={cn(
              'hidden rounded-full px-2 py-0.5 text-xs font-medium capitalize sm:inline-block',
              role === 'owner' && 'bg-salon-rose-light text-salon-rose',
              role === 'manager' && 'bg-salon-gold-light text-salon-gold',
              role === 'staff' && 'bg-salon-lavender-light text-salon-lavender'
            )}
          >
            {role}
          </span>
        </div>

        {/* Logout button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={handleLogout}
          disabled={isPending}
          aria-label="Logout"
        >
          <LogOut className="size-4" />
        </Button>
      </div>
    </header>
  );
}
