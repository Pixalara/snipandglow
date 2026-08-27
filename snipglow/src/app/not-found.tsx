import Link from 'next/link';
import { FileQuestion } from 'lucide-react';

// =============================================================================
// Global 404.
//
// Without this file Next renders its own bare black-and-white 404, which sits
// outside the app shell: no sidebar, no branding, and no way back except the
// browser's back button. Following a link to a deleted customer or invoice is a
// completely ordinary thing to do, so it should not eject the user from the app.
// =============================================================================

export const metadata = {
  title: 'Page not found · SnipandGlow',
};

export default function NotFound() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-4 py-16 text-center">
      <div className="flex size-16 items-center justify-center rounded-2xl bg-muted">
        <FileQuestion className="size-8 text-muted-foreground" />
      </div>

      <h1 className="mt-6 text-2xl font-bold text-foreground">We couldn&apos;t find that page</h1>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        The link may be out of date, or the customer, invoice or appointment it pointed to may have
        been deleted. Nothing is wrong with your account.
      </p>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <Link
          href="/dashboard"
          className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-pink-600 to-fuchsia-600 px-6 py-3 text-sm font-semibold text-white shadow-lg transition-all hover:from-pink-500 hover:to-fuchsia-500"
        >
          Go to dashboard
        </Link>
        <Link
          href="/"
          className="inline-flex items-center justify-center rounded-xl border border-border bg-card px-6 py-3 text-sm font-medium text-foreground transition-colors hover:bg-muted"
        >
          Back to home
        </Link>
      </div>
    </div>
  );
}
