'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { updateGstSettings, updateSalonProfile, updateDiscountSettings } from './actions';
import { Receipt, CheckCircle2, AlertTriangle, Scissors, Phone, Mail, MapPin, User, Clock, Pencil, Percent } from 'lucide-react';

// =============================================================================
// Salon Profile Card
// =============================================================================

interface SalonProfileProps {
  profile: {
    salonName: string;
    ownerName: string;
    phone: string;
    email: string;
    branchName: string;
    address: string;
    operatingHours: Record<string, { open: string; close: string }> | null;
  };
}

export function SalonProfileCard({ profile }: SalonProfileProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [salonName, setSalonName] = useState(profile.salonName);
  const [ownerName, setOwnerName] = useState(profile.ownerName);
  const [phone, setPhone] = useState(profile.phone);
  const [address, setAddress] = useState(profile.address);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // Format operating hours for display
  const hours = profile.operatingHours;
  const firstDay = hours ? Object.values(hours).find((h) => h?.open) : null;
  const hoursDisplay = firstDay ? `${firstDay.open} – ${firstDay.close}` : 'Not set';

  function handleSave() {
    setError('');
    setSuccess(false);
    startTransition(async () => {
      const result = await updateSalonProfile({
        salon_name: salonName.trim(),
        owner_name: ownerName.trim(),
        phone: phone.trim(),
        address: address.trim(),
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

  function handleCancel() {
    setSalonName(profile.salonName);
    setOwnerName(profile.ownerName);
    setPhone(profile.phone);
    setAddress(profile.address);
    setIsEditing(false);
    setError('');
  }

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="border-b border-border px-6 py-4 bg-muted/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Scissors className="size-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold text-foreground">Salon Profile</h2>
          </div>
          {!isEditing && (
            <button
              onClick={() => setIsEditing(true)}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <Pencil className="size-3" />
              Edit
            </button>
          )}
        </div>
      </div>
      <div className="p-6">
        {success && (
          <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-900/50 dark:bg-emerald-900/20 mb-4">
            <CheckCircle2 className="size-4 text-emerald-600" />
            <p className="text-sm text-emerald-800 dark:text-emerald-200">Profile updated!</p>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 dark:border-red-900/50 dark:bg-red-900/20 mb-4">
            <AlertTriangle className="size-4 text-red-600" />
            <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
          </div>
        )}

        {isEditing ? (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Salon Name</label>
                <Input value={salonName} onChange={(e) => setSalonName(e.target.value)} placeholder="Salon name" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Owner Name</label>
                <Input value={ownerName} onChange={(e) => setOwnerName(e.target.value)} placeholder="Owner name" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Phone</label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone number" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Email</label>
                <Input value={profile.email} disabled className="opacity-60" />
                <p className="text-xs text-muted-foreground">Email is linked to your Google account</p>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Address</label>
              <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Salon address" />
            </div>
            <div className="flex items-center gap-2 pt-2">
              <Button className="rounded-xl" onClick={handleSave} disabled={isPending}>
                {isPending ? 'Saving...' : 'Save Changes'}
              </Button>
              <Button variant="outline" className="rounded-xl" onClick={handleCancel} disabled={isPending}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <ProfileField icon={<Scissors className="size-3.5" />} label="Salon Name" value={profile.salonName} />
            <ProfileField icon={<User className="size-3.5" />} label="Owner" value={profile.ownerName} />
            <ProfileField icon={<Phone className="size-3.5" />} label="Phone" value={profile.phone} />
            <ProfileField icon={<Mail className="size-3.5" />} label="Email" value={profile.email} />
            <ProfileField icon={<MapPin className="size-3.5" />} label="Address" value={profile.address || 'Not set'} />
            <ProfileField icon={<Clock className="size-3.5" />} label="Operating Hours" value={hoursDisplay} />
          </div>
        )}
      </div>
    </div>
  );
}

function ProfileField({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 rounded-lg bg-muted/30 px-4 py-3">
      <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-background text-muted-foreground">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium text-foreground truncate">{value}</p>
      </div>
    </div>
  );
}

interface GstSettingsProps {
  currentGstNumber: string;
  currentGstRate: number;
  gstEnabled: boolean;
}

/** Validate Indian GSTIN format: 2-digit state code + 10-char PAN + 1 entity + 1 Z + 1 check */
function isValidGSTIN(gstin: string): boolean {
  if (!gstin.trim()) return true; // Empty is valid (means GST disabled)
  const pattern = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
  return pattern.test(gstin.trim().toUpperCase());
}

export function GstSettingsCard({ currentGstNumber, currentGstRate, gstEnabled }: GstSettingsProps) {
  const [isPending, startTransition] = useTransition();
  const [gstNumber, setGstNumber] = useState(currentGstNumber);
  const [gstRate, setGstRate] = useState(currentGstRate || 18);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const hasGst = gstNumber.trim().length > 0;
  const isValid = isValidGSTIN(gstNumber);

  function handleSave() {
    setError('');
    setSuccess(false);

    if (gstNumber.trim() && !isValidGSTIN(gstNumber)) {
      setError('Please enter a valid 15-character GSTIN (e.g., 29ABCDE1234F1Z5)');
      return;
    }

    startTransition(async () => {
      const result = await updateGstSettings({
        gst_number: gstNumber.trim().toUpperCase() || null,
        gst_rate: gstNumber.trim() ? gstRate : 0,
        gst_enabled: !!gstNumber.trim(),
      });

      if (result.success) {
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      } else {
        setError(result.error);
      }
    });
  }

  function handleClear() {
    setGstNumber('');
    setGstRate(18);
  }

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="border-b border-border px-6 py-4 bg-muted/30">
        <div className="flex items-center gap-2">
          <Receipt className="size-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground">GST Configuration</h2>
          {gstEnabled && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 dark:bg-emerald-900/30 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 className="size-3" />
              Active
            </span>
          )}
        </div>
      </div>
      <div className="p-6 space-y-5">
        <p className="text-sm text-muted-foreground">
          Add your GSTIN to automatically apply GST on all invoices. Leave empty to disable GST.
        </p>

        {/* GST Number */}
        <div className="space-y-2">
          <label htmlFor="gst-number" className="text-sm font-medium text-foreground">
            GSTIN (GST Number)
          </label>
          <Input
            id="gst-number"
            value={gstNumber}
            onChange={(e) => {
              setGstNumber(e.target.value.toUpperCase());
              setError('');
              setSuccess(false);
            }}
            placeholder="e.g., 29ABCDE1234F1Z5"
            maxLength={15}
            className="font-mono uppercase"
          />
          <p className="text-xs text-muted-foreground">
            15-character Indian GST Identification Number. Leave empty to disable GST on invoices.
          </p>
        </div>

        {/* GST Rate — only show if GSTIN is provided */}
        {hasGst && isValid && (
          <div className="space-y-2">
            <label htmlFor="gst-rate" className="text-sm font-medium text-foreground">
              GST Rate (%)
            </label>
            <select
              id="gst-rate"
              value={gstRate}
              onChange={(e) => setGstRate(Number(e.target.value))}
              className="h-9 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value={5}>5%</option>
              <option value={12}>12%</option>
              <option value={18}>18% (Standard)</option>
              <option value={28}>28%</option>
            </select>
          </div>
        )}

        {/* Status indicator */}
        {hasGst && isValid && (
          <div className="rounded-lg bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800/30 px-4 py-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" />
              <p className="text-sm text-emerald-800 dark:text-emerald-200">
                GST at {gstRate}% will be applied to all new invoices.
              </p>
            </div>
          </div>
        )}

        {!hasGst && (
          <div className="rounded-lg bg-muted/50 px-4 py-3">
            <p className="text-sm text-muted-foreground">
              No GSTIN configured. Invoices will be generated without GST.
            </p>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 dark:border-red-900/50 dark:bg-red-900/20">
            <AlertTriangle className="size-4 text-red-600 shrink-0" />
            <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
          </div>
        )}

        {success && (
          <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-900/50 dark:bg-emerald-900/20">
            <CheckCircle2 className="size-4 text-emerald-600" />
            <p className="text-sm text-emerald-800 dark:text-emerald-200">GST settings saved!</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 pt-2">
          <Button className="rounded-xl" onClick={handleSave} disabled={isPending || (hasGst && !isValid)}>
            {isPending ? 'Saving...' : 'Save GST Settings'}
          </Button>
          {hasGst && (
            <Button variant="outline" className="rounded-xl" onClick={handleClear} disabled={isPending}>
              Remove GSTIN
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}


// =============================================================================
// Discount Settings Card
// =============================================================================

interface DiscountSettingsProps {
  discountEnabled: boolean;
  discountValue: number;
}

export function DiscountSettingsCard({ discountEnabled: initialEnabled, discountValue: initialValue }: DiscountSettingsProps) {
  const [isPending, startTransition] = useTransition();
  const [enabled, setEnabled] = useState(initialEnabled);
  const [value, setValue] = useState(initialValue || 10);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  function handleSave() {
    setError('');
    setSuccess(false);

    if (enabled && (value < 1 || value > 100)) {
      setError('Discount must be between 1% and 100%');
      return;
    }

    startTransition(async () => {
      const result = await updateDiscountSettings({
        discount_enabled: enabled,
        discount_value: enabled ? value : 0,
      });

      if (result.success) {
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="border-b border-border px-6 py-4 bg-muted/30">
        <div className="flex items-center gap-2">
          <Percent className="size-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground">Default Discount</h2>
          {initialEnabled && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 dark:bg-emerald-900/30 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 className="size-3" />
              {initialValue}% Active
            </span>
          )}
        </div>
      </div>
      <div className="p-6 space-y-5">
        <p className="text-sm text-muted-foreground">
          Enable a default discount that will be automatically applied to all new invoices.
        </p>

        {/* Toggle */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-foreground">Auto-apply discount</p>
            <p className="text-xs text-muted-foreground">Apply to every new invoice automatically</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            aria-label="Toggle discount"
            onClick={() => setEnabled(!enabled)}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
              enabled ? 'bg-primary' : 'bg-muted'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                enabled ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* Discount Value */}
        {enabled && (
          <div className="space-y-2">
            <label htmlFor="discount-value" className="text-sm font-medium text-foreground">
              Discount Percentage (%)
            </label>
            <div className="flex items-center gap-3">
              <Input
                id="discount-value"
                type="number"
                min={1}
                max={100}
                value={value}
                onChange={(e) => setValue(Number(e.target.value))}
                className="w-24"
              />
              <span className="text-sm text-muted-foreground">% off on every invoice</span>
            </div>
          </div>
        )}

        {/* Status */}
        {enabled && value > 0 && (
          <div className="rounded-lg bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800/30 px-4 py-3">
            <div className="flex items-center gap-2">
              <Percent className="size-4 text-emerald-600 dark:text-emerald-400" />
              <p className="text-sm text-emerald-800 dark:text-emerald-200">
                {value}% discount will be applied to all new invoices.
              </p>
            </div>
          </div>
        )}

        {!enabled && (
          <div className="rounded-lg bg-muted/50 px-4 py-3">
            <p className="text-sm text-muted-foreground">
              No default discount. Membership discounts will still apply if customer has an active membership.
            </p>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 dark:border-red-900/50 dark:bg-red-900/20">
            <AlertTriangle className="size-4 text-red-600 shrink-0" />
            <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
          </div>
        )}

        {success && (
          <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-900/50 dark:bg-emerald-900/20">
            <CheckCircle2 className="size-4 text-emerald-600" />
            <p className="text-sm text-emerald-800 dark:text-emerald-200">Discount settings saved!</p>
          </div>
        )}

        <div className="pt-2">
          <Button className="rounded-xl" onClick={handleSave} disabled={isPending}>
            {isPending ? 'Saving...' : 'Save Discount Settings'}
          </Button>
        </div>
      </div>
    </div>
  );
}
