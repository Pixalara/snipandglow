import { LoadingSkeleton } from '@/components/loading-skeleton';

export default function DashboardLoading() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <LoadingSkeleton variant="card" />
      <LoadingSkeleton variant="card" />
      <LoadingSkeleton variant="card" />
      <LoadingSkeleton variant="card" className="sm:col-span-2 lg:col-span-3" />
    </div>
  );
}
