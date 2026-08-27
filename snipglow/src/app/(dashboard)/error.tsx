'use client';

import { DashboardErrorState } from '@/components/dashboard-error-state';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  console.error('[DashboardError]', error.message, error.digest, error.stack);
  return <DashboardErrorState error={error} reset={reset} />;
}
