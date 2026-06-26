'use client';

import { useState, useEffect, useTransition, useCallback } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { calculatePerItemInvoiceTotal, formatINR } from '@/lib/utils';
import { clampWalletUse } from '@/lib/wallet';
import { searchCustomers, getActiveServices } from '../../appointments/actions';
import { createInvoice, getCustomerActiveMembership, getTenantGstSettings, getBillableProducts, type BillableProduct } from '../actions';
import { getAvailableMemberships } from '../../customers/actions';
import { getCustomerWalletBalance } from '../../customers/wallet-actions';
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
  /** The <select> value: a service id, `plan-<id>`, or `product-<id>`. */
  selectKey: string;
  item_type: 'service' | 'product';
  service_id: string; // service id or membership plan id (empty for products)
  product_id?: string; // product id (for product items)
  service_name: string;
  unit_price: number;
  quantity: number;
  /** Per-line discount percentage (0–100). */
  discount_pct: number;
  /** Available stock for product items (client-side hint). */
  maxStock?: number;
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
  const [products, setProducts] = useState<BillableProduct[]>([]);
  const [membershipPlans, setMembershipPlans] = useState<Membership[]>([]);
  const [lineItems, setLineItems] = useState<LineItem[]>([]);

  // Billing options
  const [gstEnabled, setGstEnabled] = useState(false);
  const [gstRate, setGstRate] = useState(0);
  const [defaultDiscount, setDefaultDiscount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');

  // Wallet state
  const [walletBalance, setWalletBalance] = useState(0);
  const [useWallet, setUseWallet] = useState(false);
  const [walletAmountInput, setWalletAmountInput] = useState('');

  // UI state
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [successInvoice, setSuccessInvoice] = useState<{
    invoice_number: string;
    id: string;
  } | null>(null);

  // Load services, membership plans, and GST settings on mount
  useEffect(() => {
    async function loadData() {
      const [svcData, membData, gstSettings, prodData] = await Promise.all([
        getActiveServices(),
        getAvailableMemberships(),
        getTenantGstSettings(),
        getBillableProducts(),
      ]);
      setServices(svcData);
      setMembershipPlans(membData);
      setProducts(prodData);
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

  // Fetch wallet balance when a customer is selected.
  useEffect(() => {
    if (!selectedCustomer) {
      setWalletBalance(0);
      setUseWallet(false);
      setWalletAmountInput('');
      return;
    }
    getCustomerWalletBalance(selectedCustomer.id)
      .then((b) => setWalletBalance(b))
      .catch(() => setWalletBalance(0));
  }, [selectedCustomer]);

  // Per-item discounts. Membership / tenant-default % becomes the default
  // discount on each line (the user can override any line).
  const membershipDiscount = activeMembership?.discount_pct ?? 0;
  const defaultLineDiscount = Math.max(membershipDiscount, defaultDiscount);
  const totals = calculatePerItemInvoiceTotal({
    lineItems: lineItems.map((item) => ({
      price: item.unit_price,
      quantity: item.quantity,
      discountPct: item.discount_pct,
    })),
    gstRate: gstEnabled ? gstRate : 0,
  });

  // Wallet application (display + clamp only; the server re-validates & debits).
  const requestedWallet = useWallet ? Number(walletAmountInput || 0) : 0;
  const walletApplied = clampWalletUse(requestedWallet, totals.total, walletBalance);
  const payable = Math.max(0, totals.total - walletApplied);

  // When the default discount becomes known (membership loads / settings),
  // apply it to any line that hasn't been given its own discount yet.
  useEffect(() => {
    if (defaultLineDiscount <= 0) return;
    setLineItems((prev) =>
      prev.some((li) => li.discount_pct === 0)
        ? prev.map((li) => (li.discount_pct === 0 ? { ...li, discount_pct: defaultLineDiscount } : li))
        : prev
    );
  }, [defaultLineDiscount]);

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
    setWalletBalance(0);
    setUseWallet(false);
    setWalletAmountInput('');
  }

  function handleAddLineItem() {
    setLineItems((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        selectKey: '',
        item_type: 'service',
        service_id: '',
        product_id: undefined,
        service_name: '',
        unit_price: 0,
        quantity: 1,
        discount_pct: defaultLineDiscount,
        maxStock: undefined,
      },
    ]);
  }

  function handleDiscountChange(itemId: string, pct: number) {
    const v = Math.min(100, Math.max(0, Number.isFinite(pct) ? pct : 0));
    setLineItems((prev) =>
      prev.map((item) => (item.id === itemId ? { ...item, discount_pct: v } : item))
    );
  }

  function handleRemoveLineItem(id: string) {
    setLineItems((prev) => prev.filter((item) => item.id !== id));
  }

  function handleServiceChange(itemId: string, selectKey: string) {
    // Membership plan (prefixed with "plan-")
    if (selectKey.startsWith('plan-')) {
      const planId = selectKey.replace('plan-', '');
      const plan = membershipPlans.find((p) => p.id === planId);
      if (!plan) return;
      setLineItems((prev) =>
        prev.map((item) =>
          item.id === itemId
            ? {
                ...item,
                selectKey,
                item_type: 'service',
                service_id: planId,
                product_id: undefined,
                service_name: `👑 ${plan.name} (Membership)`,
                unit_price: plan.price,
                maxStock: undefined,
              }
            : item
        )
      );
      return;
    }

    // Product (prefixed with "product-")
    if (selectKey.startsWith('product-')) {
      const productId = selectKey.replace('product-', '');
      const product = products.find((p) => p.id === productId);
      if (!product) return;
      setLineItems((prev) =>
        prev.map((item) =>
          item.id === itemId
            ? {
                ...item,
                selectKey,
                item_type: 'product',
                service_id: '',
                product_id: product.id,
                service_name: product.name,
                unit_price: Number(product.selling_price),
                maxStock: Number(product.stock_quantity),
                // clamp existing quantity to available stock
                quantity: Math.min(item.quantity, Math.max(1, Number(product.stock_quantity))),
              }
            : item
        )
      );
      return;
    }

    // Service
    const service = services.find((s) => s.id === selectKey);
    if (!service) return;
    setLineItems((prev) =>
      prev.map((item) =>
        item.id === itemId
          ? {
              ...item,
              selectKey,
              item_type: 'service',
              service_id: service.id,
              product_id: undefined,
              service_name: service.name,
              unit_price: service.price,
              maxStock: undefined,
            }
          : item
      )
    );
  }

  function handleQuantityChange(itemId: string, quantity: number) {
    if (quantity < 1) return;
    setLineItems((prev) =>
      prev.map((item) => {
        if (item.id !== itemId) return item;
        // Don't allow product quantity above available stock.
        const capped = item.item_type === 'product' && item.maxStock != null
          ? Math.min(quantity, item.maxStock)
          : quantity;
        return { ...item, quantity: Math.max(1, capped) };
      })
    );
  }

  const isFormValid =
    selectedCustomer &&
    lineItems.length > 0 &&
    lineItems.every((item) => item.selectKey) &&
    paymentMethod;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isFormValid || !selectedCustomer) return;

    setError('');
    setSubmitting(true);

    const items: CreateInvoiceItemInput[] = lineItems.map((item) => ({
      service_id: item.item_type === 'product' ? '' : item.service_id,
      product_id: item.item_type === 'product' ? item.product_id : undefined,
      item_type: item.item_type,
      service_name: item.service_name,
      unit_price: item.unit_price,
      quantity: item.quantity,
      discount_pct: item.discount_pct,
    }));

    startTransition(async () => {
      const result = await createInvoice({
        customer_id: selectedCustomer.id,
        items,
        payment_method: paymentMethod,
        gst_rate: gstEnabled ? gstRate : 0,
        wallet_amount: walletApplied > 0 ? walletApplied : undefined,
      });

      setSubmitting(false);

      if (result.success) {
        // Refresh products so stock hints reflect the just-completed sale.
        getBillableProducts().then(setProducts).catch(() => {});
        setSuccessInvoice({
          invoice_number: result.data.invoice_number,
          id: result.data.id,
        });
      } else {
        // Stock may have changed elsewhere; refresh hints on failure too.
        getBillableProducts().then(setProducts).catch(() => {});
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
                  setWalletBalance(0);
                  setUseWallet(false);
                  setWalletAmountInput('');
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

        {/* Service & Product Line Items */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Services &amp; Products</CardTitle>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddLineItem}
              >
                <svg className="mr-1 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Item
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {lineItems.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No items added yet. Click &quot;Add Item&quot; to add a service or product.
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
                        value={item.selectKey}
                        onChange={(e) => handleServiceChange(item.id, e.target.value)}
                        className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm text-foreground transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
                        aria-label={`Select service or product for item ${index + 1}`}
                      >
                        <option value="">Select a service, product or plan...</option>
                        <optgroup label="Services">
                          {services.map((svc) => (
                            <option key={svc.id} value={svc.id}>
                              {svc.name} — {formatINR(svc.price)}
                            </option>
                          ))}
                        </optgroup>
                        {products.length > 0 && (
                          <optgroup label="Products">
                            {products.map((prod) => (
                              <option key={`product-${prod.id}`} value={`product-${prod.id}`} disabled={prod.stock_quantity <= 0}>
                                {prod.name} — {formatINR(Number(prod.selling_price))}
                                {prod.stock_quantity <= 0 ? ' (Out of stock)' : ` (${prod.stock_quantity} in stock)`}
                              </option>
                            ))}
                          </optgroup>
                        )}
                        {membershipPlans.length > 0 && (
                          <optgroup label="Membership Plans">
                            {membershipPlans.map((plan) => (
                              <option key={`plan-${plan.id}`} value={`plan-${plan.id}`}>
                                👑 {plan.name} — {formatINR(plan.price)} ({plan.validity_days} days)
                              </option>
                            ))}
                          </optgroup>
                        )}
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
                        max={item.item_type === 'product' && item.maxStock != null ? item.maxStock : undefined}
                        value={item.quantity}
                        onChange={(e) =>
                          handleQuantityChange(item.id, parseInt(e.target.value) || 1)
                        }
                        className="h-8 w-16 rounded-lg border border-input bg-transparent px-2 text-center text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
                        aria-label={`Quantity for item ${index + 1}`}
                      />
                    </div>

                    {/* Per-item discount */}
                    <div className="flex items-center gap-2">
                      <label htmlFor={`disc-${item.id}`} className="text-xs text-muted-foreground whitespace-nowrap">
                        Disc %:
                      </label>
                      <input
                        id={`disc-${item.id}`}
                        type="number"
                        min={0}
                        max={100}
                        value={item.discount_pct || ''}
                        placeholder="0"
                        onChange={(e) => handleDiscountChange(item.id, parseInt(e.target.value) || 0)}
                        disabled={!item.selectKey}
                        className="h-8 w-16 rounded-lg border border-input bg-transparent px-2 text-center text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30 disabled:opacity-50"
                        aria-label={`Discount percent for item ${index + 1}`}
                      />
                    </div>

                    {/* Line total */}
                    <div className="min-w-[88px] text-right text-sm font-medium text-foreground">
                      {item.selectKey ? (
                        item.discount_pct > 0 ? (
                          <div className="flex flex-col items-end leading-tight">
                            <span className="text-[11px] text-muted-foreground line-through">
                              {formatINR(item.unit_price * item.quantity)}
                            </span>
                            <span>
                              {formatINR(item.unit_price * item.quantity - Math.round((item.unit_price * item.quantity * item.discount_pct) / 100))}
                            </span>
                          </div>
                        ) : (
                          formatINR(item.unit_price * item.quantity)
                        )
                      ) : (
                        '—'
                      )}
                    </div>

                    {/* Remove button */}
                    <button
                      type="button"
                      onClick={() => handleRemoveLineItem(item.id)}
                      className="self-start text-muted-foreground hover:text-destructive transition-colors sm:self-center"
                      aria-label={`Remove item ${index + 1}`}
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

            {/* Use Wallet Balance */}
            {selectedCustomer && walletBalance > 0 && (
              <div className="space-y-2 rounded-lg border border-violet-200 dark:border-violet-800/30 bg-violet-50/50 dark:bg-violet-900/10 p-3">
                <label className="flex flex-wrap items-center gap-x-2 gap-y-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={useWallet}
                    onChange={(e) => {
                      const on = e.target.checked;
                      setUseWallet(on);
                      if (on) setWalletAmountInput(String(Math.min(walletBalance, totals.total)));
                    }}
                    className="size-4 rounded border-border text-primary focus:ring-primary/30"
                  />
                  <span className="text-sm font-medium text-foreground">Use wallet balance</span>
                  <span className="ml-auto text-xs text-muted-foreground whitespace-nowrap">
                    Available: <span className="font-semibold text-foreground">{formatINR(walletBalance)}</span>
                  </span>
                </label>
                {useWallet && (
                  <div className="flex items-center gap-2">
                    <label htmlFor="wallet-use-amount" className="text-xs text-muted-foreground whitespace-nowrap">
                      Wallet ₹:
                    </label>
                    <input
                      id="wallet-use-amount"
                      type="number"
                      min={0}
                      max={Math.min(walletBalance, totals.total)}
                      value={walletAmountInput}
                      onChange={(e) => setWalletAmountInput(e.target.value)}
                      className="h-8 w-28 rounded-lg border border-input bg-transparent px-2 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
                      aria-label="Wallet amount to apply"
                    />
                    <button
                      type="button"
                      onClick={() => setWalletAmountInput(String(Math.min(walletBalance, totals.total)))}
                      className="text-xs font-medium text-primary hover:underline"
                    >
                      Max
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Per-item discounts are entered per line above. The customer's
                membership / default discount is auto-applied as each line's
                default and can be overridden per item. */}
            {defaultLineDiscount > 0 && (
              <div className="rounded-lg bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/30 px-4 py-2.5">
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  {membershipDiscount > defaultDiscount
                    ? `Membership discount of ${defaultLineDiscount}% is applied to each item by default — adjust the "Disc %" on any line as needed.`
                    : `Default discount of ${defaultLineDiscount}% is applied to each item — adjust the "Disc %" on any line as needed.`}
                </p>
              </div>
            )}
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

              {totals.discountAmount > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-green-600 dark:text-green-400">
                    Discount (per item)
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

                {walletApplied > 0 && (
                  <div className="mt-2 space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-violet-600 dark:text-violet-400">Wallet Used</span>
                      <span className="text-violet-600 dark:text-violet-400">−{formatINR(walletApplied)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-base font-semibold text-foreground">Payable Now</span>
                      <span className="text-lg font-bold text-foreground">{formatINR(payable)}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Wallet balance after: {formatINR(Math.max(0, walletBalance - walletApplied))}
                    </p>
                  </div>
                )}
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
