import { LoadingSkeleton } from '@/components/loading-skeleton';

export default function StaffLoading() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <LoadingSkeleton className="h-8 w-24" />
        <LoadingSkeleton className="h-8 w-28" />
      </div>
      <LoadingSkeleton variant="table" />
    </div>
  );
}
