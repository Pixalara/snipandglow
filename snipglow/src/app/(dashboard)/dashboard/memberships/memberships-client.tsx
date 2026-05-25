'use client';

import { useState, useTransition } from 'react';
import { formatINR } from '@/lib/utils';
import { RoleGuard } from '@/components/role-guard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MembershipForm } from './membership-form';
import { deleteMembership, updateLoyaltyTiers } from './actions';
import {
  Crown,
  Plus,
  Calendar,
  Percent,
  IndianRupee,
  Pencil,
  Trash2,
  Sparkles,
  Award,
  CheckCircle2,
  AlertTriangle,
  Settings2,
} from 'lucide-react';
import type { Membership, UserRole } from '@/types';
import type { LoyaltyTierConfig } from '@/lib/loyalty';

// =============================================================================
// MembershipsClient — Interactive client wrapper for memberships page
// Requirements: 8.1, 8.5
// =============================================================================

interface MembershipsClientProps {
  memberships: Membership[];
  activeMembershipCount: number;
  role: UserRole;
  loyaltyConfig: LoyaltyTierConfig;
}

export function MembershipsClient({ memberships, activeMembershipCount, role, loyaltyConfig }: MembershipsClientProps) {
  const [showForm, setShowForm] = useState(false);
  const [editingMembership, setEditingMembership] = useState<Membership | undefined>(undefined);
  const [deleteTarget, setDeleteTarget] = useState<Membership | null>(null);
  const [deleteError, setDeleteError] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  function handleEdit(membership: Membership) {
    setEditingMembership(membership);
    setShowForm(true);
  }

  function handleCloseForm() {
    setShowForm(false);
    setEditingMembership(undefined);
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    setIsDeleting(true);
    setDeleteError('');

    const result = await deleteMembership(deleteTarget.id);

    setIsDeleting(false);

    if (!result.success) {
      setDeleteError(result.error);
      return;
    }

    setDeleteTarget(null);
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-salon-gold/10 via-salon-gold/5 to-transparent border border-salon-gold/20 p-6">
        <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-xl bg-salon-gold/10">
              <Crown className="size-5 text-salon-gold" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-foreground">Memberships</h1>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 dark:bg-emerald-900/30 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                  <Award className="size-3" />
                  {activeMembershipCount} active
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                {memberships.length} membership plan{memberships.length !== 1 ? 's' : ''} configured
              </p>
            </div>
          </div>
          <RoleGuard role={role} action="create" resource="memberships">
            <Button onClick={() => setShowForm(true)} className="rounded-xl gap-1.5">
              <Plus className="size-4" />
              Add Plan
            </Button>
          </RoleGuard>
        </div>
        <div className="absolute -right-6 -top-6 h-32 w-32 rounded-full bg-salon-gold/5" />
        <div className="absolute -right-2 top-10 h-20 w-20 rounded-full bg-salon-rose/5" />
      </div>

      {/* Empty state */}
      {memberships.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-card p-12 text-center">
          <div className="flex size-14 items-center justify-center rounded-full bg-salon-gold/10 mb-4">
            <Sparkles className="size-6 text-salon-gold" />
          </div>
          <h3 className="text-base font-semibold text-foreground">No membership plans yet</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm">
            Create your first membership plan to offer exclusive discounts and build customer loyalty.
          </p>
          <RoleGuard role={role} action="create" resource="memberships">
            <Button onClick={() => setShowForm(true)} className="mt-4 rounded-xl gap-1.5" variant="outline">
              <Plus className="size-4" />
              Create First Plan
            </Button>
          </RoleGuard>
        </div>
      )}

      {/* Membership plans grid */}
      {memberships.length > 0 && (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {memberships.map((membership) => (
            <MembershipCard
              key={membership.id}
              membership={membership}
              role={role}
              onEdit={() => handleEdit(membership)}
              onDelete={() => {
                setDeleteTarget(membership);
                setDeleteError('');
              }}
            />
          ))}
        </div>
      )}

      {/* Loyalty Tier Settings */}
      <LoyaltyTierSettings config={loyaltyConfig} role={role} />

      {/* Create/Edit Modal */}
      {showForm && (
        <Modal onClose={handleCloseForm}>
          <MembershipForm membership={editingMembership} onClose={handleCloseForm} />
        </Modal>
      )}

      {/* Delete Confirmation Dialog */}
      {deleteTarget && (
        <Modal onClose={() => setDeleteTarget(null)}>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/20">
                <Trash2 className="size-5 text-red-600 dark:text-red-400" />
              </div>
              <h2 className="text-lg font-semibold text-foreground">Delete Membership Plan</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              Are you sure you want to delete <span className="font-medium text-foreground">{deleteTarget.name}</span>?
              This will deactivate the plan. Existing customer memberships will remain active until they expire.
            </p>
            {deleteError && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-900/50 dark:bg-amber-900/20">
                <p className="text-sm text-amber-800 dark:text-amber-200">{deleteError}</p>
              </div>
            )}
            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                variant="outline"
                className="rounded-xl"
                onClick={() => setDeleteTarget(null)}
                disabled={isDeleting}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                className="rounded-xl"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// =============================================================================
// Loyalty Tier Settings Card
// =============================================================================

function LoyaltyTierSettings({ config, role }: { config: LoyaltyTierConfig; role: UserRole }) {
  const [isPending, startTransition] = useTransition();
  const [isEditing, setIsEditing] = useState(false);
  const [regularMin, setRegularMin] = useState(config.regular_min);
  const [silverMin, setSilverMin] = useState(config.silver_min);
  const [goldMin, setGoldMin] = useState(config.gold_min);
  const [vipMin, setVipMin] = useState(config.vip_min);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  function handleCancel() {
    setRegularMin(config.regular_min);
    setSilverMin(config.silver_min);
    setGoldMin(config.gold_min);
    setVipMin(config.vip_min);
    setError('');
    setIsEditing(false);
  }

  function handleSave() {
    setError('');
    setSuccess(false);
    startTransition(async () => {
      const result = await updateLoyaltyTiers({
        regular_min: regularMin,
        silver_min: silverMin,
        gold_min: goldMin,
        vip_min: vipMin,
      });
      if (result.success) {
        setSuccess(true);
        setIsEditing(false);
        setTimeout(() => setSuccess(false), 3000);
      } else {
        setError(result.error);
      }
    });
  }

  const tiers = [
    { emoji: '🆕', label: 'New', desc: '0 visits', value: 0, fixed: true, color: 'text-blue-600' },
    { emoji: '👤', label: 'Regular', desc: `${regularMin}+ visits`, value: regularMin, fixed: false, setter: setRegularMin, color: 'text-slate-600' },
    { emoji: '🥈', label: 'Silver', desc: `${silverMin}+ visits`, value: silverMin, fixed: false, setter: setSilverMin, color: 'text-gray-600' },
    { emoji: '🥇', label: 'Gold', desc: `${goldMin}+ visits`, value: goldMin, fixed: false, setter: setGoldMin, color: 'text-amber-600' },
    { emoji: '💎', label: 'VIP', desc: `${vipMin}+ visits`, value: vipMin, fixed: false, setter: setVipMin, color: 'text-purple-600' },
  ];

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="border-b border-border px-6 py-4 bg-muted/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Settings2 className="size-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold text-foreground">Loyalty Tier Thresholds</h2>
          </div>
          {role === 'owner' && !isEditing && (
            <button
              onClick={() => setIsEditing(true)}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <Pencil className="size-3" />
              Edit
            </button>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Set how many visits a customer needs to reach each loyalty tier.
        </p>
      </div>
      <div className="p-6 space-y-5">
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {tiers.map((tier) => (
            <div key={tier.label} className="flex flex-col items-center gap-2 rounded-xl border border-border bg-muted/30 p-4 text-center">
              <span className="text-2xl">{tier.emoji}</span>
              <p className={`text-sm font-bold ${tier.color}`}>{tier.label}</p>
              {tier.fixed ? (
                <p className="text-xs text-muted-foreground">0 visits</p>
              ) : isEditing ? (
                <div className="w-full space-y-1">
                  <p className="text-[10px] text-muted-foreground">Starts at</p>
                  <Input
                    type="number"
                    min={1}
                    max={999}
                    value={tier.value}
                    onChange={(e) => tier.setter?.(Number(e.target.value))}
                    className="h-8 text-center text-sm font-semibold"
                  />
                  <p className="text-[10px] text-muted-foreground">visits</p>
                </div>
              ) : (
                <p className="text-sm font-semibold text-foreground">{tier.value}+ visits</p>
              )}
            </div>
          ))}
        </div>

        {/* Visual flow */}
        <div className="flex items-center gap-1 text-xs text-muted-foreground flex-wrap">
          <span className="font-medium text-blue-600">🆕 New (0)</span>
          <span>→</span>
          <span className="font-medium text-slate-600">👤 Regular ({regularMin}+)</span>
          <span>→</span>
          <span className="font-medium text-gray-600">🥈 Silver ({silverMin}+)</span>
          <span>→</span>
          <span className="font-medium text-amber-600">🥇 Gold ({goldMin}+)</span>
          <span>→</span>
          <span className="font-medium text-purple-600">💎 VIP ({vipMin}+)</span>
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 dark:border-red-900/50 dark:bg-red-900/20">
            <AlertTriangle className="size-4 text-red-600 shrink-0" />
            <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
          </div>
        )}
        {success && (
          <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-900/50 dark:bg-emerald-900/20">
            <CheckCircle2 className="size-4 text-emerald-600" />
            <p className="text-sm text-emerald-800 dark:text-emerald-200">Loyalty tiers saved!</p>
          </div>
        )}

        {isEditing && (
          <div className="flex items-center gap-2">
            <Button className="rounded-xl" onClick={handleSave} disabled={isPending}>
              {isPending ? 'Saving...' : 'Save Tier Settings'}
            </Button>
            <Button variant="outline" className="rounded-xl" onClick={handleCancel} disabled={isPending}>
              Cancel
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// MembershipCard — Individual membership plan display card
// =============================================================================

interface MembershipCardProps {
  membership: Membership;
  role: UserRole;
  onEdit: () => void;
  onDelete: () => void;
}

function MembershipCard({ membership, role, onEdit, onDelete }: MembershipCardProps) {
  return (
    <div className="group relative overflow-hidden rounded-xl border border-border bg-card transition-all hover:shadow-md hover:border-border/80 hover:-translate-y-0.5">
      {/* Top gradient accent */}
      <div className="h-1 bg-gradient-to-r from-salon-gold via-salon-rose to-salon-gold" />

      <div className="relative p-5 space-y-4">
        <div className="absolute inset-0 bg-gradient-to-br from-salon-gold/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

        <div className="relative">
          {/* Name and Price */}
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <h3 className="font-bold text-foreground truncate group-hover:text-salon-gold transition-colors text-lg">
                {membership.name}
              </h3>
              {membership.description && (
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                  {membership.description}
                </p>
              )}
            </div>
          </div>

          {/* Price highlight */}
          <div className="mt-3 flex items-baseline gap-1">
            <span className="text-2xl font-bold text-foreground">{formatINR(membership.price)}</span>
          </div>

          {/* Feature badges */}
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-blue-50 dark:bg-blue-900/20 px-2.5 py-1 text-xs font-medium text-blue-700 dark:text-blue-400">
              <Calendar className="size-3" />
              {membership.validity_days} days
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
              <Percent className="size-3" />
              {membership.discount_pct}% off
            </span>
          </div>

          {/* Edit/Delete buttons — owner only */}
          <RoleGuard role={role} action="update" resource="memberships">
            <div className="flex items-center gap-2 pt-3 mt-4 border-t border-border">
              <Button variant="ghost" size="sm" className="rounded-lg gap-1.5 text-xs" onClick={onEdit}>
                <Pencil className="size-3" />
                Edit
              </Button>
              <RoleGuard role={role} action="delete" resource="memberships">
                <Button variant="ghost" size="sm" className="rounded-lg gap-1.5 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20" onClick={onDelete}>
                  <Trash2 className="size-3" />
                  Delete
                </Button>
              </RoleGuard>
            </div>
          </RoleGuard>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Modal — Simple overlay modal component
// =============================================================================

interface ModalProps {
  children: React.ReactNode;
  onClose: () => void;
}

function Modal({ children, onClose }: ModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      {/* Content */}
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl mx-4 max-h-[90vh] overflow-y-auto">
        {children}
      </div>
    </div>
  );
}
