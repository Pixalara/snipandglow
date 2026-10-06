import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { processCampaignBatch } from '@/lib/whatsapp/campaign-runner';

// =============================================================================
// Campaign drip — drains active WhatsApp marketing campaigns in the background.
//
// Called on a short schedule (every 1-2 minutes) by the same external cron that
// runs the other /api/cron/* jobs (authenticated with ?secret=CRON_SECRET). It
// picks every campaign still in 'sending', sends the next batch of recipients
// for each, and marks them completed when their ledger is drained.
//
// This is a safety net: the owner's progress screen also drains the campaign
// while open. Both share the race-safe claim in campaign-runner, so running
// together never double-sends. If no external cron is configured, a campaign
// still completes as long as the owner keeps the progress screen open.
// =============================================================================

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Recipients sent per batch, per campaign iteration.
const BATCH = 80;
// Leave headroom under maxDuration so the function returns cleanly.
const TIME_BUDGET_MS = 50_000;
// Hard stop on batches per campaign per run (time budget usually stops first).
const MAX_BATCHES_PER_CAMPAIGN = 60;

export async function GET(request: NextRequest) {
  const secret = request.nextUrl.searchParams.get('secret');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && secret !== cronSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const started = Date.now();
  const admin = createAdminClient();

  // Oldest active campaigns first (fairness across tenants).
  const { data: sending } = await (admin
    .from('whatsapp_campaigns' as any)
    .select('id')
    .eq('status', 'sending')
    .order('created_at', { ascending: true })
    .limit(25) as any);

  const results: Array<{ id: string; status: string; sent: number; failed: number; pending: number }> = [];

  for (const c of (sending ?? []) as Array<{ id: string }>) {
    if (Date.now() - started > TIME_BUDGET_MS) break;

    let batches = 0;
    let last = null as Awaited<ReturnType<typeof processCampaignBatch>>;
    while (batches < MAX_BATCHES_PER_CAMPAIGN && Date.now() - started < TIME_BUDGET_MS) {
      batches++;
      last = await processCampaignBatch(c.id, BATCH);
      // Stop this campaign when it is drained, finished, paused, or gone.
      if (!last || last.status !== 'sending' || last.pending === 0) break;
    }

    if (last) {
      results.push({ id: last.id, status: last.status, sent: last.sent, failed: last.failed, pending: last.pending });
    }
  }

  return NextResponse.json({
    status: 'ok',
    campaigns_processed: results.length,
    elapsed_ms: Date.now() - started,
    results,
  });
}
