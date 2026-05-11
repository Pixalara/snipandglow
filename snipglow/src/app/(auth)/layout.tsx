'use client';

import { Scissors } from 'lucide-react';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-salon-cream via-salon-rose-light to-salon-lavender-light px-4">
      <div className="mb-6 flex items-center gap-2 text-primary">
        <Scissors className="size-7" />
        <span className="text-2xl font-bold tracking-tight">Snip &amp; Glow</span>
      </div>
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}
