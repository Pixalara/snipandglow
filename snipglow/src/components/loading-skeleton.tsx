import { cn } from '@/lib/utils';

type SkeletonVariant = 'table' | 'card' | 'chart' | 'list';

interface LoadingSkeletonProps {
  variant?: SkeletonVariant;
  className?: string;
}

function SkeletonPulse({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-md bg-muted', className)} />;
}

function TableSkeleton() {
  return (
    <div className="w-full space-y-3">
      {/* Header row */}
      <div className="flex gap-4 border-b border-border pb-3">
        <SkeletonPulse className="h-4 w-1/4" />
        <SkeletonPulse className="h-4 w-1/4" />
        <SkeletonPulse className="h-4 w-1/4" />
        <SkeletonPulse className="h-4 w-1/6" />
      </div>
      {/* Data rows */}
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex gap-4 py-2">
          <SkeletonPulse className="h-4 w-1/4" />
          <SkeletonPulse className="h-4 w-1/4" />
          <SkeletonPulse className="h-4 w-1/4" />
          <SkeletonPulse className="h-4 w-1/6" />
        </div>
      ))}
    </div>
  );
}

function CardSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-4">
      {/* Title area */}
      <SkeletonPulse className="h-5 w-2/5" />
      {/* Content area */}
      <div className="space-y-2">
        <SkeletonPulse className="h-4 w-full" />
        <SkeletonPulse className="h-4 w-3/4" />
      </div>
      {/* Footer area */}
      <SkeletonPulse className="h-8 w-1/3" />
    </div>
  );
}

function ChartSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-4">
      {/* Chart title */}
      <SkeletonPulse className="h-5 w-1/4" />
      {/* Chart area */}
      <SkeletonPulse className="h-48 w-full rounded-lg" />
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          {/* Avatar */}
          <SkeletonPulse className="size-10 shrink-0 rounded-full" />
          {/* Text lines */}
          <div className="flex-1 space-y-2">
            <SkeletonPulse className="h-4 w-2/5" />
            <SkeletonPulse className="h-3 w-3/5" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function LoadingSkeleton({ variant, className }: LoadingSkeletonProps) {
  return (
    <div className={cn('w-full', className)}>
      {variant === 'table' && <TableSkeleton />}
      {variant === 'card' && <CardSkeleton />}
      {variant === 'chart' && <ChartSkeleton />}
      {variant === 'list' && <ListSkeleton />}
      {!variant && <SkeletonPulse className="h-32 w-full" />}
    </div>
  );
}
