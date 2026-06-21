'use client';

import { useEffect, useState } from 'react';
import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  MessageCircle,
  CheckCircle2,
  Smartphone,
  Rocket,
  BarChart3,
  Send,
  Megaphone,
  Cake,
  PartyPopper,
  Tag,
  Heart,
  Clock,
  Users,
  Sparkles,
  Copy,
  Eye,
  Zap,
  ArrowUpRight,
  ArrowDownLeft,
  XCircle,
  Filter,
  RefreshCw,
  Unplug,
  AlertTriangle,
  Lock,
  Hourglass,
} from 'lucide-react';
import type { PlanTier } from '@/types';
import {
  controlsFor,
  planGate,
  type OnboardingStatus,
} from '@/lib/whatsapp/onboarding-status';

// =============================================================================
// Global type declarations for Facebook SDK
// =============================================================================

declare global {
  interface Window {
    fbAsyncInit: () => void;
  }
  // eslint-disable-next-line no-var
  var FB: {
    init: (params: {
      appId: string;
      autoLogAppEvents: boolean;
      xfbml: boolean;
      version: string;
    }) => void;
    login: (
      callback: (response: { authResponse?: { code: string } }) => void,
      options: Record<string, unknown>
    ) => void;
  };
}

// =============================================================================
// WhatsApp Client Component with Tabs
// =============================================================================

interface WhatsAppClientProps {
  planTier: PlanTier;
}

type TabType = 'logs';

export function WhatsAppClient({ planTier }: WhatsAppClientProps) {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500/10 via-green-500/5 to-transparent border border-emerald-200/50 dark:border-emerald-800/30 p-6">
        <div className="relative z-10 flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-900/30">
            <MessageCircle className="size-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">WhatsApp</h1>
            <p className="text-sm text-muted-foreground">
              All WhatsApp activity for your salon
            </p>
          </div>
        </div>
        <div className="absolute -right-6 -top-6 h-32 w-32 rounded-full bg-emerald-500/5" />
      </div>

      <WhatsAppLogsSection />
    </div>
  );
}

// =============================================================================
// WhatsApp Activity Logs Section
// =============================================================================

interface LogRow {
  id: string;
  phone: string;
  direction: 'inbound' | 'outbound';
  template_name: string | null;
  status: string;
  created_at: string;
  description: string;
}

function formatPhoneDisplay(phone: string): string {
  if (!phone) return '—';
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('91') && cleaned.length === 12) {
    return `+91 ${cleaned.slice(2, 7)} ${cleaned.slice(7)}`;
  }
  return `+${cleaned}`;
}

function getLogDescription(log: any): string {
  const meta = log.metadata || {};
  const direction = log.direction;
  const template = log.template_name;
  const customerName = meta.customer_name || '';
  const messageText = meta.message_text || '';
  const buttonReplyId = meta.button_reply_id || '';

  if (direction === 'outbound') {
    switch (template) {
      case 'booking_confirmation':
      case 'booking_confirmation_v2': return `Booking confirmation sent to ${customerName || 'customer'}`;
      case 'appointment_reminder':
      case 'appointment_reminder_v1': return `Appointment reminder sent to ${customerName || 'customer'}`;
      case 'appointment_rescheduled_v1': return `Reschedule confirmation sent to ${customerName || 'customer'}`;
      case 'bill_receipt_v1':
      case 'bill_receipt': return `Bill receipt sent to ${customerName || 'customer'}`;
      case 'feedback_request_v1':
      case 'feedback_request': return `Feedback request sent to ${customerName || 'customer'}`;
      case 'appointment_cancelled': return `Cancellation notice sent to ${customerName || 'customer'}`;
      case 'renewal_reminder': return `30-day win-back sent to ${customerName || 'customer'}`;
      case 'winback_60_day': return `60-day win-back sent to ${customerName || 'customer'}`;
      case 'otp_verification': return `OTP verification code sent`;
      default:
        if (template) return `"${template}" sent to ${customerName || 'customer'}`;
        return `WhatsApp message sent`;
    }
  }

  if (direction === 'inbound') {
    if (buttonReplyId) {
      const map: Record<string, string> = {
        'book_appointment': 'tapped "Book Appointment"',
        'services_prices': 'tapped "View Services"',
        'talk_to_salon': 'tapped "Talk to Salon"',
        'reschedule_appointment': 'tapped "Reschedule"',
        'cancel_appointment': 'tapped "Cancel"',
        'feedback_5': 'rated ⭐⭐⭐⭐⭐ (Loved it!)',
        'feedback_3': 'rated ⭐⭐⭐ (It was okay)',
        'feedback_1': 'rated 😞 (Not satisfied)',
        'google_review_yes': 'agreed to leave Google review',
        'google_review_no': 'declined Google review',
      };
      if (buttonReplyId.startsWith('confirm_cancel_')) return `${customerName || 'Customer'} confirmed cancellation`;
      if (buttonReplyId.startsWith('resched.')) return `${customerName || 'Customer'} selected reschedule date`;
      if (buttonReplyId.startsWith('reschedtime.')) return `${customerName || 'Customer'} selected reschedule time`;
      const action = map[buttonReplyId] || `tapped "${buttonReplyId}"`;
      return `${customerName || 'Customer'} ${action}`;
    }
    if (messageText) {
      const upper = messageText.trim().toUpperCase();
      if (upper.startsWith('BOOK_') || /\[SNG[-]?\d+\]/i.test(messageText)) {
        return `${customerName || 'Customer'} scanned QR code to book`;
      }
      return `${customerName || 'Customer'} sent: "${messageText.substring(0, 50)}${messageText.length > 50 ? '...' : ''}"`;
    }
    return `Message received from ${customerName || 'customer'}`;
  }

  return 'WhatsApp activity';
}

