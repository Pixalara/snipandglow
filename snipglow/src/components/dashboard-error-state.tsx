'use client';

import Link from 'next/link';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button, buttonVariants } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';

// =============================================================================
// Shared dashboard error state.
//
// (dashboard)/error.tsx and (dashboard)/dashboard/error.tsx were byte-identical
// 36-line copies. They now both render this, so the copy can't drift.
//
// Two behaviours worth noting:
//
//   • `reset()` re-runs the same failing render. When the cause is persistent
//     (an expired session, an RLS misconfiguration) that is an infinite retry
//     loop, so there is always a link out of the segment as well.
//   • In production Next redacts server-component error messages, so
//     `error.message` is usually empty. The fallback copy has to stand on its
//     own rather than assuming a message is present.
// =============================================================================

export function DashboardErrorState({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[400px] items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="size-5" />
            Something went wrong
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {error.message || 'This page could not be loaded. Your data is safe.'}
          </p>
          {/* The digest is the only handle support has on a redacted production
              error, so make it available rather than console-only. */}
          {error.digest && (
            <p className="text-xs text-muted-foreground">
              Reference: <span className="font-mono">{error.digest}</span>
            </p>
          )}
        </CardContent>
        <CardFooter className="flex flex-wrap gap-2">
          <Button onClick={reset} variant="outline">
            Try again
          </Button>
          {/* Escape hatch: retrying a persistent failure never succeeds.
              Styled as a link rather than nesting a Button, because this
              Button wraps a Base UI primitive that has no asChild prop. */}
          <Link href="/dashboard" className={buttonVariants({ variant: 'ghost' })}>
            Go to dashboard
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}
