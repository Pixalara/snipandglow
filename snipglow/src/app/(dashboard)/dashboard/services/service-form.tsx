'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { createService, updateService } from './actions';
import type { Service } from '@/types';

// =============================================================================
// Predefined service categories
// =============================================================================

const PREDEFINED_CATEGORIES = ['Hair', 'Skin', 'Nails', 'Spa', 'Makeup', 'Other'] as const;

// =============================================================================
// ServiceForm — Client component for create/edit modal
// =============================================================================

interface ServiceFormProps {
  /** If provided, the form is in edit mode */
  service?: Service;
  /** Called when the form is submitted successfully or cancelled */
  onClose: () => void;
}

export function ServiceForm({ service, onClose }: ServiceFormProps) {
  const isEditing = !!service;

  // Determine if the existing service category is predefined or custom
  const existingIsPredefined = service
    ? PREDEFINED_CATEGORIES.includes(service.category as (typeof PREDEFINED_CATEGORIES)[number])
    : true;

  const [name, setName] = useState(service?.name ?? '');
  const [category, setCategory] = useState(
    service ? (existingIsPredefined ? service.category : '__custom__') : ''
  );
  const [customCategory, setCustomCategory] = useState(
    service && !existingIsPredefined ? service.category : ''
  );
  const [durationMinutes, setDurationMinutes] = useState(
    service?.duration_minutes?.toString() ?? ''
  );
  const [price, setPrice] = useState(service?.price?.toString() ?? '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const showCustomInput = category === '__custom__';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    const finalCategory = showCustomInput ? customCategory.trim() : category;

    if (!name.trim()) {
      setError('Service name is required.');
      setIsSubmitting(false);
      return;
    }
    if (!finalCategory) {
      setError('Category is required.');
      setIsSubmitting(false);
      return;
    }
    // Duration is hidden from the UI (multiple bookings allowed per slot).
    // Default to 30 minutes when not set — used only as an internal placeholder.
    const finalDuration = durationMinutes && Number(durationMinutes) >= 1 ? Number(durationMinutes) : 30;
    if (!price || Number(price) < 0) {
      setError('Price must be a non-negative number.');
      setIsSubmitting(false);
      return;
    }

    const input = {
      name: name.trim(),
      category: finalCategory,
      duration_minutes: finalDuration,
      price: Number(price),
    };

    const result = isEditing
      ? await updateService(service.id, input)
      : await createService(input);

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
        {isEditing ? 'Edit Service' : 'Add Service'}
      </h2>

      {/* Service Name */}
      <div className="space-y-1.5">
        <label htmlFor="service-name" className="text-sm font-medium text-foreground">
          Name
        </label>
        <Input
          id="service-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., Haircut, Facial, Manicure"
          required
        />
      </div>

      {/* Category */}
      <div className="space-y-1.5">
        <label htmlFor="service-category" className="text-sm font-medium text-foreground">
          Category
        </label>
        <select
          id="service-category"
          value={category}
          onChange={(e) => {
            const val = e.target.value;
            setCategory(val);
            if (val !== '__custom__') {
              setCustomCategory('');
            }
          }}
          className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
          required
        >
          <option value="" disabled>
            Select category
          </option>
          {PREDEFINED_CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
          <option value="__custom__">Custom...</option>
        </select>
        {showCustomInput && (
          <Input
            value={customCategory}
            onChange={(e) => setCustomCategory(e.target.value)}
            placeholder="Enter custom category"
            required
          />
        )}
      </div>

      {/* Duration — hidden, defaults to 30 min (not relevant when multiple bookings per slot allowed) */}

      {/* Price */}
      <div className="space-y-1.5">
        <label htmlFor="service-price" className="text-sm font-medium text-foreground">
          Price (₹)
        </label>
        <Input
          id="service-price"
          type="number"
          min={0}
          step="1"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          placeholder="e.g., 500"
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
            'Update Service'
          ) : (
            'Add Service'
          )}
        </Button>
      </div>
    </form>
  );
}
