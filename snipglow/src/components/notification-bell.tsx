'use client';

import { useState, useEffect, useTransition, useRef } from 'react';
import { Bell, X, CheckCheck, Calendar, RefreshCw, XCircle, Star } from 'lucide-react';
import { getNotifications, markNotificationRead, markAllNotificationsRead } from '@/lib/notifications';
import type { Notification } from '@/lib/notifications';

const typeConfig = {
  new_booking: { icon: Calendar, color: 'text-blue-600', bg: 'bg-blue-100 dark:bg-blue-900/30', label: 'New Booking' },
  reschedule: { icon: RefreshCw, color: 'text-amber-600', bg: 'bg-amber-100 dark:bg-amber-900/30', label: 'Rescheduled' },
  cancel: { icon: XCircle, color: 'text-red-600', bg: 'bg-red-100 dark:bg-red-900/30', label: 'Cancelled' },
  feedback: { icon: Star, color: 'text-violet-600', bg: 'bg-violet-100 dark:bg-violet-900/30', label: 'Feedback' },
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [isPending, startTransition] = useTransition();
  const panelRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter(n => !n.is_read).length;

  // Fetch on mount and every 30 seconds
  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  async function fetchNotifications() {
    setLoading(true);
    const data = await getNotifications();
    setNotifications(data);
    setLoading(false);
  }

  function handleOpen() {
    setOpen(prev => !prev);
    if (!open) fetchNotifications();
  }

  function handleMarkRead(id: string) {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    startTransition(() => markNotificationRead(id));
  }

  function handleMarkAllRead() {
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    startTransition(() => markAllNotificationsRead());
  }

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell button */}
      <button
        onClick={handleOpen}
        className="relative flex size-9 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
      >
        <Bell className="size-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute right-0 top-11 z-50 w-[340px] sm:w-[380px] rounded-2xl border border-border bg-card shadow-2xl shadow-black/10 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
            <div className="flex items-center gap-2">
              <Bell className="size-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold text-foreground">Notifications</h3>
              {unreadCount > 0 && (
                <span className="inline-flex items-center rounded-full bg-red-100 dark:bg-red-900/30 px-1.5 py-0.5 text-[10px] font-bold text-red-600 dark:text-red-400">
                  {unreadCount} new
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  disabled={isPending}
                  className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                >
                  <CheckCheck className="size-3" />
                  Mark all read
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="flex size-7 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <X className="size-4" />
              </button>
            </div>
          </div>

          {/* Notification list */}
          <div className="max-h-[420px] overflow-y-auto">
            {loading && notifications.length === 0 ? (
              <div className="flex items-center justify-center py-10">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center px-4">
                <div className="flex size-12 items-center justify-center rounded-full bg-muted mb-3">
                  <Bell className="size-5 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium text-foreground">No notifications yet</p>
                <p className="text-xs text-muted-foreground mt-1">WhatsApp bookings, cancellations and feedback will appear here</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {notifications.map(n => {
                  const cfg = typeConfig[n.type] || typeConfig.new_booking;
                  const Icon = cfg.icon;
                  return (
                    <div
                      key={n.id}
                      onClick={() => !n.is_read && handleMarkRead(n.id)}
                      className={`flex items-start gap-3 px-4 py-3 transition-colors cursor-pointer ${
                        n.is_read ? 'opacity-60' : 'hover:bg-muted/50'
                      }`}
                    >
                      {/* Icon */}
                      <div className={`flex size-8 shrink-0 items-center justify-center rounded-full ${cfg.bg} mt-0.5`}>
                        <Icon className={`size-3.5 ${cfg.color}`} />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className={`text-xs font-semibold leading-snug ${n.is_read ? 'text-muted-foreground' : 'text-foreground'}`}>
                            {n.title}
                          </p>
                          <span className="text-[10px] text-muted-foreground shrink-0 mt-0.5">{timeAgo(n.created_at)}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 leading-snug line-clamp-2">{n.body}</p>
                        {n.customer_name && (
                          <p className="text-[10px] text-muted-foreground/70 mt-1">{n.customer_name}{n.customer_phone ? ` · +${n.customer_phone}` : ''}</p>
                        )}
                      </div>

                      {/* Unread dot */}
                      {!n.is_read && (
                        <div className="size-2 rounded-full bg-blue-500 shrink-0 mt-1.5" />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="border-t border-border px-4 py-2.5 bg-muted/20">
              <button
                onClick={fetchNotifications}
                disabled={loading}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <RefreshCw className={`size-3 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
