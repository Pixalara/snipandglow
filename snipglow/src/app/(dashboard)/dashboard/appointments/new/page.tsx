'use client';

import { useState, useEffect, useCallback, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { SearchableSelect } from '@/components/searchable-select';
import { Scissors, X } from 'lucide-react';
import {
  createAppointment,
  getAvailableSlots,
  getActiveServices,
  getActiveEmployees,
  searchCustomers,
} from '../actions';
import type { Service, Employee, TimeSlot } from '@/types';

// =============================================================================
// New Appointment Booking Page — Client Component
// Interactive form with slot availability fetching.
// Requirements: 4.2, 4.3, 4.4
// =============================================================================

/** Format a time string (HH:MM:SS or HH:MM) to 12-hour AM/PM display */
function formatSlotTime(time: string): string {
  const [hours, minutes] = time.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHour = hours % 12 || 12;
  return `${displayHour}:${minutes.toString().padStart(2, '0')} ${period}`;
}

/** Get today's date in YYYY-MM-DD format */
function getToday(): string {
  const now = new Date();
  return now.toISOString().split('T')[0];
}

/** Get date 7 days from today in YYYY-MM-DD format */
function getMaxDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return d.toISOString().split('T')[0];
}

interface CustomerOption {
  id: string;
  name: string;
  phone: string;
}

