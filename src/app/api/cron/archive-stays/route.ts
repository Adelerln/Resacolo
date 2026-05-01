import { NextResponse } from 'next/server';
import { getServerSupabaseClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

function isCronTokenAuthorized(request: Request) {
  const expected =
    process.env.CRON_ARCHIVE_STAYS_TOKEN?.trim() || process.env.RAG_REINDEX_TOKEN?.trim() || '';
  if (!expected) return false;

  const auth = request.headers.get('authorization');
  const bearer = auth?.startsWith('Bearer ') ? auth.slice(7).trim() : null;
  const headerToken = request.headers.get('x-cron-token')?.trim() ?? null;
  const urlToken = new URL(request.url).searchParams.get('token')?.trim() ?? null;

  return bearer === expected || headerToken === expected || urlToken === expected;
}

function getTodayParisDateIso() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date());

  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;

  if (!year || !month || !day) {
    return new Date().toISOString().slice(0, 10);
  }

  return `${year}-${month}-${day}`;
}

export async function GET(request: Request) {
  if (!isCronTokenAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getServerSupabaseClient();
  const todayParis = getTodayParisDateIso();

  const { data: stays, error: staysError } = await supabase
    .from('stays')
    .select('id,status,archive_at')
    .in('status', ['PUBLISHED', 'HIDDEN']);

  if (staysError) {
    console.error('[api/cron/archive-stays] stays read failure', staysError.message);
    return NextResponse.json({ error: 'Impossible de lire les séjours.' }, { status: 500 });
  }

  const stayIds = (stays ?? []).map((stay) => stay.id);
  if (stayIds.length === 0) {
    return NextResponse.json({ ok: true, archivedCount: 0, scannedCount: 0, todayParis });
  }

  const { data: sessions, error: sessionsError } = await supabase
    .from('sessions')
    .select('stay_id,start_date')
    .in('stay_id', stayIds);

  if (sessionsError) {
    console.error('[api/cron/archive-stays] sessions read failure', sessionsError.message);
    return NextResponse.json({ error: 'Impossible de lire les sessions.' }, { status: 500 });
  }

  const sessionsByStayId = new Map<string, string[]>();
  for (const sessionItem of sessions ?? []) {
    const current = sessionsByStayId.get(sessionItem.stay_id) ?? [];
    current.push(sessionItem.start_date);
    sessionsByStayId.set(sessionItem.stay_id, current);
  }

  const toArchive = (stays ?? [])
    .filter((stay) => {
      const staySessions = sessionsByStayId.get(stay.id) ?? [];
      if (staySessions.length === 0) return false;
      return staySessions.every((startDate) => startDate < todayParis);
    })
    .map((stay) => stay.id);

  if (toArchive.length === 0) {
    return NextResponse.json({
      ok: true,
      archivedCount: 0,
      scannedCount: stayIds.length,
      todayParis
    });
  }

  const { error: archiveError } = await supabase
    .from('stays')
    .update({ status: 'ARCHIVED', archive_at: new Date().toISOString() })
    .in('id', toArchive)
    .in('status', ['PUBLISHED', 'HIDDEN']);

  if (archiveError) {
    console.error('[api/cron/archive-stays] update failure', archiveError.message);
    return NextResponse.json({ error: 'Impossible d’archiver les séjours.' }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    archivedCount: toArchive.length,
    scannedCount: stayIds.length,
    todayParis
  });
}
