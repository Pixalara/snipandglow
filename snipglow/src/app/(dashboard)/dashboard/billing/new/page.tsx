'use client';

import { useState, useEffect, useTransition, useCallback } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { calculateInvoiceTotal, formatINR } from '@/lib/utils';
import { searchCustomers, getActiveServices } from '../../appointments/actions';
import { createInvoice, getCustomerActiveMembership, getTenantGstSettings } from '../actions';
import type { Service, PaymentMethod, Membership, CreateInvoiceItemInput } from '@/types';

// =============================================================================
// POS Billing Page — Client Component
// Requirements: 6.1, 6.2, 6.3, 15.4
// =============================================================================

interface CustomerOption {
  id: string;
  name: string;
  phone: string;
}

interface LineItem {
  id: string; // local unique key
  service_id: string;
  service_name: string;
  unit_price: number;
  quantity: number;
}

export default function NewBillingPage() {
  const [isPending, startTransition] = useTransition();

  // Customer state
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerResults, setCustomerResults] = useState<CustomerOption[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerOption | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  // Membership state
  const [activeMembership, setActiveMembership] = useState<Membership | null>(null);
  const [loadingMembership, setLoadingMembership] = useState(false);

  // Services state
  const [services, setServices] = useState<Service[]>([]);
  const [lineItems, setLineItems] = useState<LineItem[]>([]);

  // Billing options
  const [gstEnabled, setGstEnabled] = useState(false);
  const [gstRate, setGstRate] = useState(0);
  const [defaultDiscount, setDefaultDiscount] = useState(0);
  const [additionalDiscountPct, setAdditionalDiscountPct] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');

  // UI state
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [successInvoice, setSuccessInvoice] = useState<{
    invoice_number: string;
    id: string;
  } | null>(null);

  // Load services and GST settings on mount
  useEffect(() => {
    async function loadData() {
      const [svcData, gstSettings] = await Promise.all([
        getActiveServices(),
        getTenantGstSettings(),
      ]);
      setServices(svcData);
      setGstEnabled(gstSettings.gst_enabled);
      setGstRate(gstSettings.gst_rate);
      setDefaultDiscount(gstSettings.discount_enabled ? gstSettings.discount_value : 0);
    }
    loadData();
  }, []);

  // Customer search with debounce
  useEffect(() => {
    if (!customerSearch.trim() || selectedCustomer) {
      setCustomerResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      const results = await searchCustomers(customerSearch);
      setCustomerResults(results);
      setShowDropdown(true);
      setIsSearching(false);
    }, 300);

    return () => clearTimeout(timer);
  }, [customerSearch, selectedCustomer]);

  // Fetch membership when customer is selected
  const fetchMembership = useCallback(async (customerId: string) => {
    setLoadingMembership(true);
    setActiveMembership(null);
    const result = await getCustomerActiveMembership(customerId);
    if (result) {
      setActiveMembership(result.membership);
    }
    setLoadingMembership(false);
  }, []);

  useEffect(() => {
    if (selectedCustomer) {
      fetchMembership(selectedCustomer.id);
    } else {
      setActiveMembership(null);
    }
  }, [selectedCustomer, fetchMembership]);

  // Calculate totals — membership discount + additional discount (additive, capped at 100%)
  const membershipDiscount = activeMembership?.discount_pct ?? 0;
  const baseDiscount = Math.max(membershipDiscount, defaultDiscount);
  const totalDiscountPct = Math.min(100, baseDiscount + additionalDiscountPct);
  const totals = calculateInvoiceTotal({
    lineItems: lineItems.map((item) => ({
      price: item.unit_price,
      quantity: item.quantity,
    })),
    membershipDiscountPct: totalDiscountPct,
    gstRate: gstEnabled ? gstRate : 0,
  });

  // Handlers
  function handleSelectCustomer(customer: CustomerOption) {
    setSelectedCustomer(customer);
    setCustomerSearch(customer.name);
    setShowDropdown(false);
    setCustomerResults([]);
  }

  function handleClearCustomer() {
    setSelectedCustomer(null);
    setCustomerSearch('');
    setCustomerResults([]);
    setActiveMembership(null);
  }

  function handleAddLineItem() {
    setLineItems((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        service_id: '',
        service_name: '',
        unit_price: 0,
        quantity: 1,
      },
    ]);
  }

  function handleRemoveLineItem(id: string) {
    setLineItems((prev) => prev.filter((item) => item.id !== id));
  }

  function handleServiceChange(itemId: string, serviceId: string) {
    const service = services.find((s) => s.id === serviceId);
    if (!service) return;

    setLineItems((prev) =>
      prev.map((item) =>
        item.id === itemId
          ? {
              ...item,
              service_id: service.id,
              service_name: service.name,
              unit_price: service.price,
            }
          : item
      )
    );
  }

  function handleQuantityChange(itemId: string, quantity: number) {
    if (quantity < 1) return;
    setLineItems((prev) =>
      prev.map((item) =>
        item.id === itemId ? { ...item, quantity } : item
      )
    );
  }

  const isFormValid =
    selectedCustomer &&
    lineItems.length > 0 &&
    lineItems.every((item) => item.service_id) &&
    paymentMethod;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isFormValid || !selectedCustomer) return;

    setError('');
    setSubmitting(true);

    const items: CreateInvoiceItemInput[] = lineItems.map((item) => ({
      service_id: item.service_id,
      service_name: item.service_name,
      unit_price: item.unit_price,
      quantity: item.quantity,
    }));

    startTransition(async () => {
      const result = await createInvoice({
        customer_id: selectedCustomer.id,
        items,
        payment_method: paymentMethod,
        discount_pct: totalDiscountPct,
        gst_rate: gstEnabled ? gstRate : 0,
      });

      setSubmitting(false);

      if (result.success) {
        setSuccessInvoice({
          invoice_number: result.data.invoice_number,
          id: result.data.id,
        });
      } else {
        setError(result.error);
      }
    });
  }

  // Success state
  if (successInvoice) {
    return (
      <div className="mx-auto w-full max-w-lg space-y-4 px-4 sm:px-0">
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
                <svg
                  className="h-8 w-8 text-green-600 dark:text-green-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-foreground">
                Invoice Generated!
              </h2>
              <p className="text-muted-foreground">
                Invoice <span className="font-mono font-medium text-foreground">{successInvoice.invoice_number}</span> has been created successfully.
              </p>
              <div className="flex flex-col gap-2 w-full sm:flex-row sm:justify-center">
                <Button
                  variant="outline"
                  onClick={() => {
                    // TODO: Call sendInvoiceWhatsApp when Edge Function is ready
                    alert('WhatsApp delivery will be available once the send-invoice Edge Function is deployed.');
                  }}
                  aria-label="Send invoice via WhatsApp"
                >
                  <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                  </svg>
                  Send via WhatsApp
                </Button>
        <Link href="/dashboard/billing">
                  <Button>View All Invoices</Button>
                </Link>
              </div>
              <Link
                href="/dashboard/billing/new"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => {
                  setSuccessInvoice(null);
                  setSelectedCustomer(null);
                  setCustomerSearch('');
                  setLineItems([]);
                  setActiveMembership(null);
                  setPaymentMethod('cash');
                }}
              >
                Create another bill
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 px-4 sm:px-0">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard/billing"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Back to billing"
        >
          <svg className="mr-1 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </Link>
        <h1 className="text-xl font-semibold text-foreground">New Bill</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Error message */}
        {error && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Customer Selection */}
        <Card className="overflow-visible">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Customer</CardTitle>
          </CardHeader>
          <CardContent className="overflow-visible">
            <div className="relative z-20">
              <Input
                id="customer-search"
                type="text"
                placeholder="Search by name or phone..."
                value={customerSearch}
                onChange={(e) => {
                  setCustomerSearch(e.target.value);
                  if (selectedCustomer) handleClearCustomer();
                }}
                autoComplete="off"
                aria-label="Search customer by name or phone"
              />
              {selectedCustomer && (
                <button
                  type="button"
                  onClick={handleClearCustomer}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label="Clear customer selection"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
              {isSearching && (
                <div className="absolute right-2 top-1/2 -translate-y-1/2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
                </div>
              )}
              {showDropdown && customerResults.length > 0 && (
                <ul
                  className="absolute z-50 mt-1 max-h-48 w-full overflow-auto rounded-lg border border-border bg-card shadow-lg"
                  role="listbox"
                  aria-label="Customer search results"
                >
                  {customerResults.map((c) => (
                    <li key={c.id}>
                      <button
                        type="button"
                        className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-muted transition-colors"
                        onClick={() => handleSelectCustomer(c)}
                        role="option"
                        aria-selected={false}
                      >
                        <span className="font-medium text-foreground">{c.name}</span>
                        <span className="text-xs text-muted-foreground">{c.phone}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {showDropdown && customerResults.length === 0 && customerSearch.trim() && !isSearching && (
                <div className="absolute z-50 mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-muted-foreground shadow-lg">
                  No customers found
                </div>
              )}
            </div>

            {/* Membership badge */}
            {loadingMembership && selectedCustomer && (
              <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                <div className="h-3 w-3 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
                Checking membership...
              </div>
            )}
            {activeMembership && (
              <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium text-green-800 dark:bg-green-900/30 dark:text-green-300">
                <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                {activeMembership.name} — {activeMembership.discount_pct}% discount
              </div>
            )}
          </CardContent>
        </Card>

        {/* Service Line Items */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Services</CardTitle>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddLineItem}
              >
                <svg className="mr-1 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Service
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {lineItems.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No services added yet. Click &quot;Add Service&quot; to begin.
              </p>
            ) : (
              <div className="space-y-3">
                {lineItems.map((item, index) => (
                  <div
                    key={item.id}
                    className="flex flex-col gap-2 rounded-lg border border-border p-3 sm:flex-row sm:items-center"
                  >
                    {/* Service selector */}
                    <div className="flex-1">
                      <label
                        htmlFor={`service-${item.id}`}
                        className="sr-only"
                      >
                        Service {index + 1}
                      </label>
                      <select
                        id={`service-${item.id}`}
                        value={item.service_id}
                        onChange={(e) => handleServiceChange(item.id, e.target.value)}
                        className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm text-foreground transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
                        aria-label={`Select service for item ${index + 1}`}
                      >
                        <option value="">Select a service...</option>
                        {services.map((svc) => (
                          <option key={svc.id} value={svc.id}>
                            {svc.name} — {formatINR(svc.price)}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Quantity */}
                    <div className="flex items-center gap-2">
                      <label htmlFor={`qty-${item.id}`} className="text-xs text-muted-foreground whitespace-nowrap">
                        Qty:
                      </label>
                      <input
                        id={`qty-${item.id}`}
                        type="number"
                        min={1}
                        value={item.quantity}
                        onChange={(e) =>
                          handleQuantityChange(item.id, parseInt(e.target.value) || 1)
                        }
                        className="h-8 w-16 rounded-lg border border-input bg-transparent px-2 text-center text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
                        aria-label={`Quantity for item ${index + 1}`}
                      />
                    </div>

                    {/* Line total */}
                    <div className="min-w-[80px] text-right text-sm font-medium text-foreground">
                      {item.service_id ? formatINR(item.unit_price * item.quantity) : '—'}
                    </div>

                    {/* Remove button */}
                    <button
                      type="button"
                      onClick={() => handleRemoveLineItem(item.id)}
                      className="self-start text-muted-foreground hover:text-destructive transition-colors sm:self-center"
                      aria-label={`Remove service item ${index + 1}`}
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Billing Options */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Billing Options</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* GST Info (auto from settings) */}
            {gstEnabled && (
              <div className="flex items-center justify-between rounded-lg bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800/30 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-emerald-800 dark:text-emerald-200">GST ({gstRate}%) will be applied</p>
                  <p className="text-xs text-emerald-600 dark:text-emerald-400">Configured in Settings</p>
                </div>
                <Link href="/dashboard/settings" className="text-xs text-emerald-700 dark:text-emerald-400 hover:underline">
                  Change
                </Link>
              </div>
            )}

            {/* Payment Method */}
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">Payment Method</p>
              <div className="flex flex-wrap gap-2 sm:gap-3" role="radiogroup" aria-label="Payment method">
                {(['cash', 'upi', 'card'] as PaymentMethod[]).map((method) => (
                  <label
                    key={method}
                    className={`inline-flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2.5 sm:py-2 text-sm transition-colors min-h-[44px] ${
                      paymentMethod === method
                        ? 'border-primary bg-primary/5 text-primary font-medium'
                        : 'border-border text-muted-foreground hover:border-foreground/30'
                    }`}
                  >
                    <input
                      type="radio"
                      name="payment-method"
                      value={method}
                      checked={paymentMethod === method}
                      onChange={() => setPaymentMethod(method)}
                      className="sr-only"
                      aria-label={method.toUpperCase()}
                    />
                    <span className="capitalize">{method === 'upi' ? 'UPI' : method.charAt(0).toUpperCase() + method.slice(1)}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Additional Discount */}
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">
                {baseDiscount > 0 ? 'Additional Discount' : 'Discount'}
              </p>

              {/* Show membership/default discount info */}
              {baseDiscount > 0 && (
                <div className="rounded-lg bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/30 px-4 py-2.5 mb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400">
                        👑 {membershipDiscount > defaultDiscount ? activeMembership?.name : 'Default'}
                      </span>
                    </div>
                    <span className="text-sm font-semibold text-amber-700 dark:text-amber-300">
                      {baseDiscount}% off
                    </span>
                  </div>
                </div>
              )}

              <p className="text-xs text-muted-foreground">
                {baseDiscount > 0 ? 'Add extra discount on top of membership discount' : 'Apply a discount to this bill'}
              </p>
              <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                {[0, 5, 10, 15, 20].map((pct) => (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => setAdditionalDiscountPct(pct)}
                    className={`rounded-xl border px-3 py-2.5 text-sm font-medium transition-all min-h-[44px] min-w-[48px] ${
                      additionalDiscountPct === pct
                        ? 'border-pink-500 bg-pink-50 text-pink-600 dark:bg-pink-900/20 dark:border-pink-700'
                        : 'border-border text-muted-foreground hover:border-pink-300'
                    }`}
                  >
                    {pct === 0 ? 'None' : `+${pct}%`}
                  </button>
                ))}
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={additionalDiscountPct || ''}
                  onChange={(e) => setAdditionalDiscountPct(Math.min(100, Math.max(0, Number(e.target.value) || 0)))}
                  placeholder="Custom"
                  className="w-20 rounded-xl border border-border px-3 py-2.5 text-sm text-center min-h-[44px]"
                />
              </div>

              {/* Total discount summary */}
              {totalDiscountPct > 0 && baseDiscount > 0 && additionalDiscountPct > 0 && (
                <div className="rounded-lg bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800/30 px-4 py-2 mt-2">
                  <div className="flex items-center justify-between text-xs text-emerald-600 dark:text-emerald-400">
                    <span>{membershipDiscount > defaultDiscount ? 'Membership' : 'Default'} ({baseDiscount}%) + Additional ({additionalDiscountPct}%)</span>
                    <span className="font-medium">= {totalDiscountPct}% total</span>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Totals */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="text-foreground">{formatINR(totals.subtotal)}</span>
              </div>

              {totalDiscountPct > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-green-600 dark:text-green-400">
                    {baseDiscount > 0 && additionalDiscountPct > 0
                      ? `Discount (${baseDiscount}% + ${additionalDiscountPct}% = ${totalDiscountPct}%)`
                      : baseDiscount > 0
                        ? `${membershipDiscount > defaultDiscount ? 'Membership' : 'Default'} Discount (${totalDiscountPct}%)`
                        : `Discount (${totalDiscountPct}%)`
                    }
                  </span>
                  <span className="text-green-600 dark:text-green-400">
                    −{formatINR(totals.discountAmount)}
                  </span>
                </div>
              )}

              {gstEnabled && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">GST ({gstRate}%)</span>
                  <span className="text-foreground">+{formatINR(totals.gstAmount)}</span>
                </div>
              )}

              <div className="border-t border-border pt-2 mt-2">
                <div className="flex items-center justify-between">
                  <span className="text-base font-semibold text-foreground">Total</span>
                  <span className="text-lg font-bold text-foreground">
                    {formatINR(totals.total)}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Submit */}
        <div className="flex items-center gap-3">
          <Button
            type="submit"
            disabled={!isFormValid || submitting || isPending}
            className="flex-1 sm:flex-none"
          >
            {submitting || isPending ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                Generating Bill...
              </span>
            ) : (
              'Generate Bill'
            )}
          </Button>
          <Link href="/dashboard/billing">
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </Link>
        </div>
      </form>
    </div>
  );
}
