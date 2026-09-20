import { NextResponse } from 'next/server';
import {
  buildWeeklyStockReports,
  buildWeeklyStockReportSubject,
  renderWeeklyStockReportHtml,
  renderWeeklyStockReportText,
  shouldRunWeeklyStockReport,
  WEEKLY_STOCK_REPORT_START_DATE
} from '@/lib/organizer-weekly-stock-report';
import { sendSmtpEmail } from '@/lib/rag/smtp';
import { getServerSupabaseClient } from '@/lib/supabase/server';
import {
  createWeeklyStockReportRunId,
  insertWeeklyStockReportEmailLog
} from '@/lib/weekly-stock-report-email-logs.server';

export const runtime = 'nodejs';
export const maxDuration = 300;

function isCronTokenAuthorized(request: Request) {
  const expected =
    process.env.CRON_WEEKLY_STOCK_TOKEN?.trim() ||
    process.env.CRON_SECRET?.trim() ||
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
  const force = url.searchParams.get('force') === '1';
  const organizerFilter = (url.searchParams.get('organizer') ?? url.searchParams.get('organizerSlug') ?? '')
    .trim()
    .toLowerCase();
  const toOverride = (url.searchParams.get('to') ?? '').trim().toLowerCase();
  const scheduleCheck = shouldRunWeeklyStockReport(new Date(), { bypassSchedule: force || dryRun });
  const runId = createWeeklyStockReportRunId();

  if (!scheduleCheck.ok) {
    await insertWeeklyStockReportEmailLog({
      runId,
      reportDate: scheduleCheck.clock.dateIso,
      recipientEmail: 'cron@resacolo.internal',
      status: 'skipped',
      errorMessage: scheduleCheck.reason,
      dryRun,
      forceRun: force,
      metadata: {
        kind: 'schedule-skip',
        parisHour: scheduleCheck.clock.hour,
        weekday: scheduleCheck.clock.weekday
      }
    });

    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: scheduleCheck.reason,
      runId,
      reportDate: scheduleCheck.clock.dateIso,
      parisHour: scheduleCheck.clock.hour,
      startDate: WEEKLY_STOCK_REPORT_START_DATE
    });
  }

  const reportDateIso = scheduleCheck.clock.dateIso;
  const supabase = getServerSupabaseClient();

  let reports;
  try {
    reports = await buildWeeklyStockReports(supabase);
  } catch (error) {
    console.error('[api/cron/weekly-stock-report] build failure', error);
    await insertWeeklyStockReportEmailLog({
      runId,
      reportDate: reportDateIso,
      recipientEmail: 'cron@resacolo.internal',
      status: 'failed',
      errorMessage: error instanceof Error ? error.message : 'Impossible de construire les rapports.',
      dryRun,
      forceRun: force,
      metadata: { kind: 'build-failure' }
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Impossible de construire les rapports.', runId },
      { status: 500 }
    );
  }

  if (organizerFilter) {
    reports = reports.filter((report) => {
      const name = report.organizerName.toLowerCase();
      return name.includes(organizerFilter) || report.organizerId.toLowerCase() === organizerFilter;
    });
  }

  const subject = buildWeeklyStockReportSubject(reportDateIso);
  const sent: Array<{ organizerId: string; email: string }> = [];
  const failed: Array<{ organizerId: string; email: string; error: string }> = [];
  const preview = dryRun
    ? reports.slice(0, 20).map((report) => ({
        organizerId: report.organizerId,
        organizerName: report.organizerName,
        email: toOverride || report.contactEmail,
        activeSessionCount: report.activeSessionCount,
        remainingPlaces: report.remainingPlaces,
        fullSessionCount: report.fullSessionCount,
        seasonCount: report.seasons.length
      }))
    : undefined;

  if (dryRun) {
    for (const report of reports) {
      await insertWeeklyStockReportEmailLog({
        runId,
        reportDate: reportDateIso,
        organizerId: report.organizerId,
        organizerName: report.organizerName,
        recipientEmail: toOverride || report.contactEmail,
        status: 'skipped',
        subject,
        activeSessionCount: report.activeSessionCount,
        remainingPlaces: report.remainingPlaces,
        fullSessionCount: report.fullSessionCount,
        dryRun: true,
        forceRun: force,
        metadata: { kind: 'dry-run' }
      });
    }

    return NextResponse.json({
      ok: true,
      dryRun: true,
      runId,
      reportDate: reportDateIso,
      startDate: WEEKLY_STOCK_REPORT_START_DATE,
      candidates: reports.length,
      sent: 0,
      skipped: reports.length,
      failed: 0,
      toOverride: toOverride || null,
      preview
    });
  }

  for (const report of reports) {
    const to = toOverride || report.contactEmail;
    try {
      const html = renderWeeklyStockReportHtml({ report, reportDateIso });
      const text = renderWeeklyStockReportText({ report, reportDateIso });
      await sendSmtpEmail({
        to,
        subject,
        text,
        html
      });
      sent.push({ organizerId: report.organizerId, email: to });
      await insertWeeklyStockReportEmailLog({
        runId,
        reportDate: reportDateIso,
        organizerId: report.organizerId,
        organizerName: report.organizerName,
        recipientEmail: to,
        status: 'sent',
        subject,
        activeSessionCount: report.activeSessionCount,
        remainingPlaces: report.remainingPlaces,
        fullSessionCount: report.fullSessionCount,
        dryRun: false,
        forceRun: force
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'send-failed';
      console.error('[api/cron/weekly-stock-report] send failure', {
        organizerId: report.organizerId,
        email: to,
        error: message
      });
      failed.push({
        organizerId: report.organizerId,
        email: to,
        error: message
      });
      await insertWeeklyStockReportEmailLog({
        runId,
        reportDate: reportDateIso,
        organizerId: report.organizerId,
        organizerName: report.organizerName,
        recipientEmail: to,
        status: 'failed',
        errorMessage: message,
        subject,
        activeSessionCount: report.activeSessionCount,
        remainingPlaces: report.remainingPlaces,
        fullSessionCount: report.fullSessionCount,
        dryRun: false,
        forceRun: force
      });
    }
  }

  return NextResponse.json({
    ok: failed.length === 0,
    dryRun: false,
    runId,
    reportDate: reportDateIso,
    startDate: WEEKLY_STOCK_REPORT_START_DATE,
    candidates: reports.length,
    sent: sent.length,
    skipped: 0,
    failed: failed.length,
    failures: failed.slice(0, 20)
  });
}
