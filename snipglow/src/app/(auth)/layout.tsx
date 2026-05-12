'use client';

import Link from 'next/link';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      {/* Minimal navbar */}
      <nav className="border-b border-slate-100 bg-white/95 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-lg font-bold tracking-tight">
              <span className="text-slate-900">snipand</span>
              <span className="bg-gradient-to-r from-pink-500 via-fuchsia-500 to-violet-500 bg-clip-text text-transparent">glow</span>
            </span>
          </Link>
          <Link href="/" className="text-sm text-slate-500 hover:text-slate-900 transition-colors">
            ← Back to home
          </Link>
        </div>
      </nav>

      {/* Content area */}
      <div className="flex-1 flex items-center justify-center px-4 py-12 relative overflow-hidden">
        {/* Background orbs */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-100/40 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-blue-100/30 rounded-full blur-3xl pointer-events-none" />

        <div className="relative w-full max-w-md">
          {children}
        </div>
      </div>
    </div>
  );
}
