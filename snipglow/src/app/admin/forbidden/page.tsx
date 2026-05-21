import { Shield } from 'lucide-react';
import Link from 'next/link';

export const metadata = { title: 'Access Denied — SnipandGlow Admin' };

export default function AdminForbiddenPage() {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="text-center space-y-4 max-w-sm">
        <div className="inline-flex items-center justify-center size-16 rounded-2xl bg-red-900/20 border border-red-800/30">
          <Shield className="size-8 text-red-400" />
        </div>
        <h1 className="text-2xl font-bold text-white">Access Denied</h1>
        <p className="text-sm text-slate-400">
          You do not have permission to access the admin dashboard. This area is restricted to platform administrators only.
        </p>
        <Link href="/dashboard" className="inline-block px-4 py-2 text-sm font-medium text-white bg-slate-800 rounded-lg hover:bg-slate-700 transition-colors">
          Go to Dashboard
        </Link>
      </div>
    </div>
  );
}
