// =============================================================================
// Tab identity for the Staff & Payroll module.
//
// This file deliberately has NO 'use client' directive, because BOTH sides need
// it: `page.tsx` (a server component) validates the incoming `?tab=` value, and
// `staff-workspace.tsx` (a client component) uses the same list to build its
// tablist.
//
// It exists as its own module for a specific reason. When a server component
// imports a runtime value from a 'use client' module, that value becomes a client
// reference — an opaque proxy the server cannot invoke. Calling it server-side
// throws "Attempted to call parseStaffTab() from the server". Type-only imports
// are erased at compile time and would have been fine, but `parseStaffTab` is a
// real function, so it has to live somewhere neutral.
//
// Same hazard is documented in billing/invoice-pdf.tsx, which keeps its document
// component out of 'use client' so the server can render it too.
// =============================================================================

export type StaffTab = 'members' | 'attendance' | 'payroll' | 'performance';

/** Tab order, and the single source of truth for what a valid `?tab=` is. */
export const STAFF_TABS: readonly StaffTab[] = [
  'members',
  'attendance',
  'payroll',
  'performance',
];

/** Narrow an untrusted `?tab=` value, so a bad link lands somewhere sensible. */
export function parseStaffTab(value: string | undefined): StaffTab {
  return STAFF_TABS.includes(value as StaffTab) ? (value as StaffTab) : 'members';
}
