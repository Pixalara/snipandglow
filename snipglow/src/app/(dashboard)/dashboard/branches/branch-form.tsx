'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { createBranch, updateBranch } from './actions';
import type { Branch, OperatingHours } from '@/types';

// =============================================================================
// BranchForm — Client component for create/edit modal
// =============================================================================

interface BranchFormProps {
  /** If provided, the form is in edit mode */
  branch?: Branch;
  /** Called when the form is submitted successfully or cancelled */
  onClose: () => void;
}

export function BranchForm({ branch, onClose }: BranchFormProps) {
  const isEditing = !!branch;

  const [name, setName] = useState(branch?.name ?? '');
  const [address, setAddress] = useState(branch?.address ?? '');
  const [phone, setPhone] = useState(branch?.phone ?? '');
  const [openTime, setOpenTime] = useState(
    branch?.operating_hours?.mon?.open ?? '09:00'
  );
  const [closeTime, setCloseTime] = useState(
    branch?.operating_hours?.mon?.close ?? '21:00'
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    if (!name.trim()) {
      setError('Branch name is required.');
      setIsSubmitting(false);
      return;
    }

    if (openTime >= closeTime) {
      setError('Opening time must be before closing time.');
      setIsSubmitting(false);
      return;
    }

    // Build operating hours (same hours for all days, simplified)
    const operatingHours: OperatingHours = {
      mon: { open: openTime, close: closeTime },
      tue: { open: openTime, close: closeTime },
      wed: { open: openTime, close: closeTime },
      thu: { open: openTime, close: closeTime },
      fri: { open: openTime, close: closeTime },
      sat: { open: openTime, close: closeTime },
      sun: { open: openTime, close: closeTime },
    };

    const input = {
      name: name.trim(),
      address: address.trim() || undefined,
      phone: phone.trim() || undefined,
      operating_hours: operatingHours,
    };

    const result = isEditing
      ? await updateBranch(branch.id, input)
      : await createBranch(input);

    setIsSubmitting(false);

    if (!result.success) {
      setError(result.error);
      return;
    }

    onClose();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h2 className="text-lg font-semibold text-foreground">
        {isEditing ? 'Edit Branch' : 'Add Branch'}
      </h2>

      {/* Name */}
      <div className="space-y-1.5">
        <label htmlFor="branch-name" className="text-sm font-medium text-foreground">
          Branch Name
        </label>
        <Input
          id="branch-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., Koramangala Branch"
          required
        />
      </div>

      {/* Address */}
      <div className="space-y-1.5">
        <label htmlFor="branch-address" className="text-sm font-medium text-foreground">
          Address
        </label>
        <Input
          id="branch-address"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="e.g., 123 MG Road, Bangalore"
        />
      </div>

      {/* Phone */}
      <div className="space-y-1.5">
        <label htmlFor="branch-phone" className="text-sm font-medium text-foreground">
          Phone
        </label>
        <Input
          id="branch-phone"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="e.g., 9876543210"
        />
      </div>

      {/* Operating Hours (simplified: open/close time) */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-foreground">
          Operating Hours
        </label>
        <div className="flex items-center gap-2">
          <Input
            type="time"
            value={openTime}
            onChange={(e) => setOpenTime(e.target.value)}
            className="flex-1"
          />
          <span className="text-sm text-muted-foreground">to</span>
          <Input
            type="time"
            value={closeTime}
            onChange={(e) => setCloseTime(e.target.value)}
            className="flex-1"
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Applied to all days of the week.
        </p>
      </div>

      {/* Error message */}
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      {/* Actions */}
      <div className="flex items-center justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? (
            <span className="flex items-center gap-1.5">
              <svg className="size-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Saving...
            </span>
          ) : isEditing ? (
            'Update Branch'
          ) : (
            'Add Branch'
          )}
        </Button>
      </div>
    </form>
  );
}
