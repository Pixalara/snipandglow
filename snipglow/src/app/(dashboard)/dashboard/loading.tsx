export default function DashboardLoading() {
  return (
    <div className="space-y-6">
      {/* Header skeleton */}
      <div className="rounded-2xl bg-muted/40 h-24 animate-pulse" />
      {/* KPI cards skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="rounded-xl bg-muted/40 h-28 animate-pulse" style={{ animationDelay: `${i * 100}ms` }} />
        ))}
      </div>
      {/* Content skeleton */}
      <div className="rounded-xl bg-muted/40 h-64 animate-pulse" style={{ animationDelay: '400ms' }} />
    </div>
  );
}