export default function NewAppointmentPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  // Pre-fill from query params (from customer profile "Book Appointment" button)
  const prefillCustomerId = searchParams.get('customer_id') || '';
  const prefillCustomerName = searchParams.get('customer_name') || '';

  // Form state
  const [customerId, setCustomerId] = useState(prefillCustomerId);
  const [customerSearch, setCustomerSearch] = useState(prefillCustomerName);
  const [customerResults, setCustomerResults] = useState<CustomerOption[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerOption | null>(
    prefillCustomerId ? { id: prefillCustomerId, name: prefillCustomerName, phone: '' } : null
  );
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [appointmentDate, setAppointmentDate] = useState('');
  const [selectedSlot, setSelectedSlot] = useState('');

  // Data state
  const [services, setServices] = useState<Service[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);

  // Selected services (duration not used — multiple bookings allowed per fixed slot)
  const selectedServices = services.filter((s) => selectedServiceIds.includes(s.id));

  // Error/success state
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Load services and employees on mount
  useEffect(() => {
    async function loadData() {
      const [svcData, empData] = await Promise.all([
        getActiveServices(),
        getActiveEmployees(),
      ]);
      setServices(svcData);
      setEmployees(empData);
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

  // Fetch available slots when date is selected
  const fetchSlots = useCallback(async () => {
    if (!appointmentDate || selectedServiceIds.length === 0 || employees.length === 0) return;

    setLoadingSlots(true);
    setSlots([]);
    setSelectedSlot('');

    // Use first employee for slot calculation
    const available = await getAvailableSlots(employees[0].id, appointmentDate);
    setSlots(available);
    setLoadingSlots(false);
  }, [appointmentDate, selectedServiceIds, employees]);

  useEffect(() => {
    fetchSlots();
  }, [fetchSlots]);

  // Form validation
  const isFormValid = customerId && selectedServiceIds.length > 0 && appointmentDate && selectedSlot;

  // Handle customer selection
  function handleSelectCustomer(customer: CustomerOption) {
    setSelectedCustomer(customer);
    setCustomerId(customer.id);
    setCustomerSearch(customer.name);
    setShowDropdown(false);
    setCustomerResults([]);
  }

  // Clear customer selection
  function handleClearCustomer() {
    setSelectedCustomer(null);
    setCustomerId('');
    setCustomerSearch('');
    setCustomerResults([]);
  }

  // Handle form submission
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isFormValid) return;

    setError('');
    setSubmitting(true);

    // Parse selected slot to get start_time and end_time
    const [startTime, endTime] = selectedSlot.split('|');

    startTransition(async () => {
      const result = await createAppointment({
        customer_id: customerId,
        service_id: selectedServiceIds[0], // Primary service
        extra_service_ids: selectedServiceIds, // All services
        employee_id: employees[0]?.id || '',
        appointment_date: appointmentDate,
        start_time: startTime,
        end_time: endTime,
      });

      setSubmitting(false);

      if (result.success) {
        // The old `?success=booked` param was never read by the appointments
        // page, so the most common action in the product confirmed nothing.
        toast.success('Appointment booked.');
        router.push('/dashboard/appointments');
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4 px-4 sm:px-0">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard/appointments"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Back to appointments"
        >
          <svg className="mr-1 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </Link>
        <h1 className="text-xl font-semibold text-foreground">New Appointment</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Book an Appointment</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Error message */}
            {error && (
              <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}

            {/* Customer search */}
            <div className="space-y-1.5">
              <label htmlFor="customer-search" className="text-sm font-medium text-foreground">
                Customer <span className="text-destructive">*</span>
              </label>
              <div className="relative">
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
                  aria-describedby="customer-hint"
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
                {/* Dropdown results */}
                {showDropdown && customerResults.length > 0 && (
                  <ul
                    className="absolute z-10 mt-1 max-h-48 w-full overflow-auto rounded-lg border border-border bg-card shadow-lg"
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
                  <div className="absolute z-10 mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-muted-foreground shadow-lg">
                    No customers found
                  </div>
                )}
              </div>
              <p id="customer-hint" className="text-xs text-muted-foreground">
                Type at least 2 characters to search
              </p>
            </div>

            {/* Service selection */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">
                Services <span className="text-destructive">*</span>
              </label>

              {/* Search or browse — matches by name AND category ("hair", "skin") */}
              <SearchableSelect
                value=""
                onChange={(id) => {
                  if (id && !selectedServiceIds.includes(id)) {
                    setSelectedServiceIds((prev) => [...prev, id]);
                    setSelectedSlot('');
                  }
                }}
                placeholder={selectedServiceIds.length === 0 ? 'Search or browse services…' : 'Add another service…'}
                emptyText="No service found"
                ariaLabel="Search or select a service"
                options={services
                  .filter((svc) => !selectedServiceIds.includes(svc.id))
                  .map((svc) => ({
                    value: svc.id,
                    label: svc.name,
                    hint: `₹${svc.price.toLocaleString('en-IN')}`,
                    category: svc.category ?? null,
                  }))}
              />

              {/* Selected services — clear cards with price + running total */}
              {selectedServices.length > 0 && (
                <div className="mt-2 space-y-1.5">
                  {selectedServices.map((svc) => (
                    <div
                      key={svc.id}
                      className="flex items-center justify-between gap-2 rounded-xl border border-pink-200/70 dark:border-pink-800/40 bg-pink-50/60 dark:bg-pink-900/15 px-3 py-2"
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <Scissors className="size-3.5 shrink-0 text-pink-500" />
                        <span className="truncate text-sm font-medium text-foreground">{svc.name}</span>
                        {svc.category && (
                          <span className="shrink-0 rounded-full bg-white/70 dark:bg-white/10 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                            {svc.category}
                          </span>
                        )}
                      </span>
                      <span className="flex shrink-0 items-center gap-2">
                        <span className="text-sm font-semibold text-foreground">
                          ₹{svc.price.toLocaleString('en-IN')}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedServiceIds((prev) => prev.filter((id) => id !== svc.id));
                            setSelectedSlot('');
                          }}
                          className="text-muted-foreground transition-colors hover:text-red-600"
                          aria-label={`Remove ${svc.name}`}
                        >
                          <X className="size-4" />
                        </button>
                      </span>
                    </div>
                  ))}

                  <div className="flex items-center justify-between rounded-xl bg-muted/50 px-3 py-2">
                    <span className="text-xs font-medium text-muted-foreground">
                      {selectedServices.length} service{selectedServices.length !== 1 ? 's' : ''} selected
                    </span>
                    <span className="text-sm font-bold text-foreground">
                      ₹{selectedServices.reduce((sum, s) => sum + s.price, 0).toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Date picker */}
            <div className="space-y-1.5">
              <label htmlFor="date" className="text-sm font-medium text-foreground">
                Date <span className="text-destructive">*</span>
              </label>
              <Input
                id="date"
                type="date"
                value={appointmentDate}
                onChange={(e) => {
                  setAppointmentDate(e.target.value);
                  setSelectedSlot('');
                }}
                min={getToday()}
                max={getMaxDate()}
                aria-label="Select appointment date"
              />
            </div>

            {/* Time Slot selection */}
            <div className="space-y-1.5">
              <label htmlFor="timeslot" className="text-sm font-medium text-foreground">
                Time Slot <span className="text-destructive">*</span>
              </label>
              {!appointmentDate || selectedServiceIds.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Select a service and date to see available slots.
                </p>
              ) : loadingSlots ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
                  Loading available slots...
                </div>
              ) : slots.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No available slots for this date. Try a different date or stylist.
                </p>
              ) : (
                <select
                  id="timeslot"
                  value={selectedSlot}
                  onChange={(e) => setSelectedSlot(e.target.value)}
                  className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm text-foreground transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
                  aria-label="Select a time slot"
                >
                  <option value="">Select a time slot...</option>
                  {slots.map((slot) => (
                    <option
                      key={`${slot.slot_start}-${slot.slot_end}`}
                      value={`${slot.slot_start}|${slot.slot_end}`}
                    >
                      {formatSlotTime(slot.slot_start)} - {formatSlotTime(slot.slot_end)}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Submit */}
            <div className="flex items-center gap-3 pt-2">
              <Button
                type="submit"
                disabled={!isFormValid || submitting || isPending}
              >
                {submitting || isPending ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                    Booking...
                  </span>
                ) : (
                  'Book Appointment'
                )}
              </Button>
              <Link href="/dashboard/appointments">
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
