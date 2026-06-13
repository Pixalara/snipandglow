// Top-level loading skeleton for the first render of any dashboard route while
// the layout server component is fetching auth + subscription data.
export default function DashboardLoading() {
  return (
    <div className="flex min-h-screen animate-pulse">
      {/* Sidebar placeholder */}
      <div className="hidden md:flex w-64 shrink-0 flex-col border-r border-border bg-card">
        <div className="h-14 border-b border-border" />
        <div className="flex-1 p-3 space-y-4 pt-6">
          {[1, 2, 3].map((g) => (
            <div key={g} className="space-y-1.5">
              <div className="h-3 w-16 rounded bg-muted mx-3 mb-2" />
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-9 rounded-lg bg-muted mx-1" />
              ))}
            </div>
          ))}
        </div>
      </div>
      {/* Main area */}
      <div className="flex flex-1 flex-col min-w-0">
        <div className="h-14 shrink-0 border-b border-border bg-card" />
        <main className="flex-1 p-4 md:p-6">
          <div className="mx-auto max-w-7xl space-y-6">
            <div className="h-24 rounded-2xl bg-muted" />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => <div key={i} className="h-24 rounded-xl bg-muted" />)}
            </div>
            <div className="h-64 rounded-xl bg-muted" />
          </div>
        </main>
      </div>
    </div>
  );
}
