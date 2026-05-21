'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2, AlertTriangle, Shield } from 'lucide-react';
import { forceDeleteTenant } from './actions';

interface Props {
  tenants: any[];
  previewData: any;
  preselectedId?: string;
}

export function ForceDeleteClient({ tenants, previewData, preselectedId }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selectedId, setSelectedId] = useState(preselectedId || '');
  const [confirmName, setConfirmName] = useState('');
  const [understood, setUnderstood] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const selectedTenant = tenants.find((t) => t.id === selectedId);

  function handleSelectTenant(id: string) {
    setSelectedId(id);
    setConfirmName('');
    setUnderstood(false);
    setError('');
    setSuccess('');
    if (id) router.push(`/admin/force-delete?tenant=${id}`);
  }

  function handleDelete() {
    if (!selectedTenant) return;
    if (confirmName.trim() !== selectedTenant.name.trim()) {
      setError('Tenant name does not match. Please type the exact name.');
      return;
    }
    if (!understood) {
      setError('Please confirm you understand this action is permanent.');
      return;
    }

    setError('');
    startTransition(async () => {
      const result = await forceDeleteTenant(selectedId);
      if (result.success) {
        setSuccess(`Tenant "${selectedTenant.name}" (${selectedTenant.tenant_code}) has been permanently deleted.`);
        setSelectedId('');
        setConfirmName('');
        setUnderstood(false);
      } else {
        setError(result.error || 'Deletion failed.');
      }
    });
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Trash2 className="size-6 text-red-400" />
          Force Delete Tenant
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Permanently delete a tenant and ALL related data. This cannot be undone.
        </p>
      </div>

      {/* Warning */}
      <div className="rounded-xl border border-red-800/50 bg-red-950/30 p-4 flex items-start gap-3">
        <AlertTriangle className="size-5 text-red-400 shrink-0 mt-0.5" />
        <div className="text-sm text-red-300">
          <p className="font-semibold">Danger Zone</p>
          <p className="mt-1 text-red-400">This will permanently delete the tenant, all branches, staff, customers, appointments, invoices, services, WhatsApp settings, audit logs, and auth users. There is no recovery.</p>
        </div>
      </div>

      {success && (
        <div className="rounded-xl border border-emerald-800/50 bg-emerald-950/30 p-4 text-sm text-emerald-300">
          ✅ {success}
        </div>
      )}

      {/* Select Tenant */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-300">Select Tenant</label>
        <select
          value={selectedId}
          onChange={(e) => handleSelectTenant(e.target.value)}
          className="w-full h-10 rounded-lg border border-slate-700 bg-slate-800 px-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-red-500/30"
        >
          <option value="">Choose a tenant...</option>
          {tenants.map((t) => (
            <option key={t.id} value={t.id}>{t.tenant_code} — {t.name} ({t.subscription_status})</option>
          ))}
        </select>
      </div>

      {/* Preview */}
      {previewData && selectedTenant && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 space-y-3">
          <h3 className="text-sm font-semibold text-white">Data to be deleted:</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
            <div className="text-slate-400">Branches: <span className="text-white font-medium">{previewData.branches}</span></div>
            <div className="text-slate-400">Staff: <span className="text-white font-medium">{previewData.staff}</span></div>
            <div className="text-slate-400">Services: <span className="text-white font-medium">{previewData.services}</span></div>
            <div className="text-slate-400">Customers: <span className="text-white font-medium">{previewData.customers}</span></div>
            <div className="text-slate-400">Appointments: <span className="text-white font-medium">{previewData.appointments}</span></div>
            <div className="text-slate-400">Auth Users: <span className="text-white font-medium">{previewData.staff}</span></div>
          </div>
        </div>
      )}

      {/* Confirmation */}
      {selectedTenant && (
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">
              Type the tenant name to confirm: <span className="text-red-400 font-bold">{selectedTenant.name}</span>
            </label>
            <input
              type="text"
              value={confirmName}
              onChange={(e) => setConfirmName(e.target.value)}
              placeholder={selectedTenant.name}
              className="w-full h-10 rounded-lg border border-slate-700 bg-slate-800 px-3 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-red-500/30"
            />
          </div>

          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={understood}
              onChange={(e) => setUnderstood(e.target.checked)}
              className="mt-0.5 size-4 rounded border-slate-600 bg-slate-800 text-red-500 focus:ring-red-500/30"
            />
            <span className="text-sm text-slate-300">
              I understand this permanently deletes this tenant and all related auth/user data. This action cannot be undone.
            </span>
          </label>

          {error && (
            <div className="rounded-lg border border-red-800/50 bg-red-950/30 px-4 py-2 text-sm text-red-400">
              {error}
            </div>
          )}

          <button
            onClick={handleDelete}
            disabled={isPending || !understood || confirmName.trim() !== selectedTenant.name.trim()}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-red-600 text-white font-medium text-sm hover:bg-red-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Trash2 className="size-4" />
            {isPending ? 'Deleting...' : 'Permanently Delete Tenant'}
          </button>
        </div>
      )}
    </div>
  );
}
