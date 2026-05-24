'use client';

import { useState, useTransition, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { updateGstSettings, updateSalonProfile, updateDiscountSettings } from './actions';
import { Receipt, CheckCircle2, AlertTriangle, Scissors, Phone, Mail, MapPin, User, Clock, Pencil, Percent, QrCode, ExternalLink, Smartphone, Users, TrendingUp, Star, MessageCircle } from 'lucide-react';

// =============================================================================
// Salon Profile Card
// =============================================================================

interface SalonProfileProps {
  profile: {
    tenantCode: string;
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
                <Input value={profile.salonName} disabled className="opacity-60" />
                <p className="text-xs text-muted-foreground">Cannot be changed after setup</p>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Owner Name</label>
                <Input value={profile.ownerName} disabled className="opacity-60" />
                <p className="text-xs text-muted-foreground">Cannot be changed after setup</p>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Phone</label>
                <Input value={profile.phone} disabled className="opacity-60" />
                <p className="text-xs text-muted-foreground">Verified number — cannot be changed</p>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Email</label>
                <Input value={profile.email} disabled className="opacity-60" />
                <p className="text-xs text-muted-foreground">Linked to your Google account</p>
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
          <div className="space-y-4">
            {/* Tenant Code Badge */}
            <div className="inline-flex items-center gap-2 rounded-full bg-muted px-3 py-1.5">
              <span className="text-xs text-muted-foreground">Salon ID:</span>
              <span className="text-xs font-bold font-mono text-foreground">{profile.tenantCode}</span>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <ProfileField icon={<Scissors className="size-3.5" />} label="Salon Name" value={profile.salonName} />
              <ProfileField icon={<User className="size-3.5" />} label="Owner" value={profile.ownerName} />
              <ProfileField icon={<Phone className="size-3.5" />} label="Phone" value={profile.phone} />
              <ProfileField icon={<Mail className="size-3.5" />} label="Email" value={profile.email} />
              <ProfileField icon={<MapPin className="size-3.5" />} label="Address" value={profile.address || 'Not set'} />
              <ProfileField icon={<Clock className="size-3.5" />} label="Operating Hours" value={hoursDisplay} />
            </div>
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


// =============================================================================
// QR Code Generator Card
// =============================================================================

interface QrCodeGeneratorProps {
  salonName: string;
  salonPhone: string;
}

// =============================================================================
// WhatsApp Booking Link Card
// =============================================================================

interface WhatsAppBookingLinkProps {
  tenantCode: string;
  salonName: string;
}

export function WhatsAppBookingLinkCard({ tenantCode, salonName }: WhatsAppBookingLinkProps) {
  const [copied, setCopied] = useState(false);

  const slug = tenantCode.replace('-', '').toLowerCase() + '_' + salonName.toLowerCase().replace(/\s+/g, '_');
  const shortCode = tenantCode.replace('-', '').toUpperCase(); // e.g., SNG001
  // Message includes salon name + code for reliable routing
  const friendlyMessage = `Hi! I'd like to book an appointment at ${salonName.trim()} [${shortCode}]`;
  const bookingUrl = `https://wa.me/919448895147?text=${encodeURIComponent(friendlyMessage)}`;
  const landingUrl = `https://www.snipandglow.com/book/${shortCode.toLowerCase()}`;

  function handleCopy() {
    navigator.clipboard.writeText(bookingUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="border-b border-border px-6 py-4 bg-gradient-to-r from-green-500/5 via-emerald-500/3 to-transparent">
        <div className="flex items-center gap-2">
          <MessageCircle className="size-4 text-green-600 dark:text-green-400" />
          <h2 className="text-sm font-semibold text-foreground">WhatsApp Booking Link</h2>
        </div>
      </div>
      <div className="p-6 space-y-4">
        <p className="text-sm text-muted-foreground">
          Share this link with your customers or print it as a QR code. When they tap it, they can book appointments directly on WhatsApp.
        </p>

        {/* Booking URL */}
        <div className="rounded-xl bg-muted/50 border border-border p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">Booking Link (share this)</p>
            <button
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-foreground bg-background border border-border hover:bg-muted transition-colors"
            >
              {copied ? (
                <><CheckCircle2 className="size-3 text-green-500" /> Copied!</>
              ) : (
                <><span className="size-3">📋</span> Copy</>
              )}
            </button>
          </div>
          <p className="text-sm font-mono text-foreground break-all select-all">{bookingUrl}</p>
        </div>

        {/* Short code info */}
        <div className="rounded-lg bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800/30 px-4 py-3">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-medium text-green-800 dark:text-green-200">Your Booking Code:</span>
            <span className="text-xs font-mono font-bold text-green-700 dark:text-green-300">{shortCode}</span>
          </div>
          <p className="text-xs text-green-600 dark:text-green-400">
            Customers send this short code to start booking. Clean and easy to remember.
          </p>
        </div>

        {/* Instructions */}
        <div className="space-y-2 text-xs text-muted-foreground">
          <p className="font-medium text-foreground">How to use:</p>
          <ul className="space-y-1 list-disc list-inside">
            <li>Share the link directly with customers via WhatsApp, SMS, or social media</li>
            <li>Print as QR code and display at your salon reception, mirrors, or entrance</li>
            <li>Add to your Instagram bio, Google Business profile, or visiting cards</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export function QrCodeGeneratorCard({ salonName, salonPhone }: QrCodeGeneratorProps) {
  const qrCodeUrl = 'https://qrcode.pixalara.io';

  const benefits = [
    {
      icon: <Smartphone className="size-4" />,
      title: 'Instant Bookings',
      description: 'Customers scan & book appointments directly on WhatsApp',
    },
    {
      icon: <Users className="size-4" />,
      title: 'Walk-in Conversion',
      description: 'Convert walk-in visitors into repeat customers effortlessly',
    },
    {
      icon: <TrendingUp className="size-4" />,
      title: '3x More Bookings',
      description: 'Salons using QR codes see up to 3x increase in online bookings',
    },
    {
      icon: <Star className="size-4" />,
      title: 'Professional Branding',
      description: 'Premium QR poster makes your salon look modern & tech-savvy',
    },
  ];

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="border-b border-border px-6 py-4 bg-gradient-to-r from-fuchsia-500/5 via-purple-500/5 to-pink-500/5">
        <div className="flex items-center gap-2">
          <QrCode className="size-4 text-fuchsia-600 dark:text-fuchsia-400" />
          <h2 className="text-sm font-semibold text-foreground">QR Code Generator</h2>
          <span className="inline-flex items-center gap-1 rounded-full bg-fuchsia-100 dark:bg-fuchsia-900/30 px-2 py-0.5 text-xs font-medium text-fuchsia-700 dark:text-fuchsia-400">
            Recommended
          </span>
        </div>
      </div>
      <div className="p-4 sm:p-6 space-y-6">
        {/* Hero Section with Visual */}
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-4 sm:p-6 text-white">
          <div className="relative z-10 flex flex-col items-center gap-5 sm:gap-6 sm:flex-row">
            {/* QR Visual Mockup */}
            <div className="flex-shrink-0">
              <div className="relative w-36 h-44 sm:w-48 sm:h-56 rounded-lg bg-gradient-to-b from-gray-800 to-black border border-gray-700 p-3 sm:p-4 shadow-2xl">
                <div className="text-center space-y-2">
                  <p className="text-[10px] text-gray-400 uppercase tracking-wider">✦ {salonName || 'Your Salon'} ✦</p>
                  <p className="text-xs font-bold text-white leading-tight">
                    BOOK APPOINTMENTS<br />
                    ON <span className="text-green-400">WHATSAPP</span>
                  </p>
                  <div className="mx-auto w-20 h-20 sm:w-24 sm:h-24 bg-white rounded-lg flex items-center justify-center">
                    <div className="relative">
                      <QrCode className="size-12 sm:size-16 text-gray-900" />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="size-5 rounded-full bg-green-500 flex items-center justify-center">
                          <Phone className="size-3 text-white" />
                        </div>
                      </div>
                    </div>
                  </div>
                  <p className="text-[9px] text-gray-400 uppercase tracking-widest">✦ Scan to Book ✦</p>
                </div>
              </div>
            </div>

            {/* Description */}
            <div className="flex-1 text-center sm:text-left space-y-3">
              <h3 className="text-lg font-bold">
                Get Your Salon&apos;s WhatsApp Booking QR Code
              </h3>
              <p className="text-sm text-gray-300 leading-relaxed">
                Print and display a beautiful QR code poster at your salon reception, mirrors, or entrance. 
                Customers simply scan it to book appointments instantly on WhatsApp — no app downloads needed.
              </p>
              <a
                href={qrCodeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-fuchsia-600 to-purple-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg hover:from-fuchsia-500 hover:to-purple-500 transition-all hover:shadow-xl hover:-translate-y-0.5"
              >
                <QrCode className="size-4" />
                Generate Your QR Code
                <ExternalLink className="size-3.5" />
              </a>
            </div>
          </div>

          {/* Background decorations */}
          <div className="absolute -right-8 -top-8 h-40 w-40 rounded-full bg-fuchsia-500/10 blur-2xl" />
          <div className="absolute -left-8 -bottom-8 h-32 w-32 rounded-full bg-purple-500/10 blur-2xl" />
        </div>

        {/* Why QR Codes Matter */}
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Star className="size-4 text-amber-500" />
            Why Every Salon Needs a Booking QR Code
          </h4>
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
            {benefits.map((benefit, idx) => (
              <div
                key={idx}
                className="group flex items-start gap-3 rounded-xl border border-border bg-muted/30 p-4 transition-all hover:bg-muted/50 hover:border-fuchsia-200 dark:hover:border-fuchsia-800/30"
              >
                <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-fuchsia-100 dark:bg-fuchsia-900/30 text-fuchsia-600 dark:text-fuchsia-400 group-hover:scale-110 transition-transform">
                  {benefit.icon}
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">{benefit.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{benefit.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* How it works */}
        <div className="rounded-xl bg-gradient-to-r from-fuchsia-50 via-purple-50 to-pink-50 dark:from-fuchsia-900/10 dark:via-purple-900/10 dark:to-pink-900/10 border border-fuchsia-200/50 dark:border-fuchsia-800/30 p-4 sm:p-5">
          <h4 className="text-sm font-semibold text-foreground mb-3">How It Works</h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            <Step number={1} text="Generate QR code" />
            <Step number={2} text="Download & print" />
            <Step number={3} text="Display at salon" />
            <Step number={4} text="Customers scan!" />
          </div>
        </div>

        {/* CTA */}
        <div className="flex flex-col sm:flex-row items-center gap-4 pt-2">
          <a
            href={qrCodeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-fuchsia-600 to-purple-600 px-6 py-3 text-sm font-semibold text-white shadow-lg hover:from-fuchsia-500 hover:to-purple-500 transition-all hover:shadow-xl hover:-translate-y-0.5 w-full sm:w-auto justify-center"
          >
            <QrCode className="size-4" />
            Generate Free QR Code
            <ExternalLink className="size-3.5" />
          </a>
          <p className="text-xs text-muted-foreground text-center sm:text-left">
            Free to generate • Powered by Pixalara
          </p>
        </div>
      </div>
    </div>
  );
}

function Step({ number, text }: { number: number; text: string }) {
  return (
    <div className="flex flex-col items-center gap-1.5 text-center">
      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-fuchsia-600 text-[11px] font-bold text-white">
        {number}
      </span>
      <span className="text-xs text-foreground font-medium leading-tight">{text}</span>
    </div>
  );
}


// =============================================================================
// Google Review Link Card
// =============================================================================

interface GoogleReviewLinkProps {
  currentLink: string;
}

export function GoogleReviewLinkCard({ currentLink }: GoogleReviewLinkProps) {
  const [isPending, startTransition] = useTransition();
  const [link, setLink] = useState(currentLink);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  async function handleSave() {
    setError('');
    setSuccess(false);

    const { updateGoogleReviewLink } = await import('./actions');

    startTransition(async () => {
      const result = await updateGoogleReviewLink(link);
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
      <div className="border-b border-border px-6 py-4 bg-gradient-to-r from-amber-500/5 via-orange-500/3 to-transparent">
        <div className="flex items-center gap-2">
          <Star className="size-4 text-amber-500" />
          <h2 className="text-sm font-semibold text-foreground">Google Review Link</h2>
          {currentLink && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 dark:bg-emerald-900/30 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 className="size-3" />
              Active
            </span>
          )}
        </div>
      </div>
      <div className="p-6 space-y-4">
        <p className="text-sm text-muted-foreground">
          Add your Google Business review link. When customers rate you 4-5 stars, they&apos;ll be asked to leave a Google review using this link.
        </p>

        <div className="space-y-2">
          <label htmlFor="google-review-link" className="text-sm font-medium text-foreground">
            Google Review URL
          </label>
          <Input
            id="google-review-link"
            value={link}
            onChange={(e) => { setLink(e.target.value); setError(''); setSuccess(false); }}
            placeholder="https://g.page/r/your-salon/review"
            type="url"
          />
          <p className="text-xs text-muted-foreground">
            Find this in Google Business Profile → Share → &quot;Ask for reviews&quot; link
          </p>
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
            <p className="text-sm text-emerald-800 dark:text-emerald-200">Google Review link saved!</p>
          </div>
        )}

        <Button className="rounded-xl" onClick={handleSave} disabled={isPending}>
          {isPending ? 'Saving...' : 'Save Review Link'}
        </Button>
      </div>
    </div>
  );
}


// =============================================================================
// Salon Timings Card
// =============================================================================

interface SalonTimingsProps {
  operatingHours: Record<string, { open: string; close: string }> | null;
}

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const DAY_LABELS: Record<string, string> = { monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed', thursday: 'Thu', friday: 'Fri', saturday: 'Sat', sunday: 'Sun' };

export function SalonTimingsCard({ operatingHours }: SalonTimingsProps) {
  const [isPending, startTransition] = useTransition();
  const [hours, setHours] = useState<Record<string, { open: string; close: string; closed: boolean }>>(
    DAYS.reduce((acc, day) => {
      const h = operatingHours?.[day];
      acc[day] = { open: h?.open || '09:00', close: h?.close || '21:00', closed: !h?.open };
      return acc;
    }, {} as Record<string, { open: string; close: string; closed: boolean }>)
  );
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  function handleSave() {
    setError('');
    setSuccess(false);
    const formatted: Record<string, { open: string; close: string } | null> = {};
    for (const day of DAYS) {
      if (hours[day].closed) {
        formatted[day] = null as any;
      } else {
        formatted[day] = { open: hours[day].open, close: hours[day].close };
      }
    }

    startTransition(async () => {
      const { updateOperatingHours } = await import('./actions');
      const result = await updateOperatingHours(formatted as any);
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
          <Clock className="size-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground">Salon Timings</h2>
        </div>
      </div>
      <div className="p-6 space-y-4">
        <p className="text-sm text-muted-foreground">Set your salon&apos;s operating hours. Customers can only book within these times.</p>

        <div className="space-y-3">
          {DAYS.map((day) => (
            <div key={day} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 p-3 rounded-lg bg-muted/30">
              <div className="flex items-center justify-between sm:justify-start gap-3">
                <span className="w-10 text-sm font-semibold text-foreground">{DAY_LABELS[day]}</span>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!hours[day].closed}
                    onChange={(e) => setHours({ ...hours, [day]: { ...hours[day], closed: !e.target.checked } })}
                    className="size-4 rounded border-border accent-pink-500"
                  />
                  <span className={`text-xs font-medium ${hours[day].closed ? 'text-muted-foreground' : 'text-emerald-600'}`}>
                    {hours[day].closed ? 'Closed' : 'Open'}
                  </span>
                </label>
              </div>
              {!hours[day].closed && (
                <div className="flex items-center gap-2 flex-wrap">
                  <input
                    type="time"
                    value={hours[day].open}
                    onChange={(e) => setHours({ ...hours, [day]: { ...hours[day], open: e.target.value } })}
                    className="h-9 flex-1 min-w-[110px] rounded-lg border border-border bg-background px-2 text-sm"
                  />
                  <span className="text-xs text-muted-foreground">to</span>
                  <input
                    type="time"
                    value={hours[day].close}
                    onChange={(e) => setHours({ ...hours, [day]: { ...hours[day], close: e.target.value } })}
                    className="h-9 flex-1 min-w-[110px] rounded-lg border border-border bg-background px-2 text-sm"
                  />
                </div>
              )}
            </div>
          ))}
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        {success && <p className="text-sm text-emerald-600">Timings saved!</p>}

        <Button className="rounded-xl" onClick={handleSave} disabled={isPending}>
          {isPending ? 'Saving...' : 'Save Timings'}
        </Button>
      </div>
    </div>
  );
}

// =============================================================================
// Block Calendar Card
// =============================================================================

interface BlockCalendarProps {
  blockedDates: string[];
}

export function BlockCalendarCard({ blockedDates: initialDates }: BlockCalendarProps) {
  const [isPending, startTransition] = useTransition();
  const [dates, setDates] = useState<string[]>(initialDates);
  const [newDate, setNewDate] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  function addDate() {
    if (!newDate) return;
    if (dates.includes(newDate)) return;
    setDates([...dates, newDate].sort());
    setNewDate('');
  }

  function removeDate(d: string) {
    setDates(dates.filter((x) => x !== d));
  }

  function handleSave() {
    setError('');
    setSuccess(false);
    startTransition(async () => {
      const { updateBlockedDates } = await import('./actions');
      const result = await updateBlockedDates(dates);
      if (result.success) {
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      } else {
        setError(result.error);
      }
    });
  }

  // Filter out past dates
  const today = new Date().toISOString().split('T')[0];
  const futureDates = dates.filter((d) => d >= today);

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="border-b border-border px-6 py-4 bg-muted/30">
        <div className="flex items-center gap-2">
          <AlertTriangle className="size-4 text-amber-500" />
          <h2 className="text-sm font-semibold text-foreground">Block Calendar</h2>
        </div>
      </div>
      <div className="p-6 space-y-4">
        <p className="text-sm text-muted-foreground">Block specific dates when your salon is closed (holidays, events, etc.). Customers won&apos;t be able to book on these dates.</p>

        {/* Add date */}
        <div className="flex items-center gap-2 flex-wrap">
          <Input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} min={today} className="flex-1 min-w-[160px]" />
          <Button variant="outline" className="rounded-xl min-h-[44px]" onClick={addDate} disabled={!newDate}>Add Date</Button>
        </div>

        {/* Blocked dates list */}
        {futureDates.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {futureDates.map((d) => (
              <span key={d} className="inline-flex items-center gap-1.5 rounded-full bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-3 py-1 text-xs font-medium text-red-700 dark:text-red-300">
                {new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                <button onClick={() => removeDate(d)} className="text-red-500 hover:text-red-700 text-sm leading-none">&times;</button>
              </span>
            ))}
          </div>
        )}

        {futureDates.length === 0 && <p className="text-xs text-muted-foreground">No dates blocked. Your salon is open on all scheduled days.</p>}

        {error && <p className="text-sm text-red-600">{error}</p>}
        {success && <p className="text-sm text-emerald-600">Blocked dates saved!</p>}

        <Button className="rounded-xl" onClick={handleSave} disabled={isPending}>
          {isPending ? 'Saving...' : 'Save Blocked Dates'}
        </Button>
      </div>
    </div>
  );
}


// =============================================================================
// Block Time Slots Card
// =============================================================================

interface BlockSlotsProps {
  blockedSlots: Array<{ date: string; slots: string[] }>;
  operatingHours: Record<string, { open: string; close: string }> | null;
}

function generateSlotsForDay(open: string, close: string): string[] {
  const [openH, openM] = open.split(':').map(Number);
  const [closeH, closeM] = close.split(':').map(Number);
  const openMin = openH * 60 + (openM || 0);
  const closeMin = closeH * 60 + (closeM || 0);
  const slots: string[] = [];
  for (let m = openMin; m < closeMin; m += 30) {
    slots.push(`${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`);
  }
  return slots;
}

function formatSlot(slot: string): string {
  const [h, m] = slot.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${period}`;
}

export function BlockSlotsCard({ blockedSlots: initial, operatingHours }: BlockSlotsProps) {
  const [isPending, startTransition] = useTransition();
  const [entries, setEntries] = useState<Array<{ date: string; slots: string[] }>>(initial);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedSlots, setSelectedSlots] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // Sync entries with initial prop when it changes (after save and revalidation)
  useEffect(() => {
    setEntries(initial);
  }, [initial]);

  const today = new Date().toISOString().split('T')[0];

  // Get available slots for the selected date based on operating hours
  const availableSlots: string[] = (() => {
    if (!selectedDate || !operatingHours) return [];
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayName = dayNames[new Date(selectedDate + 'T12:00:00').getDay()];
    const h = operatingHours[dayName];
    if (!h?.open || !h?.close) return [];
    return generateSlotsForDay(h.open, h.close);
  })();

  // Get already blocked slots for selected date
  const existingEntry = entries.find((e) => e.date === selectedDate);

  function toggleSlot(slot: string) {
    setSelectedSlots((prev) =>
      prev.includes(slot) ? prev.filter((s) => s !== slot) : [...prev, slot]
    );
  }

  function addBlockedSlots() {
    if (!selectedDate || selectedSlots.length === 0) return;
    const updated = entries.filter((e) => e.date !== selectedDate);
    const merged = [...(existingEntry?.slots || []), ...selectedSlots];
    const unique = [...new Set(merged)].sort();
    updated.push({ date: selectedDate, slots: unique });
    setEntries(updated.sort((a, b) => a.date.localeCompare(b.date)));
    setSelectedSlots([]);
  }

  function removeEntry(date: string) {
    setEntries(entries.filter((e) => e.date !== date));
  }

  function removeSlotFromEntry(date: string, slot: string) {
    setEntries(entries.map((e) => {
      if (e.date !== date) return e;
      const newSlots = e.slots.filter((s) => s !== slot);
      return { ...e, slots: newSlots };
    }).filter((e) => e.slots.length > 0));
  }

  function handleSave() {
    setError('');
    setSuccess(false);
    startTransition(async () => {
      const { updateBlockedSlots } = await import('./actions');
      const result = await updateBlockedSlots(entries);
      if (result.success) {
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      } else {
        setError(result.error);
      }
    });
  }

  const futureEntries = entries.filter((e) => e.date >= today);

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="border-b border-border px-6 py-4 bg-muted/30">
        <div className="flex items-center gap-2">
          <Clock className="size-4 text-orange-500" />
          <h2 className="text-sm font-semibold text-foreground">Block Time Slots</h2>
        </div>
      </div>
      <div className="p-6 space-y-4">
        <p className="text-sm text-muted-foreground">Block specific time slots on specific dates. Useful for lunch breaks, personal appointments, or partial closures.</p>

        {/* Date picker */}
        <div className="flex items-center gap-2 flex-wrap">
          <Input type="date" value={selectedDate} onChange={(e) => { setSelectedDate(e.target.value); setSelectedSlots([]); }} min={today} className="flex-1 min-w-[160px]" />
        </div>

        {/* Slot selector */}
        {selectedDate && availableSlots.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Tap slots to block on {new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}:</p>
            <div className="flex flex-wrap gap-2">
              {availableSlots.map((slot) => {
                const isSelected = selectedSlots.includes(slot);
                const isAlreadyBlocked = existingEntry?.slots.includes(slot);
                return (
                  <button
                    key={slot}
                    type="button"
                    onClick={() => !isAlreadyBlocked && toggleSlot(slot)}
                    disabled={isAlreadyBlocked}
                    className={`px-3 py-2 min-h-[40px] rounded-lg text-xs font-medium transition-all ${
                      isAlreadyBlocked ? 'bg-red-100 text-red-500 dark:bg-red-900/30 cursor-not-allowed line-through' :
                      isSelected ? 'bg-red-500 text-white' :
                      'bg-muted text-foreground hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20'
                    }`}
                  >
                    {formatSlot(slot)}
                  </button>
                );
              })}
            </div>
            {selectedSlots.length > 0 && (
              <Button variant="outline" className="rounded-xl w-full sm:w-auto min-h-[44px]" onClick={addBlockedSlots}>
                Block {selectedSlots.length} slot{selectedSlots.length > 1 ? 's' : ''}
              </Button>
            )}
          </div>
        )}

        {selectedDate && availableSlots.length === 0 && (
          <p className="text-xs text-muted-foreground">Salon is closed on this day.</p>
        )}

        {/* Existing blocked slots */}
        {futureEntries.length > 0 && (
          <div className="space-y-2 pt-2 border-t border-border">
            <p className="text-xs font-medium text-muted-foreground">Blocked slots:</p>
            {futureEntries.map((entry) => (
              <div key={entry.date} className="rounded-lg bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800/30 px-3 py-2">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-semibold text-red-700 dark:text-red-300">
                    {new Date(entry.date + 'T12:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                  <button onClick={() => removeEntry(entry.date)} className="text-xs text-red-500 hover:text-red-700 font-medium">Remove all</button>
                </div>
                <div className="flex flex-wrap gap-1">
                  {entry.slots.map((slot) => (
                    <span key={slot} className="inline-flex items-center gap-1 rounded-full bg-red-100 dark:bg-red-900/30 px-2 py-0.5 text-[10px] font-medium text-red-700 dark:text-red-300">
                      {formatSlot(slot)}
                      <button onClick={() => removeSlotFromEntry(entry.date, slot)} className="text-red-400 hover:text-red-600">&times;</button>
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}
        {success && <p className="text-sm text-emerald-600">Blocked slots saved!</p>}

        <Button className="rounded-xl" onClick={handleSave} disabled={isPending}>
          {isPending ? 'Saving...' : 'Save Blocked Slots'}
        </Button>
      </div>
    </div>
  );
}
