'use client';

import { formatDateIN } from '@/lib/utils';
import { DataTable, type Column } from '@/components/data-table';
import {
  MessageCircle,
  Star,
  ThumbsUp,
  ThumbsDown,
  Sparkles,
  Phone,
  Info,
} from 'lucide-react';
import type { UserRole } from '@/types';

// =============================================================================
// Feedback Client Component
// =============================================================================

export interface FeedbackRow {
  id: string;
  customer_name: string;
  customer_phone: string;
  rating: number;
  comment: string;
  source: string;
  created_at: string;
}

interface FeedbackClientProps {
  feedbackRecords: FeedbackRow[];
  role: UserRole;
}

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`size-4 ${
            star <= rating
              ? 'text-amber-400 fill-amber-400'
              : 'text-gray-200 dark:text-gray-700'
          }`}
        />
      ))}
      <span className="ml-1.5 text-xs font-medium text-muted-foreground">{rating}/5</span>
    </div>
  );
}

export function FeedbackClient({ feedbackRecords, role }: FeedbackClientProps) {
  // Calculate stats
  const totalFeedback = feedbackRecords.length;
  const avgRating = totalFeedback > 0
    ? (feedbackRecords.reduce((sum, f) => sum + f.rating, 0) / totalFeedback).toFixed(1)
    : '0';
  const positiveCount = feedbackRecords.filter((f) => f.rating >= 4).length;
  const negativeCount = feedbackRecords.filter((f) => f.rating <= 2).length;

  const columns: Column<FeedbackRow>[] = [
    {
      key: 'customer',
      header: 'Customer',
      render: (row) => (
        <div className="flex items-center gap-2">
          <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-salon-rose/20 to-salon-gold/20 text-xs font-bold text-salon-rose">
            {row.customer_name.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">{row.customer_name}</p>
            {row.customer_phone && (
              <p className="text-xs text-muted-foreground">{row.customer_phone}</p>
            )}
          </div>
        </div>
      ),
    },
    {
      key: 'rating',
      header: 'Rating',
      render: (row) => <StarRating rating={row.rating} />,
    },
    {
      key: 'comment',
      header: 'Comment',
      render: (row) => (
        <p className="text-sm text-muted-foreground line-clamp-2 max-w-xs">
          {row.comment || '—'}
        </p>
      ),
    },
    {
      key: 'source',
      header: 'Source',
      render: (row) => (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 dark:bg-green-900/30 px-2.5 py-0.5 text-xs font-medium text-green-700 dark:text-green-400 capitalize">
          <MessageCircle className="size-3" />
          {row.source}
        </span>
      ),
    },
    {
      key: 'date',
      header: 'Date',
      render: (row) => (
        <span className="text-sm text-muted-foreground">{formatDateIN(row.created_at)}</span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent border border-amber-200/50 dark:border-amber-800/30 p-6">
        <div className="relative z-10 flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-900/30">
            <Star className="size-5 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Customer Feedback</h1>
            <p className="text-sm text-muted-foreground">
              {totalFeedback > 0 ? `${totalFeedback} reviews received` : 'Feedback from your customers'}
            </p>
          </div>
        </div>
        <div className="absolute -right-6 -top-6 h-32 w-32 rounded-full bg-amber-500/5" />
      </div>

      {/* Stats Cards */}
      {totalFeedback > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/30">
                <Star className="size-4 text-amber-600 dark:text-amber-400 fill-amber-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{avgRating}</p>
                <p className="text-xs text-muted-foreground">Avg Rating</p>
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                <ThumbsUp className="size-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{positiveCount}</p>
                <p className="text-xs text-muted-foreground">Positive (4-5★)</p>
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-lg bg-red-100 dark:bg-red-900/30">
                <ThumbsDown className="size-4 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{negativeCount}</p>
                <p className="text-xs text-muted-foreground">Needs Attention (1-2★)</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Feedback Table or Empty State */}
      {totalFeedback > 0 ? (
        <div className="rounded-xl border border-border overflow-hidden">
          <DataTable
            columns={columns}
            data={feedbackRecords}
            getRowKey={(row) => row.id}
            emptyMessage="No feedback yet"
          />
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-card p-8 sm:p-12">
          <div className="flex flex-col items-center text-center max-w-md mx-auto">
            <div className="flex size-16 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-100 to-orange-100 dark:from-amber-900/30 dark:to-orange-900/30 mb-5">
              <Sparkles className="size-7 text-amber-600 dark:text-amber-400" />
            </div>
            <h3 className="text-lg font-bold text-foreground mb-2">Feedback Coming Soon</h3>
            <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
              Once WhatsApp Business API is connected, your customers will automatically receive a feedback request after every appointment. Their ratings and comments will appear here.
            </p>

            {/* How it works */}
            <div className="w-full rounded-xl bg-muted/50 border border-border p-5 text-left space-y-4">
              <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Info className="size-4 text-muted-foreground" />
                How it will work
              </h4>
              <div className="space-y-3">
                <Step number={1} text="Customer completes their appointment" />
                <Step number={2} text="SnipandGlow sends a WhatsApp message asking for a rating (1-5 stars)" />
                <Step number={3} text="Customer replies with their rating and optional comment" />
                <Step number={4} text="Feedback appears here instantly with customer details" />
              </div>
            </div>

            {/* Benefits */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-6 w-full text-left">
              <div className="flex items-start gap-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800/30 p-3">
                <ThumbsUp className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-medium text-foreground">5★ ratings</p>
                  <p className="text-xs text-muted-foreground">Auto-request Google review</p>
                </div>
              </div>
              <div className="flex items-start gap-2.5 rounded-lg bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800/30 p-3">
                <ThumbsDown className="size-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-medium text-foreground">1-2★ ratings</p>
                  <p className="text-xs text-muted-foreground">Alert owner immediately</p>
                </div>
              </div>
            </div>

            {/* Connect CTA */}
            <div className="mt-6 flex items-center gap-2 text-xs text-muted-foreground">
              <Phone className="size-3.5" />
              <span>Connect your WhatsApp Business number in</span>
              <a href="/dashboard/whatsapp" className="text-salon-rose hover:underline font-medium">
                WhatsApp Settings
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Step({ number, text }: { number: number; text: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-white">
        {number}
      </span>
      <span className="text-sm text-muted-foreground">{text}</span>
    </div>
  );
}