function formatDateTime(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) +
    ', ' + d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });
}

const statusIcons: Record<string, React.ReactNode> = {
  sent: <CheckCircle2 className="size-3.5 text-emerald-500" />,
  delivered: <CheckCircle2 className="size-3.5 text-blue-500" />,
  read: <CheckCircle2 className="size-3.5 text-blue-600" />,
  failed: <XCircle className="size-3.5 text-red-500" />,
};

function WhatsAppLogsSection() {
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'outbound' | 'inbound'>('all');

  useEffect(() => {
    async function fetchLogs() {
      try {
        const { getWhatsAppLogs } = await import('./actions');
        const data = await getWhatsAppLogs();
        setLogs(data);
      } catch (err) {
        console.error('[WhatsAppLogs] Failed to fetch:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchLogs();
  }, []);

  const filtered = filter === 'all' ? logs : logs.filter((l) => l.direction === filter);
  const outboundCount = logs.filter((l) => l.direction === 'outbound').length;
  const inboundCount = logs.filter((l) => l.direction === 'inbound').length;
  const failedCount = logs.filter((l) => l.status === 'failed').length;

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-border bg-card p-4 text-center">
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Sent</p>
          <p className="text-2xl font-bold text-emerald-600">{loading ? '—' : outboundCount}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 text-center">
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Received</p>
          <p className="text-2xl font-bold text-blue-600">{loading ? '—' : inboundCount}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 text-center">
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Failed</p>
          <p className="text-2xl font-bold text-red-500">{loading ? '—' : failedCount}</p>
        </div>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-2">
        <Filter className="size-3.5 text-muted-foreground shrink-0" />
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as any)}
          className="h-9 rounded-xl border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="all">All Messages</option>
          <option value="outbound">Sent Only</option>
          <option value="inbound">Received Only</option>
        </select>
        <span className="text-xs text-muted-foreground ml-auto">{filtered.length} messages</span>
      </div>

      {/* Logs */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-card p-12 text-center">
          <div className="flex size-14 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-900/20 mb-4">
            <Zap className="size-6 text-emerald-500" />
          </div>
          <h3 className="text-base font-semibold text-foreground">No activity yet</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm">
            WhatsApp messages will appear here once customers start booking or you send bills.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((log) => (
            <div
              key={log.id}
              className="flex items-start gap-3 rounded-xl border border-border bg-card p-4 hover:bg-muted/30 transition-colors"
            >
              <div className={`flex size-9 shrink-0 items-center justify-center rounded-full ${
                log.direction === 'outbound'
                  ? 'bg-emerald-50 dark:bg-emerald-900/20'
                  : 'bg-blue-50 dark:bg-blue-900/20'
              }`}>
                {log.direction === 'outbound'
                  ? <ArrowUpRight className="size-4 text-emerald-600 dark:text-emerald-400" />
                  : <ArrowDownLeft className="size-4 text-blue-600 dark:text-blue-400" />
                }
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground leading-snug">{log.description}</p>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className="text-xs text-muted-foreground">{log.phone}</span>
                  <span className="text-xs text-muted-foreground">·</span>
                  <span className="text-xs text-muted-foreground">{formatDateTime(log.created_at)}</span>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {statusIcons[log.status] || <Clock className="size-3.5 text-muted-foreground" />}
                <span className="text-xs text-muted-foreground capitalize">{log.status}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Broadcast Templates
// =============================================================================

interface Template {
  id: string;
  name: string;
  category: 'birthday' | 'festival' | 'marketing' | 'reminder' | 'winback';
  icon: typeof Cake;
  iconColor: string;
  iconBg: string;
  preview: string;
  message: string;
  variables: string[];
}

const BROADCAST_TEMPLATES: Template[] = [
  {
    id: 'birthday_wish',
    name: 'Birthday Wishes',
    category: 'birthday',
    icon: Cake,
    iconColor: 'text-pink-600 dark:text-pink-400',
    iconBg: 'bg-pink-100 dark:bg-pink-900/30',
    preview: 'Wish happy birthday with a special discount',
    message: '🎂 Happy Birthday, {{name}}! 🎉\n\nWishing you a wonderful day filled with joy! As a birthday treat from {{salon_name}}, enjoy a special *{{discount}}% OFF* on any service this week.\n\nBook now and celebrate in style! 💇‍♀️✨',
    variables: ['name', 'salon_name', 'discount'],
  },
  {
    id: 'diwali_wishes',
    name: 'Diwali Wishes',
    category: 'festival',
    icon: PartyPopper,
    iconColor: 'text-amber-600 dark:text-amber-400',
    iconBg: 'bg-amber-100 dark:bg-amber-900/30',
    preview: 'Festival greetings with special offers',
    message: '🪔 Happy Diwali, {{name}}! ✨\n\nMay this festival of lights bring you joy and prosperity! Celebrate with a fresh new look.\n\n🎁 *Diwali Special: {{discount}}% OFF* on all services this week!\n\nBook your appointment now at {{salon_name}} 💫',
    variables: ['name', 'salon_name', 'discount'],
  },
  {
    id: 'eid_wishes',
    name: 'Eid Wishes',
    category: 'festival',
    icon: PartyPopper,
    iconColor: 'text-emerald-600 dark:text-emerald-400',
    iconBg: 'bg-emerald-100 dark:bg-emerald-900/30',
    preview: 'Eid greetings with salon offers',
    message: '🌙 Eid Mubarak, {{name}}! 🕌\n\nWishing you and your family a blessed Eid! Look your best this festive season.\n\n✨ *Eid Special: {{discount}}% OFF* on premium services!\n\nVisit {{salon_name}} today 💇‍♀️',
    variables: ['name', 'salon_name', 'discount'],
  },
  {
    id: 'new_year',
    name: 'New Year Wishes',
    category: 'festival',
    icon: Sparkles,
    iconColor: 'text-violet-600 dark:text-violet-400',
    iconBg: 'bg-violet-100 dark:bg-violet-900/30',
    preview: 'New year greetings with fresh start offer',
    message: '🎊 Happy New Year, {{name}}! 🥂\n\nNew year, new look! Start the year feeling fresh and confident.\n\n🎁 *New Year Offer: {{discount}}% OFF* on your first visit of the year!\n\nBook now at {{salon_name}} ✨',
    variables: ['name', 'salon_name', 'discount'],
  },
  {
    id: 'flash_sale',
    name: 'Flash Sale',
    category: 'marketing',
    icon: Tag,
    iconColor: 'text-red-600 dark:text-red-400',
    iconBg: 'bg-red-100 dark:bg-red-900/30',
    preview: 'Limited time offer announcement',
    message: '⚡ FLASH SALE at {{salon_name}}! ⚡\n\nHi {{name}}, for the next 48 hours only:\n\n🔥 *{{discount}}% OFF* on ALL services!\n\nDon\'t miss out — limited slots available. Book now before it\'s gone! 💇‍♀️',
    variables: ['name', 'salon_name', 'discount'],
  },
  {
    id: 'new_service',
    name: 'New Service Launch',
    category: 'marketing',
    icon: Rocket,
    iconColor: 'text-blue-600 dark:text-blue-400',
    iconBg: 'bg-blue-100 dark:bg-blue-900/30',
    preview: 'Announce a new service to customers',
    message: '🆕 Exciting News, {{name}}! 🎉\n\n{{salon_name}} now offers *{{service_name}}*!\n\n✨ Introductory price: Just ₹{{price}}\n📅 Book your slot today and be among the first to try it!\n\nWe can\'t wait to pamper you 💆‍♀️',
    variables: ['name', 'salon_name', 'service_name', 'price'],
  },
  {
    id: 'referral',
    name: 'Referral Program',
    category: 'marketing',
    icon: Heart,
    iconColor: 'text-rose-600 dark:text-rose-400',
    iconBg: 'bg-rose-100 dark:bg-rose-900/30',
    preview: 'Encourage referrals with rewards',
    message: '💕 Share the Love, {{name}}! 💕\n\nRefer a friend to {{salon_name}} and you BOTH get *{{discount}}% OFF* your next visit!\n\n👯‍♀️ Just ask your friend to mention your name when booking.\n\nSpread the glow! ✨',
    variables: ['name', 'salon_name', 'discount'],
  },
  {
    id: 'winback_30',
    name: '30-Day Reminder',
    category: 'reminder',
    icon: Clock,
    iconColor: 'text-indigo-600 dark:text-indigo-400',
    iconBg: 'bg-indigo-100 dark:bg-indigo-900/30',
    preview: 'Remind customers who haven\'t visited in 30 days',
    message: '💜 Time for a Touch-Up, {{name}}! ✨\n\nIt\'s been 30 days since your last visit to {{salon_name}}. Your hair deserves some love!\n\n📅 Book now and keep looking fabulous.\n\nWe miss you! 😊',
    variables: ['name', 'salon_name'],
  },
  {
    id: 'winback_60',
    name: '60-Day Win-Back',
    category: 'winback',
    icon: Heart,
    iconColor: 'text-pink-600 dark:text-pink-400',
    iconBg: 'bg-pink-100 dark:bg-pink-900/30',
    preview: 'Win back customers with a special discount',
    message: '💕 We Miss You, {{name}}! 💕\n\nIt\'s been 2 months since we last saw you at {{salon_name}}. Come back for some self-care!\n\n🎁 *Special comeback offer: {{discount}}% OFF* your next visit!\n\nUse code: MISSYOU{{discount}}\n\nBook now — we\'d love to see you again! 💇‍♀️',
    variables: ['name', 'salon_name', 'discount'],
  },
  {
    id: 'loyalty_reward',
    name: 'Loyalty Reward',
    category: 'marketing',
    icon: Sparkles,
    iconColor: 'text-amber-600 dark:text-amber-400',
    iconBg: 'bg-amber-100 dark:bg-amber-900/30',
    preview: 'Reward loyal customers with exclusive offers',
    message: '👑 VIP Reward, {{name}}! 👑\n\nThank you for being a loyal customer of {{salon_name}}! As a token of appreciation:\n\n🎁 *Exclusive {{discount}}% OFF* on your next premium service!\n\nYou deserve the best. Book now! ✨',
    variables: ['name', 'salon_name', 'discount'],
  },
];

const CATEGORY_LABELS: Record<string, { label: string; color: string }> = {
  birthday: { label: 'Birthday', color: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400' },
  festival: { label: 'Festival', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  marketing: { label: 'Marketing', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  reminder: { label: 'Reminder', color: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400' },
  winback: { label: 'Win-Back', color: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400' },
};

// =============================================================================
// Broadcast Section
// =============================================================================

function BroadcastSection() {
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>('all');

  const filteredTemplates = filterCategory === 'all'
    ? BROADCAST_TEMPLATES
    : BROADCAST_TEMPLATES.filter((t) => t.category === filterCategory);

  return (
    <div className="space-y-5">
      {/* Info Banner */}
      <div className="rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-800/30 dark:bg-amber-900/10 px-4 py-3">
        <div className="flex items-start gap-2">
          <Megaphone className="size-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-800 dark:text-amber-200">Broadcast will be active once WhatsApp API is connected</p>
            <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">Browse templates below. Once your number is connected, you can send broadcasts to all or selected customers.</p>
          </div>
        </div>
      </div>

      {/* Category Filter */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {[
          { key: 'all', label: 'All Templates' },
          { key: 'birthday', label: '🎂 Birthday' },
          { key: 'festival', label: '🎉 Festival' },
          { key: 'marketing', label: '📢 Marketing' },
          { key: 'reminder', label: '⏰ Reminder' },
          { key: 'winback', label: '💕 Win-Back' },
        ].map((cat) => (
          <button
            key={cat.key}
            onClick={() => setFilterCategory(cat.key)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
              filterCategory === cat.key
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Templates Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {filteredTemplates.map((template) => {
          const Icon = template.icon;
          const catConfig = CATEGORY_LABELS[template.category];
          return (
            <div
              key={template.id}
              className="group rounded-xl border border-border bg-card p-4 hover:shadow-md hover:border-emerald-200 dark:hover:border-emerald-800/30 transition-all cursor-pointer"
              onClick={() => setSelectedTemplate(template)}
            >
              <div className="flex items-start gap-3">
                <div className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${template.iconBg}`}>
                  <Icon className={`size-5 ${template.iconColor}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-sm font-semibold text-foreground truncate">{template.name}</h3>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-1">{template.preview}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${catConfig.color}`}>
                      {catConfig.label}
                    </span>
                    <button
                      onClick={(e) => { e.stopPropagation(); setSelectedTemplate(template); }}
                      className="inline-flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400 font-medium opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Eye className="size-3" />
                      Preview
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Template Preview Modal */}
      {selectedTemplate && (
        <TemplatePreviewModal
          template={selectedTemplate}
          onClose={() => setSelectedTemplate(null)}
        />
      )}
    </div>
  );
}

// =============================================================================
// Template Preview Modal
// =============================================================================

function TemplatePreviewModal({ template, onClose }: { template: Template; onClose: () => void }) {
  const [copied, setCopied] = useState(false);

  // Replace variables with sample values for preview
  const previewMessage = template.message
    .replace(/\{\{name\}\}/g, 'Priya')
    .replace(/\{\{salon_name\}\}/g, 'Your Salon')
    .replace(/\{\{discount\}\}/g, '15')
    .replace(/\{\{service_name\}\}/g, 'Keratin Treatment')
    .replace(/\{\{price\}\}/g, '2,500');

  function handleCopy() {
    navigator.clipboard.writeText(template.message);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl border border-border bg-card shadow-2xl overflow-hidden max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4 bg-muted/30 shrink-0">
          <div className="flex items-center gap-2">
            <div className={`flex size-8 items-center justify-center rounded-lg ${template.iconBg}`}>
              <template.icon className={`size-4 ${template.iconColor}`} />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-foreground">{template.name}</h2>
              <p className="text-[10px] text-muted-foreground">Template Preview</p>
            </div>
          </div>
          <button onClick={onClose} className="flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
            <span className="text-lg">×</span>
          </button>
        </div>

        {/* WhatsApp-style Preview */}
        <div className="flex-1 overflow-y-auto p-5">
          <div className="rounded-xl bg-[#e5ddd5] dark:bg-slate-800 p-4">
            {/* Chat bubble */}
            <div className="bg-white dark:bg-slate-700 rounded-xl rounded-tl-sm p-3 max-w-[280px] shadow-sm">
              <p className="text-sm text-slate-800 dark:text-slate-200 whitespace-pre-line leading-relaxed">
                {previewMessage}
              </p>
              <p className="text-[10px] text-slate-400 text-right mt-2">10:00 AM ✓✓</p>
            </div>
          </div>

          {/* Variables info */}
          <div className="mt-4 rounded-lg bg-muted/50 border border-border p-3">
            <p className="text-xs font-medium text-foreground mb-2">Variables (auto-filled per customer):</p>
            <div className="flex flex-wrap gap-1.5">
              {template.variables.map((v) => (
                <span key={v} className="inline-flex items-center rounded-md bg-emerald-100 dark:bg-emerald-900/30 px-2 py-0.5 text-[10px] font-mono text-emerald-700 dark:text-emerald-400">
                  {`{{${v}}}`}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center gap-2 border-t border-border px-5 py-4 bg-muted/20 shrink-0">
          <Button
            variant="outline"
            className="rounded-xl flex-1 gap-1.5"
            onClick={handleCopy}
          >
            {copied ? <CheckCircle2 className="size-4 text-emerald-500" /> : <Copy className="size-4" />}
            {copied ? 'Copied!' : 'Copy Template'}
          </Button>
          <Button
            className="rounded-xl flex-1 gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
            disabled
          >
            <Send className="size-4" />
            Send Broadcast
          </Button>
        </div>

        {/* Disabled note */}
        <div className="px-5 pb-4">
          <p className="text-[10px] text-muted-foreground text-center">
            💡 Connect your WhatsApp number to enable sending broadcasts
          </p>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// WhatsApp Connect Card
// =============================================================================

function WhatsAppConnectCard({ planTier }: { planTier: PlanTier }) {
  const [sdkLoaded, setSdkLoaded] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [loading, setLoading] = useState(true);

  // Server-driven onboarding state (Req 7.1).
  const [status, setStatus] = useState<OnboardingStatus>('not_started');
  const [displayPhoneNumber, setDisplayPhoneNumber] = useState<string | null>(null);
  const [errorReason, setErrorReason] = useState<string | null>(null);
  // Transient UI notice (cancellation / SDK-not-ready); not a persisted state.
  const [notice, setNotice] = useState<string | null>(null);

  // Interim manual-setup flow (while Embedded Signup / Tech Provider approval is
  // pending). When no Facebook config id is configured, self-serve Embedded
  // Signup cannot complete, so we offer a "Request Setup" flow instead.
  // TEMP: force the Embedded Signup "Connect WhatsApp" button to always show so
  // the flow can be screen-recorded for Meta's Tech Provider / Embedded Signup
  // review. Revert to `Boolean(process.env.NEXT_PUBLIC_FB_CONFIG_ID)` once the
  // config id is set in env and review is complete.
  const embeddedSignupAvailable = true;
  const [setupRequest, setSetupRequest] = useState<{
    status: string;
    contactPhone: string;
  } | null>(null);
  const [requestPhone, setRequestPhone] = useState('');
  const [requestName, setRequestName] = useState('');
  const [submittingRequest, setSubmittingRequest] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);

  // Plan gating: connect enabled iff Pro, else upgrade prompt (Req 1.1–1.4).
  const gate = planGate(planTier);
  // Derived control flags for the current status (Req 7.2, 7.3, 7.6, 8.1).
  const controls = controlsFor(status);

  // Load the Facebook SDK for Embedded Signup (Req 2.1).
  useEffect(() => {
    if (typeof window !== 'undefined' && typeof FB !== 'undefined') {
      setSdkLoaded(true);
      return;
    }

    window.fbAsyncInit = function () {
      FB.init({
        appId: process.env.NEXT_PUBLIC_FB_APP_ID || 'YOUR_APP_ID',
        autoLogAppEvents: true,
        xfbml: true,
        version: 'v21.0',
      });
      setSdkLoaded(true);
    };

    const script = document.createElement('script');
    script.src = 'https://connect.facebook.net/en_US/sdk.js';
    script.async = true;
    script.defer = true;
    script.crossOrigin = 'anonymous';
    document.body.appendChild(script);

    return () => {
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
    };
  }, []);

  // On mount, read the server-driven onboarding state (Req 7.1).
  useEffect(() => {
    let cancelled = false;
    async function loadState() {
      try {
        const { getOnboardingState } = await import('./actions');
        const state = await getOnboardingState();
        if (cancelled) return;
        setStatus(state.status as OnboardingStatus);
        setDisplayPhoneNumber(state.displayPhoneNumber);
        setErrorReason(state.errorReason);
      } catch (err) {
        console.error('[WhatsAppConnect] Failed to load onboarding state:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }

      // In interim mode, also load any existing manual setup request so a
      // returning owner sees their pending status instead of a fresh form.
      if (!embeddedSignupAvailable && gate.connectEnabled) {
        try {
          const { getSetupRequest } = await import('./actions');
          const req = await getSetupRequest();
          if (!cancelled && req) {
            setSetupRequest({ status: req.status, contactPhone: req.contactPhone });
          }
        } catch (err) {
          console.error('[WhatsAppConnect] Failed to load setup request:', err);
        }
      }
    }
    loadState();
    return () => {
      cancelled = true;
    };
  }, [embeddedSignupAvailable, gate.connectEnabled]);

  // Apply a server action result's returned state to local rendering (Req 7.1).
  function applyState(state: {
    status: string;
    displayPhoneNumber: string | null;
    errorReason: string | null;
  }) {
    setStatus(state.status as OnboardingStatus);
    setDisplayPhoneNumber(state.displayPhoneNumber);
    setErrorReason(state.errorReason);
  }

  // Embedded Signup → submit the returned authorization code to the server (Req 2.1, 2.2).
  function handleConnectWhatsApp() {
    setNotice(null);

    // SDK not ready: show a message and submit nothing (Req 2.5).
    if (!sdkLoaded || typeof FB === 'undefined') {
      setNotice('The connect flow is not ready yet. Please wait a moment and try again.');
      return;
    }

    setConnecting(true);

    FB.login(
      function (response) {
        // Cancel / close: no authResponse or no code — submit nothing (Req 2.3).
        if (!response.authResponse || !response.authResponse.code) {
          setNotice('Connection cancelled. Your WhatsApp setup was not changed.');
          setConnecting(false);
          return;
        }

        const code = response.authResponse.code;
        void (async () => {
          try {
            const { submitAuthCode } = await import('./actions');
            const result = await submitAuthCode(code);
            applyState(result.state);
            if (!result.ok) {
              setNotice(null);
            }
          } catch (err) {
            console.error('[WhatsAppConnect] submitAuthCode failed:', err);
            setNotice('Something went wrong while connecting. Please try again.');
          } finally {
            setConnecting(false);
          }
        })();
      },
      {
        config_id: process.env.NEXT_PUBLIC_FB_CONFIG_ID || 'YOUR_CONFIG_ID',
        response_type: 'code',
        override_default_response_type: true,
        extras: {
          setup: {},
          featureType: '',
          sessionInfoVersion: '3',
        },
      }
    );
  }

  // Retry a failed onboarding attempt (Req 7.5).
  async function handleRetry() {
    setNotice(null);
    setConnecting(true);
    try {
      const { retryOnboarding } = await import('./actions');
      const result = await retryOnboarding();
      applyState(result.state);
    } catch (err) {
      console.error('[WhatsAppConnect] retryOnboarding failed:', err);
      setNotice('Could not start retry. Please try again.');
    } finally {
      setConnecting(false);
    }
  }

  // Disconnect the dedicated number, reverting to the shared number (Req 8.1).
  async function handleDisconnect() {
    setNotice(null);
    setConnecting(true);
    try {
      const { disconnectDedicated } = await import('./actions');
      const result = await disconnectDedicated();
      applyState(result.state);
    } catch (err) {
      console.error('[WhatsAppConnect] disconnectDedicated failed:', err);
      setNotice('Could not disconnect. Please try again.');
    } finally {
      setConnecting(false);
    }
  }

  // Submit a manual WhatsApp setup request (interim flow while Embedded Signup
  // is unavailable). Our team provisions the number and activates it.
  async function handleRequestSetup() {
    setRequestError(null);
    const digits = requestPhone.replace(/\D/g, '');
    if (digits.length < 8 || digits.length > 15) {
      setRequestError('Please enter a valid WhatsApp phone number.');
      return;
    }
    setSubmittingRequest(true);
    try {
      const { requestWhatsAppSetup } = await import('./actions');
      const result = await requestWhatsAppSetup({
        contactPhone: requestPhone.trim(),
        contactName: requestName.trim() || null,
      });
      if (result.ok) {
        setSetupRequest({ status: result.request.status, contactPhone: result.request.contactPhone });
      } else {
        setRequestError(result.reason || 'Could not submit your request. Please try again.');
      }
    } catch (err) {
      console.error('[WhatsAppConnect] requestWhatsAppSetup failed:', err);
      setRequestError('Something went wrong. Please try again.');
    } finally {
      setSubmittingRequest(false);
    }
  }

  const features = [
    { icon: Smartphone, label: 'Messages from your own number' },
    { icon: Rocket, label: 'Direct delivery via Meta Cloud API' },
    { icon: BarChart3, label: 'Real-time delivery status tracking' },
  ];

  return (
    <div className="space-y-5">
      {/* Connect Card */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="border-b border-border px-6 py-4 bg-gradient-to-r from-emerald-50/50 to-green-50/50 dark:from-emerald-950/20 dark:to-green-950/20">
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-emerald-500">
              <MessageCircle className="size-4 text-white" />
            </div>
            <h2 className="text-sm font-semibold text-foreground">Connect Your Number</h2>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
            </div>
          ) : gate.showUpgradePrompt ? (
            // Non-Pro: upgrade prompt instead of the connect action (Req 1.3).
            <div className="flex flex-col items-center gap-4 py-4 text-center">
              <div className="flex size-16 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
                <Lock className="size-8 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-foreground">Available on the Pro plan</h3>
                <p className="mt-1 text-sm text-muted-foreground max-w-sm">
                  Connecting your own WhatsApp Business number is a Pro plan feature. Upgrade to Pro to
                  send messages from your own number.
                </p>
              </div>
              <a
                href="/dashboard/billing"
                className={cn(
                  buttonVariants({ size: 'lg' }),
                  'rounded-xl bg-emerald-600 text-white hover:bg-emerald-700'
                )}
              >
                Upgrade to Pro
              </a>
            </div>
          ) : status === 'connected' ? (
            // Connected: show display number + confirmation + Disconnect (Req 7.2, 8.1).
            <div className="flex flex-col items-center gap-4 py-4">
              <div className="flex size-16 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
                <CheckCircle2 className="size-8 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="text-center">
                <h3 className="text-lg font-bold text-foreground">Connected Successfully</h3>
                {displayPhoneNumber && (
                  <p className="mt-1 text-base font-semibold text-emerald-700 dark:text-emerald-300">
                    {displayPhoneNumber}
                  </p>
                )}
                <p className="mt-1 text-sm text-muted-foreground">
                  Your WhatsApp Business number is now linked. Messages are sent from your own number.
                </p>
              </div>
              {controls.showDisconnect && (
                <Button
                  variant="outline"
                  className="rounded-xl gap-1.5"
                  onClick={handleDisconnect}
                  disabled={connecting}
                >
                  {connecting ? (
                    <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  ) : (
                    <Unplug className="size-4" />
                  )}
                  Disconnect
                </Button>
              )}
            </div>
          ) : status === 'failed' ? (
            // Failed: show error reason + Retry action (Req 7.3).
            <div className="flex flex-col items-center gap-4 py-4">
              <div className="flex size-16 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
                <AlertTriangle className="size-8 text-red-600 dark:text-red-400" />
              </div>
              <div className="text-center">
                <h3 className="text-lg font-bold text-foreground">Connection Failed</h3>
                <p className="mt-1 text-sm text-muted-foreground max-w-sm">
                  {errorReason || 'Something went wrong while connecting your number.'}
                </p>
              </div>
              {controls.showRetry && (
                <Button
                  className="rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 gap-1.5"
                  onClick={handleRetry}
                  disabled={connecting}
                >
                  {connecting ? (
                    <span className="size-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  ) : (
                    <RefreshCw className="size-4" />
                  )}
                  Retry
                </Button>
              )}
            </div>
          ) : status === 'in_progress' ? (
            // In progress: progress indicator, connect hidden (Req 7.6).
            <div className="flex flex-col items-center gap-4 py-6 text-center">
              <div className="h-10 w-10 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
              <div>
                <h3 className="text-base font-semibold text-foreground">Connecting your number…</h3>
                <p className="mt-1 text-sm text-muted-foreground max-w-sm">
                  We&apos;re setting up your WhatsApp Business number. This can take a few moments.
                </p>
              </div>
            </div>
          ) : (
            // not_started / disconnected: show the connect action (Req 1.2, 1.4).
            <>
              <div>
                <p className="text-sm font-medium text-foreground">
                  Connect your own WhatsApp Business number for:
                </p>
              </div>

              <div className="space-y-3">
                {features.map((feature) => {
                  const Icon = feature.icon;
                  return (
                    <div key={feature.label} className="flex items-center gap-3 rounded-lg bg-muted/50 px-4 py-3">
                      <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                        <Icon className="size-4 text-emerald-600 dark:text-emerald-400" />
                      </div>
                      <span className="text-sm font-medium text-foreground">{feature.label}</span>
                    </div>
                  );
                })}
              </div>

              {controls.showConnect && (
                embeddedSignupAvailable ? (
                  <div className="space-y-3">
                    <Button
                      className="w-full rounded-xl bg-emerald-600 text-white hover:bg-emerald-700"
                      size="lg"
                      onClick={handleConnectWhatsApp}
                      disabled={connecting}
                    >
                      {connecting ? (
                        <>
                          <span className="size-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                          Connecting...
                        </>
                      ) : (
                        <>
                          <MessageCircle className="size-4" />
                          Connect WhatsApp
                        </>
                      )}
                    </Button>
                    <p className="text-center text-xs text-muted-foreground">
                      Or continue using the default SnipandGlow number
                    </p>
                  </div>
                ) : setupRequest && (setupRequest.status === 'pending' || setupRequest.status === 'in_progress') ? (
                  // Interim: a manual setup request is already in progress.
                  <div className="flex flex-col items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-800/30 dark:bg-amber-900/10 px-4 py-5 text-center">
                    <div className="flex size-12 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
                      <Hourglass className="size-6 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-foreground">Setup in progress</h3>
                      <p className="mt-1 text-xs text-muted-foreground max-w-sm">
                        We&apos;ve received your request for <span className="font-medium">{setupRequest.contactPhone}</span>.
                        Our team will set up your WhatsApp Business number and contact you within 24 hours.
                        Until then, messages continue from the SnipandGlow number.
                      </p>
                    </div>
                  </div>
                ) : (
                  // Interim: collect a manual setup request.
                  <div className="space-y-3">
                    <div className="rounded-lg bg-muted/50 px-4 py-3">
                      <p className="text-xs text-muted-foreground">
                        Self-serve connection is rolling out soon. Request setup and our team will connect
                        your WhatsApp Business number for you — usually within 24 hours.
                      </p>
                    </div>
                    <div className="space-y-2">
                      <input
                        type="tel"
                        value={requestPhone}
                        onChange={(e) => setRequestPhone(e.target.value)}
                        placeholder="Your WhatsApp number (e.g. +91 98765 43210)"
                        className="w-full h-10 rounded-xl border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                      <input
                        type="text"
                        value={requestName}
                        onChange={(e) => setRequestName(e.target.value)}
                        placeholder="Contact name (optional)"
                        className="w-full h-10 rounded-xl border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                    </div>
                    {requestError && (
                      <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 dark:border-red-800/30 dark:bg-red-900/10 px-3 py-2 text-xs text-red-600 dark:text-red-400">
                        <AlertTriangle className="size-3.5 shrink-0" /> {requestError}
                      </div>
                    )}
                    <Button
                      className="w-full rounded-xl bg-emerald-600 text-white hover:bg-emerald-700"
                      size="lg"
                      onClick={handleRequestSetup}
                      disabled={submittingRequest}
                    >
                      {submittingRequest ? (
                        <>
                          <span className="size-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                          Submitting...
                        </>
                      ) : (
                        <>
                          <MessageCircle className="size-4" />
                          Request WhatsApp Setup
                        </>
                      )}
                    </Button>
                    <p className="text-center text-xs text-muted-foreground">
                      Or continue using the default SnipandGlow number
                    </p>
                  </div>
                )
              )}
            </>
          )}

          {/* Transient notice for cancel / SDK-not-ready (Req 2.3, 2.5). */}
          {notice && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800/30 dark:bg-amber-900/10 px-4 py-3">
              <p className="text-sm text-amber-800 dark:text-amber-200">{notice}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
