import { LoadingSkeleton } from '@/components/loading-skeleton';

export default function AppointmentsLoading() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <LoadingSkeleton className="h-8 w-48" />
        <div className="flex items-center gap-2">
          <LoadingSkeleton className="h-8 w-28" />
          <LoadingSkeleton className="h-8 w-20" />
          <LoadingSkeleton className="h-8 w-28" />
        </div>
      </div>
      <LoadingSkeleton variant="table" />
    </div>
  );
}
