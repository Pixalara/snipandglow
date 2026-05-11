'use client';

import { useState, useEffect, useCallback, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
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

/** Get date 30 days from today in YYYY-MM-DD format */
function getMaxDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d.toISOString().split('T')[0];
}

interface CustomerOption {
  id: string;
  name: string;
  phone: string;
}

export default function NewAppointmentPage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Form state
  const [customerId, setCustomerId] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerResults, setCustomerResults] = useState<CustomerOption[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerOption | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  const [serviceId, setServiceId] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [appointmentDate, setAppointmentDate] = useState('');
  const [selectedSlot, setSelectedSlot] = useState('');

  // Data state
  const [services, setServices] = useState<Service[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);

  // Derived
  const selectedService = services.find((s) => s.id === serviceId);
  const duration = selectedService?.duration_minutes ?? 0;

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

  // Fetch available slots when employee + date + service are selected
  const fetchSlots = useCallback(async () => {
    if (!employeeId || !appointmentDate || !duration) return;

    setLoadingSlots(true);
    setSlots([]);
    setSelectedSlot('');

    const available = await getAvailableSlots(employeeId, appointmentDate, duration);
    setSlots(available);
    setLoadingSlots(false);
  }, [employeeId, appointmentDate, duration]);

  useEffect(() => {
    fetchSlots();
  }, [fetchSlots]);

  // Form validation
  const isFormValid = customerId && serviceId && employeeId && appointmentDate && selectedSlot;

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
        service_id: serviceId,
        employee_id: employeeId,
        appointment_date: appointmentDate,
        start_time: startTime,
        end_time: endTime,
      });

      setSubmitting(false);

      if (result.success) {
        router.push('/dashboard/appointments?success=booked');
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
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
              <label htmlFor="service" className="text-sm font-medium text-foreground">
                Service <span className="text-destructive">*</span>
              </label>
              <select
                id="service"
                value={serviceId}
                onChange={(e) => {
                  setServiceId(e.target.value);
                  setSelectedSlot('');
                }}
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm text-foreground transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
                aria-label="Select a service"
              >
                <option value="">Select a service...</option>
                {services.map((svc) => (
                  <option key={svc.id} value={svc.id}>
                    {svc.name} — {svc.duration_minutes} min — ₹{svc.price}
                  </option>
                ))}
              </select>
              {selectedService && (
                <p className="text-xs text-muted-foreground">
                  Duration: {selectedService.duration_minutes} minutes
                </p>
              )}
            </div>

            {/* Employee/Stylist selection */}
            <div className="space-y-1.5">
              <label htmlFor="employee" className="text-sm font-medium text-foreground">
                Stylist <span className="text-destructive">*</span>
              </label>
              <select
                id="employee"
                value={employeeId}
                onChange={(e) => {
                  setEmployeeId(e.target.value);
                  setSelectedSlot('');
                }}
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm text-foreground transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
                aria-label="Select a stylist"
              >
                <option value="">Select a stylist...</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name}
                    {emp.specializations?.length > 0
                      ? ` (${emp.specializations.join(', ')})`
                      : ''}
                  </option>
                ))}
              </select>
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
              {!employeeId || !appointmentDate || !serviceId ? (
                <p className="text-xs text-muted-foreground">
                  Select a service, stylist, and date to see available slots.
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
