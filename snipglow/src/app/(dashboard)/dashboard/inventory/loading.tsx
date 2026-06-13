export default function InventoryLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="rounded-2xl bg-muted/50 h-24" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="rounded-xl bg-muted/50 h-24" />
        ))}
      </div>
      <div className="rounded-xl bg-muted/50 h-64" />
    </div>
  );
}
