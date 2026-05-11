import { LoadingSkeleton } from '@/components/loading-skeleton';

export default function BillingLoading() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <LoadingSkeleton className="h-8 w-32" />
        <LoadingSkeleton className="h-8 w-24" />
      </div>
      <LoadingSkeleton variant="table" />
    </div>
  );
}
