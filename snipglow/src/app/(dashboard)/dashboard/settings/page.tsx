import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { isAdminEmail } from '@/lib/admin/auth';
import { GstSettingsCard, SalonProfileCard, QrCodeGeneratorCard, WhatsAppBookingLinkCard, GoogleReviewLinkCard, SalonTimingsCard, BlockCalendarCard, BlockSlotsCard, BookingCapacityCard, DiscountSettingsCard } from './settings-client';
import {
  Settings,
  CreditCard,
  Crown,
  CheckCircle2,
  AlertTriangle,
  Clock,
  CalendarDays,
  ShieldCheck,
} from 'lucide-react';
import type { SubscriptionStatus } from '@/types';
import { getSubscriptionState, planLabel, planMonthlyPrice, getBillingCycle, billingCycleLabel } from '@/lib/subscription';
import { RenewButton } from './renew-button';

export default async function SettingsPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const tenantId = user.user_metadata?.tenant_id;
  const branchId = user.user_metadata?.branch_id;
  if (!tenantId) redirect('/onboarding');

  const { data: tenant } = await supabase
    .from('tenants')
    .select('*')
    .eq('id', tenantId)
    .single();

  if (!tenant) redirect('/dashboard');

  // Fetch primary branch details
  let branchName = '';
  let branchAddress = '';
  let branchOperatingHours: Record<string, { open: string; close: string }> | null = null;

  if (branchId) {
    const { data } = await supabase
      .from('branches')
      .select('name, address, phone, operating_hours')
      .eq('id', branchId)
      .single();

    if (data) {
      branchName = data.name ?? '';
      branchAddress = data.address ?? '';
      branchOperatingHours = data.operating_hours as Record<string, { open: string; close: string }> | null;
    }
  }

  const subscriptionStatus = tenant.subscription_status as SubscriptionStatus;
  const subscriptionEnd = tenant.subscription_end ? new Date(tenant.subscription_end) : null;
  const subscriptionStart = tenant.subscription_start ? new Date(tenant.subscription_start) : null;

  // Computed expiry — a trial past its end date counts as expired even if the
  // stored status still says 'trial'.
  const subState = getSubscriptionState(tenant as any);
  const isExpired = subState.isExpired;
  const isTrial = !isExpired && subscriptionStatus === 'trial';
  const isActive = !isExpired && subscriptionStatus === 'active';
  const daysRemaining = subState.daysRemaining;

  // GST settings
  const settings = (tenant.settings as Record<string, unknown>) ?? {};
  const gstNumber = (settings.gst_number as string) ?? '';
  const gstRate = (settings.gst_rate as number) ?? 5;
  const gstEnabled = (settings.gst_enabled as boolean) ?? false;
  const gstLegalName = (settings.legal_name as string) ?? '';
  const gstTradeName = (settings.trade_name as string) ?? '';
  const gstLocked = (settings.gst_locked as boolean) ?? false;
  const isPlatformAdmin = isAdminEmail(user.email);

  // Discount settings
  const discountEnabled = (settings.discount_enabled as boolean) ?? false;
  const discountValue = (settings.discount_value as number) ?? 0;

  // Plan + billing cycle
  const planTier = (tenant as any).plan_tier ?? 'starter';
  const billingCycle = getBillingCycle(settings);
  const planMonthly = planMonthlyPrice(planTier, billingCycle);

  // Salon profile data
  const salonProfile = {
    tenantCode: (tenant as any).tenant_code ?? 'SNG-000',
    salonName: tenant.name ?? '',
    ownerName: tenant.owner_name ?? '',
    phone: tenant.phone ?? '',
    email: user.email ?? '',
    branchName: branchName,
    address: branchAddress,
    operatingHours: branchOperatingHours,
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-gray-500/10 via-gray-500/5 to-transparent border border-gray-200/50 dark:border-gray-800/30 p-6">
        <div className="relative z-10 flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-xl bg-gray-100 dark:bg-gray-900/30">
            <Settings className="size-5 text-gray-600 dark:text-gray-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Settings</h1>
            <p className="text-sm text-muted-foreground">Manage your salon profile, billing, and subscription</p>
          </div>
        </div>
        <div className="absolute -right-6 -top-6 h-32 w-32 rounded-full bg-gray-500/5" />
        <div className="absolute -right-2 top-10 h-20 w-20 rounded-full bg-gray-400/5" />
      </div>

      {/* Subscription Status Card */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="border-b border-border px-6 py-4 bg-muted/30">
          <div className="flex items-center gap-2">
            <CreditCard className="size-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold text-foreground">Subscription</h2>
          </div>
        </div>
        <div className="p-6 space-y-5">
          {/* Status + Plan */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className={`flex size-12 items-center justify-center rounded-xl ${
                isExpired ? 'bg-red-100 dark:bg-red-900/30' :
                isTrial ? 'bg-blue-100 dark:bg-blue-900/30' :
                'bg-emerald-100 dark:bg-emerald-900/30'
              }`}>
                {isExpired ? (
                  <AlertTriangle className="size-6 text-red-600 dark:text-red-400" />
                ) : isTrial ? (
                  <Clock className="size-6 text-blue-600 dark:text-blue-400" />
                ) : (
                  <ShieldCheck className="size-6 text-emerald-600 dark:text-emerald-400" />
                )}
              </div>
              <div>
                <p className="text-lg font-bold text-foreground">
                  {isExpired ? 'Subscription Expired' : isTrial ? 'Free Trial' : 'Active Subscription'}
                </p>
                <p className="text-sm text-muted-foreground">
                  SnipandGlow — {planLabel(planTier)} Plan · {billingCycleLabel(billingCycle)} (₹{planMonthly.toLocaleString('en-IN')}/mo)
                </p>
              </div>
            </div>

            {/* Status Badge */}
            <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${
              isExpired ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' :
              isTrial ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' :
              'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300'
            }`}>
              <span className={`size-2 rounded-full ${
                isExpired ? 'bg-red-500' : isTrial ? 'bg-blue-500' : 'bg-emerald-500'
              }`} />
              {isExpired ? 'Expired' : isTrial ? 'Trial Period' : 'Active'}
            </span>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {subscriptionStart && (
              <div className="rounded-lg bg-muted/50 px-4 py-3">
                <div className="flex items-center gap-2 mb-1">
                  <CalendarDays className="size-3.5 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">
                    {isTrial ? 'Trial Started' : 'Subscription Started'}
                  </p>
                </div>
                <p className="text-sm font-semibold text-foreground">
                  {subscriptionStart.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                </p>
              </div>
            )}
            {subscriptionEnd && (
              <div className={`rounded-lg px-4 py-3 ${
                isExpired ? 'bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800/30' :
                daysRemaining <= 7 ? 'bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/30' :
                'bg-muted/50'
              }`}>
                <div className="flex items-center gap-2 mb-1">
                  <Clock className="size-3.5 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">
                    {isExpired ? 'Expired On' : isTrial ? 'Trial Ends' : 'Renews On'}
                  </p>
                </div>
                <p className={`text-sm font-semibold ${
                  isExpired ? 'text-red-700 dark:text-red-400' :
                  daysRemaining <= 7 ? 'text-amber-700 dark:text-amber-400' :
                  'text-foreground'
                }`}>
                  {subscriptionEnd.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                  {!isExpired && daysRemaining > 0 && (
                    <span className="text-xs font-normal text-muted-foreground ml-2">
                      ({daysRemaining} day{daysRemaining !== 1 ? 's' : ''} remaining)
                    </span>
                  )}
                </p>
              </div>
            )}
          </div>

          {/* Expired State — Upgrade CTA */}
          {isExpired && (
            <div className="rounded-xl border border-red-200 bg-red-50 dark:border-red-800/30 dark:bg-red-900/10 p-5 space-y-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="size-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-red-800 dark:text-red-200">Your subscription has expired</p>
                  <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                    All features are locked except Dashboard and Settings. Complete your payment to continue managing appointments, billing, customers, and more.
                  </p>
                </div>
              </div>
              <RenewButton />
            </div>
          )}

          {/* Trial State — Upgrade CTA */}
          {isTrial && (
            <div className="rounded-xl border border-blue-200 bg-blue-50 dark:border-blue-800/30 dark:bg-blue-900/10 p-5 space-y-3">
              <div className="flex items-start gap-3">
                <Clock className="size-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-blue-800 dark:text-blue-200">
                    {daysRemaining > 0 ? `${daysRemaining} days left in your free trial` : 'Your trial has ended'}
                  </p>
                  <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                    Upgrade to keep all your data and continue using SnipandGlow without interruption.
                  </p>
                </div>
              </div>
              <Link
                href="https://snipandglow.com/#pricing"
                target="_blank"
                className="inline-flex items-center justify-center gap-2 w-full sm:w-auto rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-lg hover:from-blue-500 hover:to-indigo-500 transition-all"
              >
                <Crown className="size-4" />
                Subscribe Now — ₹{planMonthly.toLocaleString('en-IN')}/mo
              </Link>
            </div>
          )}

          {/* Active State */}
          {isActive && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 dark:border-emerald-800/30 dark:bg-emerald-900/10 px-4 py-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" />
                <p className="text-sm text-emerald-800 dark:text-emerald-200">
                  Your subscription is active. All features are unlocked.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Salon Profile */}
      <SalonProfileCard profile={salonProfile} />

      {/* GST Configuration */}
      <GstSettingsCard
        currentGstNumber={gstNumber}
        currentGstRate={gstRate}
        gstEnabled={gstEnabled}
        currentLegalName={gstLegalName}
        currentTradeName={gstTradeName}
        locked={gstLocked}
        isPlatformAdmin={isPlatformAdmin}
      />

      {/* Default Discount */}
      <DiscountSettingsCard
        discountEnabled={discountEnabled}
        discountValue={discountValue}
      />

      {/* WhatsApp Booking Link */}
      <WhatsAppBookingLinkCard
        tenantCode={(tenant as any).tenant_code ?? 'SNG-000'}
        salonName={tenant.name ?? ''}
      />

      {/* Google Review Link */}
      <GoogleReviewLinkCard
        currentLink={((tenant.settings as any)?.google_review_link as string) || ''}
      />

      {/* Salon Timings */}
      <SalonTimingsCard operatingHours={branchOperatingHours} />

      {/* Block Calendar */}
      <BlockCalendarCard blockedDates={((tenant.settings as any)?.blocked_dates as string[]) || []} />

      {/* Block Time Slots */}
      <BlockSlotsCard
        blockedSlots={((tenant.settings as any)?.blocked_slots as Array<{ date: string; slots: string[] }>) || []}
        operatingHours={branchOperatingHours}
      />

      {/* Booking Capacity */}
      <BookingCapacityCard
        maxAppointmentsPerSlot={((tenant.settings as any)?.max_appointments_per_slot as number) || 1}
        slotDurationMinutes={((tenant.settings as any)?.slot_duration_minutes as number) || 30}
      />

      {/* QR Code Generator */}
      <QrCodeGeneratorCard
        salonName={tenant.name ?? ''}
        salonPhone={tenant.phone ?? ''}
      />
    </div>
  );
}
