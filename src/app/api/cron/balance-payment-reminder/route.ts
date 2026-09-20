import { NextResponse } from 'next/server';
import {
  listBalanceReminderCandidates,
  sendBalanceReminder
} from '@/lib/balance-payment-reminder.server';
import { getServerSupabaseClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const maxDuration = 300;

function isCronTokenAuthorized(request: Request) {
  const expected =
    process.env.CRON_PAYMENT_REMINDER_TOKEN?.trim() ||
    process.env.CRON_SECRET?.trim() ||
    process.env.CRON_CART_ABANDONMENT_TOKEN?.trim() ||
    process.env.CRON_WEEKLY_STOCK_TOKEN?.trim() ||
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
    candidates = await listBalanceReminderCandidates(supabase, { limit });
  } catch (error) {
    console.error('[api/cron/balance-payment-reminder] list failure', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Impossible de lister les commandes.' },
      { status: 500 }
    );
  }

  const preview = candidates.slice(0, 20).map((candidate) => ({
    orderId: candidate.orderId,
    email: toOverride || candidate.email,
    stayTitle: candidate.stayTitle,
    departureDate: candidate.departureDate,
    remainingBalanceCents: candidate.remainingBalanceCents
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

  const sent: Array<{ orderId: string; email: string }> = [];
  const skipped: Array<{ orderId: string; reason: string }> = [];
  const failed: Array<{ orderId: string; error: string }> = [];

  for (const candidate of candidates) {
    try {
      const result = await sendBalanceReminder(supabase, candidate, { toOverride: toOverride || null });
      if (result.sent && result.email) {
        sent.push({ orderId: candidate.orderId, email: result.email });
      } else {
        skipped.push({ orderId: candidate.orderId, reason: result.skipped ?? 'skipped' });
      }
    } catch (error) {
      failed.push({
        orderId: candidate.orderId,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  return NextResponse.json({
    ok: true,
    dryRun: false,
    candidates: candidates.length,
    sent: sent.length,
    skipped: skipped.length,
    failed: failed.length,
    sentRows: sent.slice(0, 50),
    skippedRows: skipped.slice(0, 50),
    failedRows: failed.slice(0, 50)
  });
}
