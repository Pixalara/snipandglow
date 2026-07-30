'use client';

import { useMemo, useState, useTransition, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { formatTimeIST, formatDateIN, calculatePerItemInvoiceTotal } from '@/lib/utils';
import {
  updateAppointmentStatus, completeAndGenerateBill,
  getSlotsForReschedule, rescheduleAppointment,
  getCustomerMembershipDiscount, getActiveServices, getActiveEmployees, getActiveProducts,
} from './actions';
import {
  CalendarClock, CircleCheck, XCircle, X, User, Scissors,
  Clock, Calendar, Pencil, CheckCircle2, ArrowRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { SearchableSelect } from '@/components/searchable-select';
import type { AppointmentRow } from './page';
import type { AppointmentStatus, TimeSlot } from '@/types';

const blockColors: Record<AppointmentStatus, string> = {
  booked: 'border-blue-300 bg-blue-50 dark:border-blue-700 dark:bg-blue-900/20',
  confirmed: 'border-emerald-300 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-900/20',
  completed: 'border-gray-300 bg-gray-50 dark:border-gray-700 dark:bg-gray-900/20',
  cancelled: 'border-red-300 bg-red-50 dark:border-red-700 dark:bg-red-900/20',
};
const dotColors: Record<AppointmentStatus, string> = {
  booked: 'bg-blue-500', confirmed: 'bg-emerald-500', completed: 'bg-gray-500', cancelled: 'bg-red-500',
};
const statusBadgeColors: Record<AppointmentStatus, string> = {
  booked: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  confirmed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  completed: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400',
  cancelled: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};
const statusLabels: Record<AppointmentStatus, string> = {
  booked: 'Booked', confirmed: 'Confirmed', completed: 'Completed', cancelled: 'Cancelled',
};

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}
function getWeekDays(start: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start); d.setDate(start.getDate() + i); return d;
  });
}
function toDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}
const dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

