import { redirect } from 'next/navigation';

// =============================================================================
// Payroll moved into the unified Staff module.
//
// Attendance, timesheets, payroll and payslips are one workflow — hours are
// recorded, priced, paid, then evidenced on a payslip — so they now live behind
// one sidebar entry at /dashboard/staff instead of being split across two.
//
// This stub stays so existing bookmarks and any browser history still land in
// the right place. Nothing in the app links here any more.
// =============================================================================

export default function PayrollRedirectPage() {
  redirect('/dashboard/staff?tab=payroll');
}
