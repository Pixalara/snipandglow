'use client';

import { useEffect, useState } from 'react';
import { BadgeDollarSign, Clock, TrendingUp, Users } from 'lucide-react';
import { StaffClient } from './staff-client';
import { StaffAttendance } from './staff-attendance';
import { PayrollClient, type PayrollRow } from './payroll-client';
import { StaffPerformance } from './staff-performance';
import type { Branch, Employee, UserRole } from '@/types';

// =============================================================================
// Staff workspace — one module for the whole pay cycle.
//
// Team roster, attendance, payroll and payslips used to be split across two
// sidebar entries, which made no sense: they are a single sequence. An owner
// sets an hourly rate on a staff member, records the hours they worked, prices
// those hours, pays them, then hands over a payslip. Every step feeds the next,
// so they are tabs in one place rather than separate destinations.
//
// PANEL MOUNTING. A tab's panel is mounted the first time it is opened and then
// kept mounted, hidden with CSS. That is deliberate: attendance holds unsaved
// edits, and unmounting would throw away a half-finished day when the owner
// flips to Payroll to check a figure. It also avoids refetching on every switch.
// Panels are not all mounted up front, because attendance and performance each
// fire their own query on mount and three of the four would be wasted.
// =============================================================================

const TABS = [
  {
    value: 'members' as const,
    label: 'Team',
    short: 'Team',
    icon: Users,
    hint: 'Add staff, set roles and hourly rates',
  },
  {
    value: 'attendance' as const,
    label: 'Attendance',
    short: 'Hours',
    icon: Clock,
    hint: 'Record login and logout times',
  },
  {
    value: 'payroll' as const,
    label: 'Payroll',
    short: 'Pay',
    icon: BadgeDollarSign,
    hint: 'Salaries, payments and payslips',
  },
  {
    value: 'performance' as const,
    label: 'Performance',
    short: 'Stats',
    icon: TrendingUp,
    hint: 'Revenue and customers per staff member',
  },
];

export type StaffTab = (typeof TABS)[number]['value'];

const TAB_VALUES = TABS.map((t) => t.value);

/** Narrow an untrusted `?tab=` value, so a bad link lands somewhere sensible. */
export function parseStaffTab(value: string | undefined): StaffTab {
  return TAB_VALUES.includes(value as StaffTab) ? (value as StaffTab) : 'members';
}

interface StaffWorkspaceProps {
  employees: Employee[];
  branches: Branch[];
  payrollRecords: PayrollRow[];
  currentMonth: string;
  role: UserRole;
  initialTab: StaffTab;
}

export function StaffWorkspace({
  employees,
  branches,
  payrollRecords,
  currentMonth,
  role,
  initialTab,
}: StaffWorkspaceProps) {
  const [tab, setTab] = useState<StaffTab>(initialTab);
  const [visited, setVisited] = useState<Set<StaffTab>>(() => new Set([initialTab]));

  // Keep the URL in step so the tab survives a refresh and can be linked to
  // (the Payroll redirect stub relies on `?tab=payroll`). replaceState rather
  // than router.replace: this is pure view state, and a server round trip per
  // tab click would make the module feel sluggish for no benefit.
  useEffect(() => {
    const url = new URL(window.location.href);
    if (tab === 'members') url.searchParams.delete('tab');
    else url.searchParams.set('tab', tab);
    window.history.replaceState(null, '', url.toString());
  }, [tab]);

  const select = (next: StaffTab) => {
    setTab(next);
    setVisited((prev) => (prev.has(next) ? prev : new Set(prev).add(next)));
  };

  const activeStaff = employees.filter((e) => e.is_active).length;
  const active = TABS.find((t) => t.value === tab) ?? TABS[0];

  return (
    <div className="space-y-6">
      {/* ── Module header ─────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl border border-violet-200/50 bg-gradient-to-br from-violet-500/10 via-violet-500/5 to-transparent p-5 dark:border-violet-800/30 sm:p-6">
        <div className="relative z-10 space-y-5">
          <div className="flex items-center gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-violet-100 dark:bg-violet-900/30">
              <Users className="size-5 text-violet-600 dark:text-violet-400" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-bold text-foreground">Staff &amp; Payroll</h1>
              <p className="text-sm text-muted-foreground">
                {activeStaff} active {activeStaff === 1 ? 'member' : 'members'} &middot;{' '}
                {active.hint}
              </p>
            </div>
          </div>

          {/* Tabs. Horizontally scrollable on a phone rather than wrapping to a
              second row, so the header height stays predictable. */}
          <div
            role="tablist"
            aria-label="Staff and payroll sections"
            className="-mx-1 flex items-center gap-1 overflow-x-auto rounded-xl border border-border bg-background/70 p-1 shadow-sm backdrop-blur-sm [scrollbar-width:none] sm:mx-0 [&::-webkit-scrollbar]:hidden"
          >
            {TABS.map((t) => {
              const isActive = tab === t.value;
              return (
                <button
                  key={t.value}
                  type="button"
                  role="tab"
                  id={`staff-tab-${t.value}`}
                  aria-selected={isActive}
                  aria-controls={`staff-panel-${t.value}`}
                  onClick={() => select(t.value)}
                  className={`flex flex-1 shrink-0 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium whitespace-nowrap transition-all sm:text-sm ${
                    isActive
                      ? 'bg-violet-600 text-white shadow-sm'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                >
                  <t.icon className="size-4 shrink-0" />
                  <span className="sm:hidden">{t.short}</span>
                  <span className="hidden sm:inline">{t.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-6 -top-6 size-32 rounded-full bg-violet-500/5"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-2 top-10 size-20 rounded-full bg-violet-400/5"
        />
      </div>

      {/* ── Panels ────────────────────────────────────────────────────────── */}
      {visited.has('members') && (
        <Panel value="members" active={tab === 'members'}>
          <StaffClient employees={employees} branches={branches} role={role} />
        </Panel>
      )}

      {visited.has('attendance') && (
        <Panel value="attendance" active={tab === 'attendance'}>
          <StaffAttendance />
        </Panel>
      )}

      {visited.has('payroll') && (
        <Panel value="payroll" active={tab === 'payroll'}>
          <PayrollClient
            payrollRecords={payrollRecords}
            employees={employees}
            currentMonth={currentMonth}
          />
        </Panel>
      )}

      {visited.has('performance') && (
        <Panel value="performance" active={tab === 'performance'}>
          <StaffPerformance />
        </Panel>
      )}
    </div>
  );
}

/**
 * Hidden rather than unmounted when inactive — see the mounting note at the top.
 * `hidden` also keeps the contents out of the accessibility tree and out of tab
 * order, so a keyboard user can't land inside an invisible panel.
 */
function Panel({
  value,
  active,
  children,
}: {
  value: StaffTab;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      role="tabpanel"
      id={`staff-panel-${value}`}
      aria-labelledby={`staff-tab-${value}`}
      hidden={!active}
    >
      {children}
    </div>
  );
}
