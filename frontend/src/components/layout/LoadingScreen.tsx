// Snip & Glow — Loading Screen Component

export default function LoadingScreen() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 bg-bg">
      {/* Animated Logo */}
      <div className="relative">
        <div className="w-20 h-20 rounded-2xl flex items-center justify-center shadow-2xl animate-pulse-glow overflow-hidden">
          <img src="/pingflow-logo.svg" alt="Snip & Glow" width="80" height="80" />
        </div>
        {/* Rotating ring */}
        <div className="absolute -inset-3 rounded-3xl border-2 border-transparent border-t-primary animate-spin" style={{ animationDuration: '1.5s' }} />
      </div>

      {/* Brand */}
      <div className="text-center animate-fade-in">
        <h1 className="text-2xl font-bold text-text-primary tracking-tight">Snip & Glow</h1>
        <p className="text-text-dim text-sm mt-1">Loading your salon...</p>
      </div>

      {/* Loading bar */}
      <div className="w-48 h-1 bg-surface-2 rounded-full overflow-hidden">
        <div className="h-full bg-gradient-to-r from-primary to-primary-light rounded-full animate-shimmer" style={{ width: '60%' }} />
      </div>
    </div>
  );
}
