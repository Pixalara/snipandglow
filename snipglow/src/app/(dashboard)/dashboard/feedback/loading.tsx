export default function FeedbackLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="rounded-2xl bg-muted/40 h-24" />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-xl bg-muted/40 h-20" />
        ))}
      </div>
      <div className="rounded-xl bg-muted/40 h-64" />
    </div>
  );
}
