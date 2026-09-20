import { NextResponse } from 'next/server';
import {
  listCartAbandonmentReminderCandidates,
  sendCartAbandonmentReminder
} from '@/lib/cart-abandonment-reminder.server';
import { getServerSupabaseClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const maxDuration = 300;

function isCronTokenAuthorized(request: Request) {
  const expected =
    process.env.CRON_CART_ABANDONMENT_TOKEN?.trim() ||
    process.env.CRON_SECRET?.trim() ||
    process.env.CRON_WEEKLY_STOCK_TOKEN?.trim() ||
    process.env.CRON_ARCHIVE_STAYS_TOKEN?.trim() ||
    process.env.RAG_REINDEX_TOKEN?.trim() ||
    '';
  if (!expected) return false;

  const auth = request.headers.get('authorization');
  const bearer = auth?.startsWith('Bearer ') ? auth.slice(7).trim() : null;
  const headerToken = request.headers.get('x-cron-token')?.trim() ?? null;
  const urlToken = new URL(request.url).searchParams.get('token')?.trim() ?? null;

  return bearer === expected || headerToken === expected || urlToken === expected;
}

export async function GET(request: Request) {
  if (!isCronTokenAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const dryRun = url.searchParams.get('dryRun') === '1';
  const toOverride = (url.searchParams.get('to') ?? '').trim().toLowerCase();
  const limitRaw = Number.parseInt(url.searchParams.get('limit') ?? '200', 10);
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 500) : 200;

  const supabase = getServerSupabaseClient();

  let candidates;
  try {
    candidates = await listCartAbandonmentReminderCandidates(supabase, { limit });
  } catch (error) {
    console.error('[api/cron/cart-abandonment-reminder] list failure', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Impossible de lister les paniers.' },
      { status: 500 }
    );
  }

  const preview = candidates.slice(0, 20).map((candidate) => ({
    checkoutId: candidate.checkoutId,
    email: toOverride || candidate.email,
    familyName: candidate.familyName,
    stayTitle: candidate.stayTitle,
    referenceAt: candidate.referenceAt,
    itemCount: candidate.itemCount
  }));

  if (dryRun) {
    return NextResponse.json({
      ok: true,
      dryRun: true,
      candidates: candidates.length,
      sent: 0,
      skipped: candidates.length,
      failed: 0,
      toOverride: toOverride || null,
      preview
    });
  }

  const sent: Array<{ checkoutId: string; email: string }> = [];
  const skipped: Array<{ checkoutId: string; reason: string }> = [];
  const failed: Array<{ checkoutId: string; email: string; error: string }> = [];

  for (const candidate of candidates) {
    try {
      const result = await sendCartAbandonmentReminder({
        supabase,
        candidate,
        toOverride: toOverride || null
      });
      if (result.skipped) {
        skipped.push({ checkoutId: candidate.checkoutId, reason: result.reason });
        continue;
      }
      sent.push({ checkoutId: candidate.checkoutId, email: result.to });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'send-failed';
      console.error('[api/cron/cart-abandonment-reminder] send failure', {
        checkoutId: candidate.checkoutId,
        email: toOverride || candidate.email,
        error: message
      });
      failed.push({
        checkoutId: candidate.checkoutId,
        email: toOverride || candidate.email,
        error: message
      });
    }
  }

  return NextResponse.json({
    ok: failed.length === 0,
    dryRun: false,
    candidates: candidates.length,
    sent: sent.length,
    skipped: skipped.length,
    failed: failed.length,
    failures: failed.slice(0, 20),
    skippedSample: skipped.slice(0, 20),
    preview
  });
}
