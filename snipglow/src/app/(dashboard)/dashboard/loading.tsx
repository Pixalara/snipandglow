export default function DashboardLoading() {
  return (
    <div className="space-y-8">
      {/* Hero skeleton */}
      <div className="skeleton-shimmer rounded-3xl bg-muted/50 h-36" />

      {/* KPI cards skeleton */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="skeleton-shimmer rounded-2xl bg-muted/50 h-28" />
        ))}
      </div>

      {/* Two-column content skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="skeleton-shimmer rounded-2xl bg-muted/50 h-20" />
            ))}
          </div>
          <div className="skeleton-shimmer rounded-2xl bg-muted/50 h-56" />
        </div>
        <div className="skeleton-shimmer rounded-2xl bg-muted/50 h-72" />
      </div>
    </div>
  );
}
