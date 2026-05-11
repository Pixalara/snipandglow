import { LoadingSkeleton } from '@/components/loading-skeleton';

export default function AuditLogLoading() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <LoadingSkeleton className="h-8 w-32" />
        <div className="flex gap-2">
          <LoadingSkeleton className="h-8 w-28" />
          <LoadingSkeleton className="h-8 w-20" />
        </div>
      </div>
      <LoadingSkeleton variant="table" />
    </div>
  );
}
