import { LoadingSkeleton } from '@/components/loading-skeleton';

export default function AnalyticsLoading() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <LoadingSkeleton className="h-8 w-32" />
        <div className="flex gap-2">
          <LoadingSkeleton className="h-8 w-24" />
          <LoadingSkeleton className="h-8 w-24" />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <LoadingSkeleton variant="card" />
        <LoadingSkeleton variant="card" />
        <LoadingSkeleton variant="card" />
        <LoadingSkeleton variant="card" />
      </div>
      <LoadingSkeleton variant="chart" />
    </div>
  );
}
