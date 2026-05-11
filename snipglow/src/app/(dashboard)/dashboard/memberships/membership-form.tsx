'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { createMembership, updateMembership } from './actions';
import type { Membership } from '@/types';

// =============================================================================
// MembershipForm — Client component for create/edit modal
// Requirements: 8.1
// =============================================================================

interface MembershipFormProps {
  /** If provided, the form is in edit mode */
  membership?: Membership;
  /** Called when the form is submitted successfully or cancelled */
  onClose: () => void;
}

export function MembershipForm({ membership, onClose }: MembershipFormProps) {
  const isEditing = !!membership;

  const [name, setName] = useState(membership?.name ?? '');
  const [description, setDescription] = useState(membership?.description ?? '');
  const [price, setPrice] = useState(membership?.price?.toString() ?? '');
  const [validityDays, setValidityDays] = useState(membership?.validity_days?.toString() ?? '');
  const [discountPct, setDiscountPct] = useState(membership?.discount_pct?.toString() ?? '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    // Client-side validation
    if (!name.trim()) {
      setError('Membership name is required.');
      setIsSubmitting(false);
      return;
    }
    if (!price || Number(price) < 0) {
      setError('Price must be a non-negative number.');
      setIsSubmitting(false);
      return;
    }
    if (!validityDays || Number(validityDays) < 1) {
      setError('Validity must be at least 1 day.');
      setIsSubmitting(false);
      return;
    }
    const discountVal = Number(discountPct);
    if (discountPct === '' || discountVal < 0 || discountVal > 100) {
      setError('Discount percentage must be between 0 and 100.');
      setIsSubmitting(false);
      return;
    }

    const input = {
      name: name.trim(),
      description: description.trim() || undefined,
      price: Number(price),
      validity_days: Number(validityDays),
      discount_pct: discountVal,
    };

    const result = isEditing
      ? await updateMembership(membership.id, input)
      : await createMembership(input);

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
        {isEditing ? 'Edit Membership Plan' : 'Add Membership Plan'}
      </h2>

      {/* Name */}
      <div className="space-y-1.5">
        <label htmlFor="membership-name" className="text-sm font-medium text-foreground">
          Name
        </label>
        <Input
          id="membership-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., Gold Monthly, Premium Quarterly"
          required
        />
      </div>

      {/* Description (optional) */}
      <div className="space-y-1.5">
        <label htmlFor="membership-description" className="text-sm font-medium text-foreground">
          Description <span className="text-muted-foreground">(optional)</span>
        </label>
        <Input
          id="membership-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="e.g., Unlimited blowdry + 10% off all services"
        />
      </div>

      {/* Price */}
      <div className="space-y-1.5">
        <label htmlFor="membership-price" className="text-sm font-medium text-foreground">
          Price (₹)
        </label>
        <Input
          id="membership-price"
          type="number"
          min={0}
          step="1"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          placeholder="e.g., 2999"
          required
        />
      </div>

      {/* Validity Days */}
      <div className="space-y-1.5">
        <label htmlFor="membership-validity" className="text-sm font-medium text-foreground">
          Validity (days)
        </label>
        <Input
          id="membership-validity"
          type="number"
          min={1}
          value={validityDays}
          onChange={(e) => setValidityDays(e.target.value)}
          placeholder="e.g., 30, 90, 365"
          required
        />
      </div>

      {/* Discount Percentage */}
      <div className="space-y-1.5">
        <label htmlFor="membership-discount" className="text-sm font-medium text-foreground">
          Discount (%)
        </label>
        <Input
          id="membership-discount"
          type="number"
          min={0}
          max={100}
          step="1"
          value={discountPct}
          onChange={(e) => setDiscountPct(e.target.value)}
          placeholder="e.g., 10, 15, 20"
          required
        />
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
            'Update Plan'
          ) : (
            'Add Plan'
          )}
        </Button>
      </div>
    </form>
  );
}
