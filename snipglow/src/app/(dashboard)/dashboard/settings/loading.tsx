import { LoadingSkeleton } from '@/components/loading-skeleton';

export default function SettingsLoading() {
  return (
    <div className="space-y-6">
      <LoadingSkeleton className="h-8 w-28" />
      <LoadingSkeleton variant="card" />
      <LoadingSkeleton variant="card" />
    </div>
  );
}