export function CalendarView({ appointments, focusDate }: { appointments: AppointmentRow[]; focusDate?: string }) {
  const todayDate = useMemo(() => startOfToday(), []);
  const today = toDateKey(todayDate);
  // Rolling window: starts today by default; the date filter lets the owner
  // jump the 7-day window to any start date.
  const [startKey, setStartKey] = useState<string>(today);

  // When a Date/Month/Week filter is chosen in the toolbar, jump the calendar's
  // 7-day window to that date (exact date, week's Monday, or month's 1st).
  useEffect(() => {
    if (focusDate) setStartKey(focusDate);
  }, [focusDate]);

  const weekStart = useMemo(() => new Date(startKey + 'T00:00:00'), [startKey]);
  const weekDays = useMemo(() => getWeekDays(weekStart), [weekStart]);
  const [selected, setSelected] = useState<AppointmentRow | null>(null);
  const [mode, setMode] = useState<'detail' | 'complete' | 'reschedule'>('detail');

  const appointmentsByDate = useMemo(() => {
    const map: Record<string, AppointmentRow[]> = {};
    for (const apt of appointments) {
      if (!map[apt.appointment_date]) map[apt.appointment_date] = [];
      map[apt.appointment_date].push(apt);
    }
    for (const key of Object.keys(map)) map[key].sort((a,b) => a.start_time.localeCompare(b.start_time));
    return map;
  }, [appointments]);

  function openDetail(apt: AppointmentRow) { setSelected(apt); setMode('detail'); }
  function closeAll() { setSelected(null); setMode('detail'); }

  const rangeLabel = `${weekDays[0].toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} – ${weekDays[6].toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`;

  return (
    <div className="space-y-3">
      {/* Date filter + legend */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-xs font-medium text-muted-foreground">From</label>
          <input
            type="date"
            value={startKey}
            onChange={(e) => setStartKey(e.target.value || today)}
            className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
          <span className="text-xs text-muted-foreground">{rangeLabel}</span>
          {startKey !== today && (
            <button
              type="button"
              onClick={() => setStartKey(today)}
              className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            >
              Today
            </button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          {(['booked','completed','cancelled'] as AppointmentStatus[]).map(s => (
            <span key={s} className="flex items-center gap-1">
              <span className={`size-2 rounded-full ${dotColors[s]}`} />
              {statusLabels[s]}
            </span>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-7">
        {weekDays.map((day) => {
          const dateKey = toDateKey(day);
          const isToday = dateKey === today;
          const dayApts = appointmentsByDate[dateKey] ?? [];
          return (
            <div key={dateKey} className={`rounded-lg border p-2 ${isToday ? 'border-primary/50 bg-primary/5' : 'border-border bg-card'}`}>
              <div className="mb-2 text-center">
                <div className="text-xs font-medium text-muted-foreground">{dayNames[day.getDay()]}</div>
                <div className={`text-sm font-semibold ${isToday ? 'text-primary' : 'text-foreground'}`}>{day.getDate()}</div>
              </div>
              <div className="space-y-1.5">
                {dayApts.length === 0 && <p className="text-center text-[10px] text-muted-foreground/60">No appointments</p>}
                {dayApts.map(apt => (
                  <button key={apt.id} type="button" onClick={() => openDetail(apt)}
                    className={`w-full text-left rounded-md border p-1.5 text-[11px] leading-tight cursor-pointer hover:shadow-md hover:scale-[1.02] transition-all ${blockColors[apt.status]}`}>
                    <div className="flex items-center gap-1">
                      <span className={`size-1.5 shrink-0 rounded-full ${dotColors[apt.status]}`} />
                      <span className="truncate font-medium text-foreground">{apt.customer_name}</span>
                    </div>
                    <div className="mt-0.5 truncate text-muted-foreground">{apt.service_name}</div>
                    <div className="mt-0.5 text-muted-foreground">{formatTimeIST(`1970-01-01T${apt.start_time}`)}</div>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      {selected && mode === 'detail' && (
        <AppointmentDetailPopup appointment={selected} onClose={closeAll}
          onComplete={() => setMode('complete')} onReschedule={() => setMode('reschedule')} />
      )}
      {selected && mode === 'complete' && (
        <CompleteAndBillModal appointment={selected} onClose={closeAll} />
      )}
      {selected && mode === 'reschedule' && (
        <RescheduleModal appointment={selected} onClose={closeAll} />
      )}
    </div>
  );
}

// =============================================================================
// Detail Popup
// =============================================================================
function AppointmentDetailPopup({ appointment, onClose, onComplete, onReschedule }:
  { appointment: AppointmentRow; onClose: () => void; onComplete: () => void; onReschedule: () => void }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState('');
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const canAct = appointment.status === 'booked' || appointment.status === 'confirmed';
  const dateLabel = new Date(appointment.appointment_date + 'T12:00:00+05:30')
    .toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' });
  const timeLabel = formatTimeIST(`1970-01-01T${appointment.start_time}`);
  const endTimeLabel = formatTimeIST(`1970-01-01T${appointment.end_time}`);

  function handleCancel() {
    setError('');
    startTransition(async () => {
      const result = await updateAppointmentStatus(appointment.id, 'cancelled');
      if (result.success) { onClose(); router.refresh(); } else setError(result.error);
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl border border-border bg-card shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4 bg-muted/30 shrink-0">
          <div className="flex items-center gap-3">
            <div className={`flex size-10 items-center justify-center rounded-full ${statusBadgeColors[appointment.status]}`}>
              <span className={`size-2.5 rounded-full ${dotColors[appointment.status]}`} />
            </div>
            <div>
              {appointment.customer_id ? (
                <Link
                  href={`/dashboard/customers/${appointment.customer_id}`}
                  className="text-base font-semibold text-foreground hover:text-salon-rose hover:underline transition-colors"
                >
                  {appointment.customer_name}
                </Link>
              ) : (
                <h2 className="text-base font-semibold text-foreground">{appointment.customer_name}</h2>
              )}
              <span className={`block w-fit mt-0.5 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusBadgeColors[appointment.status]}`}>
                {statusLabels[appointment.status]}
              </span>
            </div>
          </div>
          <button onClick={onClose} className="flex size-9 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
            <X className="size-5" />
          </button>
        </div>
        {/* Body */}
        <div className="p-5 space-y-3 overflow-y-auto flex-1">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-muted/50 px-4 py-3">
              <p className="text-xs text-muted-foreground flex items-center gap-1"><Scissors className="size-3" /> Service</p>
              <p className="text-sm font-semibold text-foreground mt-0.5">{appointment.service_name}</p>
            </div>
            <div className="rounded-xl bg-muted/50 px-4 py-3">
              <p className="text-xs text-muted-foreground flex items-center gap-1"><User className="size-3" /> Stylist</p>
              <p className="text-sm font-semibold text-foreground mt-0.5">{appointment.employee_name}</p>
            </div>
            <div className="rounded-xl bg-muted/50 px-4 py-3">
              <p className="text-xs text-muted-foreground flex items-center gap-1"><Calendar className="size-3" /> Date</p>
              <p className="text-sm font-semibold text-foreground mt-0.5">{dateLabel}</p>
            </div>
            <div className="rounded-xl bg-muted/50 px-4 py-3">
              <p className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="size-3" /> Time</p>
              <p className="text-sm font-semibold text-foreground mt-0.5">{timeLabel} – {endTimeLabel}</p>
            </div>
          </div>
          {appointment.total_amount > 0 && (
            <div className="rounded-xl bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800/30 px-4 py-3 flex items-center justify-between">
              <span className="text-sm text-emerald-700 dark:text-emerald-400">Service Amount</span>
              <span className="text-lg font-bold text-emerald-700 dark:text-emerald-400">₹{appointment.total_amount.toLocaleString('en-IN')}</span>
            </div>
          )}
          {error && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
        </div>
        {/* Actions */}
        {canAct && (
          <div className="border-t border-border px-5 py-4 bg-muted/20 shrink-0 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" className="rounded-xl gap-1.5 text-violet-700 border-violet-200 hover:bg-violet-50" onClick={onReschedule}>
                <CalendarClock className="size-4" /> Reschedule
              </Button>
              <Button variant="outline" className="rounded-xl gap-1.5 text-emerald-700 border-emerald-200 hover:bg-emerald-50" onClick={onComplete}>
                <CircleCheck className="size-4" /> Complete & Bill
              </Button>
            </div>
            <Button variant="outline" className="w-full rounded-xl gap-1.5 text-red-700 border-red-200 hover:bg-red-50" onClick={() => setConfirmingCancel(true)} disabled={isPending}>
              <XCircle className="size-4" /> {isPending ? 'Cancelling...' : 'Cancel Appointment'}
            </Button>
          </div>
        )}
      </div>

      {/* Cancel confirmation */}
      <ConfirmDialog
        open={confirmingCancel}
        title="Cancel this appointment?"
        message={
          <>
            This will cancel <span className="font-medium text-foreground">{appointment.customer_name}</span>&apos;s
            appointment on {dateLabel} and notify them on WhatsApp. This cannot be undone.
          </>
        }
        confirmLabel="Yes, Cancel"
        cancelLabel="Keep It"
        pending={isPending}
        pendingLabel="Cancelling..."
        error={error}
        onConfirm={handleCancel}
        onClose={() => setConfirmingCancel(false)}
      />
    </div>
  );
}

// =============================================================================
// Complete & Bill Modal (full billing experience)
// =============================================================================
function CompleteAndBillModal({ appointment, onClose }: { appointment: AppointmentRow; onClose: () => void }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [paymentMethod, setPaymentMethod] = useState<'cash'|'upi'|'card'>('cash');
  const [serviceDiscounts, setServiceDiscounts] = useState<Record<string, number>>({});
  const [membershipInfo, setMembershipInfo] = useState<{ discountPct: number; membershipName: string } | null>(null);
  const [loadingMembership, setLoadingMembership] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState<{ invoiceNumber: string } | null>(null);

  const [catalog, setCatalog] = useState<{ id: string; name: string; price: number }[]>([]);
  const [employees, setEmployees] = useState<{ id: string; name: string; role: string }[]>([]);
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>(appointment.service_ids ?? []);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');
  const [addServiceId, setAddServiceId] = useState<string>('');
  const [loadingLists, setLoadingLists] = useState(true);
  const [productCatalog, setProductCatalog] = useState<{ id: string; name: string; price: number; stock: number; unit: string }[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<{ id: string; name: string; price: number; quantity: number; maxStock: number; discount_pct: number }[]>([]);
  const [addProductId, setAddProductId] = useState<string>('');

  useEffect(() => {
    getCustomerMembershipDiscount(appointment.customer_id).then(info => {
      if (info && info.discountPct > 0) setMembershipInfo(info);
      setLoadingMembership(false);
    });
  }, [appointment.customer_id]);

  useEffect(() => {
    async function load() {
      setLoadingLists(true);
      const [svc, emp, prods] = await Promise.all([getActiveServices(), getActiveEmployees(), getActiveProducts()]);
      setCatalog(svc.map((s) => ({ id: s.id, name: s.name, price: s.price })));
      setProductCatalog(prods.map((p) => ({ id: p.id, name: p.name, price: Number(p.selling_price), stock: Number(p.stock_quantity), unit: p.unit })));
      const emps = emp.map((e) => ({ id: e.id, name: e.name, role: e.role }));
      emps.sort((a, b) => {
        if (a.role === 'owner' && b.role !== 'owner') return -1;
        if (b.role === 'owner' && a.role !== 'owner') return 1;
        return a.name.localeCompare(b.name);
      });
      setEmployees(emps);
      const defaultEmp = emps.find((e) => e.id === appointment.employee_id) ?? emps[0];
      setSelectedEmployeeId(defaultEmp?.id ?? '');
      setSelectedServiceIds((appointment.service_ids && appointment.service_ids.length > 0) ? appointment.service_ids : []);
      setLoadingLists(false);
    }
    load();
  }, [appointment.employee_id, appointment.service_ids]);

  const selectedServices = catalog.filter((s) => selectedServiceIds.includes(s.id));
  const servicesSubtotal = selectedServices.reduce((sum, s) => sum + s.price, 0);
  const productsSubtotal = selectedProducts.reduce((sum, p) => sum + p.price * p.quantity, 0);
  const subtotal = servicesSubtotal + productsSubtotal;
  const membershipDiscountPct = membershipInfo?.discountPct ?? 0;
  const svcDisc = (id: string) => serviceDiscounts[id] ?? membershipDiscountPct;
  const billTotals = calculatePerItemInvoiceTotal({
    lineItems: [
      ...selectedServices.map((s) => ({ price: s.price, quantity: 1, discountPct: svcDisc(s.id) })),
      ...selectedProducts.map((p) => ({ price: p.price, quantity: p.quantity, discountPct: p.discount_pct ?? membershipDiscountPct })),
    ],
    gstRate: 0,
  });
  const discountAmount = billTotals.discountAmount;
  const discountedTotal = billTotals.total;

  function setServiceDiscount(id: string, pct: number) {
    const v = Math.min(100, Math.max(0, Number.isFinite(pct) ? pct : 0));
    setServiceDiscounts((prev) => ({ ...prev, [id]: v }));
  }
  function setProductDiscount(id: string, pct: number) {
    const v = Math.min(100, Math.max(0, Number.isFinite(pct) ? pct : 0));
    setSelectedProducts((prev) => prev.map((p) => (p.id === id ? { ...p, discount_pct: v } : p)));
  }

  function addService() {
    if (!addServiceId) return;
    if (!selectedServiceIds.includes(addServiceId)) setSelectedServiceIds([...selectedServiceIds, addServiceId]);
    setAddServiceId('');
  }
  function removeService(id: string) {
    setSelectedServiceIds(selectedServiceIds.filter((s) => s !== id));
  }
  function addProduct() {
    if (!addProductId) return;
    const prod = productCatalog.find((p) => p.id === addProductId);
    if (prod && !selectedProducts.some((p) => p.id === prod.id)) {
      setSelectedProducts([...selectedProducts, { id: prod.id, name: prod.name, price: prod.price, quantity: 1, maxStock: prod.stock, discount_pct: membershipDiscountPct }]);
    }
    setAddProductId('');
  }
  function removeProduct(id: string) {
    setSelectedProducts(selectedProducts.filter((p) => p.id !== id));
  }
  function setProductQty(id: string, qty: number) {
    setSelectedProducts(selectedProducts.map((p) =>
      p.id === id ? { ...p, quantity: Math.max(1, Math.min(p.maxStock || 1, qty)) } : p
    ));
  }
  function handleClose() {
    if (success) router.refresh();
    onClose();
  }

  function handleConfirm() {
    setError('');
    if (selectedServiceIds.length === 0) { setError('Add at least one service before generating the bill.'); return; }
    if (!selectedEmployeeId) { setError('Select the staff member who served the customer.'); return; }
    startTransition(async () => {
      const serviceDiscountsToSend: Record<string, number> = {};
      selectedServiceIds.forEach((id) => { serviceDiscountsToSend[id] = svcDisc(id); });
      const result = await completeAndGenerateBill(appointment.id, paymentMethod, selectedServiceIds, membershipDiscountPct, selectedEmployeeId, selectedProducts.map((p) => ({ product_id: p.id, quantity: p.quantity, discount_pct: p.discount_pct ?? membershipDiscountPct })), serviceDiscountsToSend);
      if (result.success) setSuccess({ invoiceNumber: result.data.invoiceNumber });
      else setError(result.error);
    });
  }

  if (success) return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={handleClose} />
      <div className="relative z-10 w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-xl">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="flex size-16 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/20">
            <CheckCircle2 className="size-8 text-emerald-600" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground">Bill Generated!</h2>
            <p className="text-sm text-muted-foreground mt-1">Invoice <span className="font-mono font-medium text-foreground">{success.invoiceNumber}</span></p>
          </div>
          <div className="flex gap-2 w-full">
            <Link href="/dashboard/billing" className="flex-1">
              <Button variant="outline" className="w-full rounded-xl">View Bills</Button>
            </Link>
            <Button className="flex-1 rounded-xl" onClick={handleClose}>Done</Button>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl border border-border bg-card shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between border-b border-border px-5 py-4 bg-muted/30 shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/20">
              <CircleCheck className="size-5 text-emerald-600" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-foreground">Complete & Generate Bill</h2>
              <p className="text-xs text-muted-foreground">{appointment.customer_name}</p>
            </div>
          </div>
          <button onClick={onClose} className="flex size-9 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
            <X className="size-5" />
          </button>
        </div>
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {/* Summary */}
          <div className="rounded-xl bg-muted/50 p-4 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Customer</span>
              <span className="font-medium text-foreground">{appointment.customer_name}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Date & Time</span>
              <span className="font-medium text-foreground">{formatDateIN(appointment.appointment_date)}, {formatTimeIST(`1970-01-01T${appointment.start_time}`)}</span>
            </div>
          </div>

          {/* Served by */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Served by</label>
            <select
              value={selectedEmployeeId}
              onChange={(e) => setSelectedEmployeeId(e.target.value)}
              disabled={loadingLists}
              className="w-full h-11 rounded-xl border border-border bg-transparent px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              {employees.length === 0 && <option value="">Loading staff...</option>}
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}{e.role === 'owner' ? ' (Owner)' : e.role === 'manager' ? ' (Manager)' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Services */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Services</label>
            <div className="space-y-1.5">
              {selectedServices.length === 0 && (
                <p className="text-xs text-muted-foreground">No services selected. Add at least one below.</p>
              )}
              {selectedServices.map((s) => {
                const net = s.price - Math.round((s.price * svcDisc(s.id)) / 100);
                return (
                  <div key={s.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 gap-2">
                    <span className="text-sm text-foreground min-w-0 truncate">{s.name}</span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={serviceDiscounts[s.id] ?? (membershipDiscountPct || '')}
                        placeholder="0"
                        onChange={(e) => setServiceDiscount(s.id, parseInt(e.target.value) || 0)}
                        className="h-8 w-12 rounded-lg border border-input bg-transparent px-2 text-center text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                        aria-label={`Discount % for ${s.name}`}
                      />
                      <span className="text-[11px] text-muted-foreground">%</span>
                      <span className="text-sm font-medium text-foreground w-16 text-right">₹{net.toLocaleString('en-IN')}</span>
                      <button type="button" onClick={() => removeService(s.id)} className="text-muted-foreground hover:text-red-600 transition-colors" aria-label={`Remove ${s.name}`}>
                        <XCircle className="size-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center gap-2">
              <SearchableSelect
                className="flex-1"
                value={addServiceId}
                onChange={setAddServiceId}
                disabled={loadingLists}
                placeholder="Search or browse services…"
                emptyText="No service found"
                ariaLabel="Search or select a service"
                options={catalog
                  .filter((s) => !selectedServiceIds.includes(s.id))
                  .map((s) => ({ value: s.id, label: s.name, hint: `₹${s.price.toLocaleString('en-IN')}` }))}
              />
              <Button type="button" variant="outline" className="rounded-xl" onClick={addService} disabled={!addServiceId}>Add</Button>
            </div>

            {/* Products (retail) */}
            <div className="space-y-1.5 pt-2">
              <label className="text-sm font-medium text-foreground">Products</label>
              {selectedProducts.map((p) => {
                const net = p.price * p.quantity - Math.round((p.price * p.quantity * (p.discount_pct ?? membershipDiscountPct)) / 100);
                return (
                  <div key={p.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 gap-2">
                    <span className="text-sm text-foreground min-w-0 truncate">{p.name}</span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <input
                        type="number"
                        min={1}
                        max={p.maxStock}
                        value={p.quantity}
                        onChange={(e) => setProductQty(p.id, parseInt(e.target.value) || 1)}
                        className="h-8 w-12 rounded-lg border border-input bg-transparent px-2 text-center text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                        aria-label={`Quantity for ${p.name}`}
                      />
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={p.discount_pct || ''}
                        placeholder="0"
                        onChange={(e) => setProductDiscount(p.id, parseInt(e.target.value) || 0)}
                        className="h-8 w-12 rounded-lg border border-input bg-transparent px-2 text-center text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                        aria-label={`Discount % for ${p.name}`}
                      />
                      <span className="text-[11px] text-muted-foreground">%</span>
                      <span className="text-sm font-medium text-foreground w-16 text-right">₹{net.toLocaleString('en-IN')}</span>
                      <button type="button" onClick={() => removeProduct(p.id)} className="text-muted-foreground hover:text-red-600 transition-colors" aria-label={`Remove ${p.name}`}>
                        <XCircle className="size-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
              <div className="flex items-center gap-2">
                <SearchableSelect
                  className="flex-1"
                  value={addProductId}
                  onChange={setAddProductId}
                  disabled={loadingLists}
                  placeholder="Search or browse products…"
                  emptyText="No product found"
                  ariaLabel="Search or select a product"
                  options={productCatalog
                    .filter((p) => !selectedProducts.some((sp) => sp.id === p.id))
                    .map((p) => ({
                      value: p.id,
                      label: p.name,
                      hint: `₹${p.price.toLocaleString('en-IN')}${p.stock <= 0 ? ' · Out of stock' : ` · ${p.stock} left`}`,
                      disabled: p.stock <= 0,
                    }))}
                />
                <Button type="button" variant="outline" className="rounded-xl" onClick={addProduct} disabled={!addProductId}>Add</Button>
              </div>
            </div>

            <div className="flex items-center justify-between text-sm pt-1">
              <span className="font-medium text-foreground">Subtotal</span>
              <span className="text-base font-bold text-foreground">₹{subtotal.toLocaleString('en-IN')}</span>
            </div>
          </div>

          {/* Membership */}
          {!loadingMembership && membershipInfo && (
            <div className="rounded-lg bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/30 px-4 py-2.5 flex items-center justify-between">
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400">
                👑 {membershipInfo.membershipName}
              </span>
              <span className="text-sm font-semibold text-amber-700 dark:text-amber-300">{membershipInfo.discountPct}% off</span>
            </div>
          )}
          {/* Discount (per item) */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">Discount</p>
            <p className="text-xs text-muted-foreground">Set a per-item discount using the % box on each service / product above.</p>
            {discountAmount > 0 && subtotal > 0 && (
              <div className="rounded-lg bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800/30 px-4 py-2.5 space-y-1">
                <div className="flex items-center justify-between text-xs text-emerald-600 dark:text-emerald-400">
                  <span>Total discount</span>
                  <span className="font-medium">− ₹{discountAmount.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-emerald-700 dark:text-emerald-400">Payable</span>
                  <span className="text-sm font-bold text-emerald-700 dark:text-emerald-400">₹{discountedTotal.toLocaleString('en-IN')}</span>
                </div>
              </div>
            )}
          </div>
          {/* Payment */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">Payment Method</p>
            <div className="flex gap-2">
              {(['cash','upi','card'] as const).map(m => (
                <label key={m} className={`flex-1 flex items-center justify-center rounded-xl border px-3 py-2.5 text-sm cursor-pointer transition-all ${paymentMethod === m ? 'border-primary bg-primary/5 text-primary font-medium' : 'border-border text-muted-foreground hover:border-foreground/30'}`}>
                  <input type="radio" name="cal-payment" value={m} checked={paymentMethod === m} onChange={() => setPaymentMethod(m)} className="sr-only" />
                  {m === 'upi' ? 'UPI' : m.charAt(0).toUpperCase() + m.slice(1)}
                </label>
              ))}
            </div>
          </div>
          {error && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
        </div>
        <div className="border-t border-border px-5 py-4 bg-muted/20 shrink-0 flex gap-2">
          <Button variant="outline" className="flex-1 rounded-xl" onClick={onClose} disabled={isPending}>Cancel</Button>
          <Button className="flex-1 rounded-xl gap-1.5" onClick={handleConfirm} disabled={isPending}>
            {isPending ? <><span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" /> Generating...</> : <><CheckCircle2 className="size-4" /> Complete & Bill</>}
          </Button>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Reschedule Modal
// =============================================================================
function RescheduleModal({ appointment, onClose }: { appointment: AppointmentRow; onClose: () => void }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [newDate, setNewDate] = useState('');
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState('');
  const [error, setError] = useState('');

  const today = new Date().toISOString().split('T')[0];
  const maxDate = (() => { const d = new Date(); d.setDate(d.getDate()+7); return d.toISOString().split('T')[0]; })();

  useEffect(() => {
    if (!newDate) return;
    setLoadingSlots(true); setSlots([]); setSelectedSlot('');
    getSlotsForReschedule(appointment.id, newDate).then(s => { setSlots(s); setLoadingSlots(false); });
  }, [newDate, appointment.id]);

  function handleReschedule() {
    if (!newDate || !selectedSlot) return;
    const [startTime, endTime] = selectedSlot.split('|');
    setError('');
    startTransition(async () => {
      const result = await rescheduleAppointment(appointment.id, { appointment_date: newDate, start_time: startTime, end_time: endTime });
      if (result.success) { onClose(); router.refresh(); } else setError(result.error);
    });
  }

  function formatSlot(t: string) {
    const [h, m] = t.split(':').map(Number);
    return `${h%12||12}:${String(m).padStart(2,'0')} ${h>=12?'PM':'AM'}`;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl border border-border bg-card shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between border-b border-border px-5 py-4 bg-muted/30 shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-full bg-violet-100 dark:bg-violet-900/20">
              <CalendarClock className="size-5 text-violet-600" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-foreground">Reschedule Appointment</h2>
              <p className="text-xs text-muted-foreground">{appointment.customer_name} · {appointment.service_name}</p>
            </div>
          </div>
          <button onClick={onClose} className="flex size-9 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
            <X className="size-5" />
          </button>
        </div>
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">New Date</label>
            <Input type="date" value={newDate} min={today} max={maxDate} onChange={e => setNewDate(e.target.value)} />
          </div>
          {newDate && (
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Available Slots</label>
              {loadingSlots ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
                  Loading slots...
                </div>
              ) : slots.length === 0 ? (
                <p className="text-sm text-muted-foreground">No available slots for this date.</p>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {slots.map(slot => {
                    const val = `${slot.slot_start}|${slot.slot_end}`;
                    return (
                      <button key={val} type="button" onClick={() => setSelectedSlot(val)}
                        className={`rounded-xl border px-3 py-2 text-sm font-medium transition-all ${selectedSlot === val ? 'border-primary bg-primary/5 text-primary' : 'border-border text-muted-foreground hover:border-primary/50'}`}>
                        {formatSlot(slot.slot_start)}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
          {error && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
        </div>
        <div className="border-t border-border px-5 py-4 bg-muted/20 shrink-0 flex gap-2">
          <Button variant="outline" className="flex-1 rounded-xl" onClick={onClose} disabled={isPending}>Cancel</Button>
          <Button className="flex-1 rounded-xl gap-1.5" onClick={handleReschedule} disabled={!newDate || !selectedSlot || isPending}>
            {isPending ? 'Rescheduling...' : <><CalendarClock className="size-4" /> Reschedule</>}
          </Button>
        </div>
      </div>
    </div>
  );
}
