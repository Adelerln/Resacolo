import 'server-only';

import { randomUUID } from 'node:crypto';
import { isMissingPublicTableError } from '@/lib/mnemos/supabase-table-missing';
import { getServerSupabaseClient } from '@/lib/supabase/server';
import type { Database, Json } from '@/types/supabase';

export type WeeklyStockReportEmailLogStatus = 'sent' | 'failed' | 'skipped';

export type WeeklyStockReportEmailLogInsert = {
  runId: string;
  reportDate: string;
  organizerId?: string | null;
  organizerName?: string | null;
  recipientEmail: string;
  status: WeeklyStockReportEmailLogStatus;
  errorMessage?: string | null;
  subject?: string | null;
  activeSessionCount?: number | null;
  remainingPlaces?: number | null;
  fullSessionCount?: number | null;
  dryRun?: boolean;
  forceRun?: boolean;
  metadata?: Record<string, unknown>;
};

type LogRow = Database['public']['Tables']['weekly_stock_report_email_logs']['Row'];

export function createWeeklyStockReportRunId() {
  return randomUUID();
}

export async function insertWeeklyStockReportEmailLog(input: WeeklyStockReportEmailLogInsert) {
  try {
    const supabase = getServerSupabaseClient();
    const { error } = await supabase.from('weekly_stock_report_email_logs').insert({
      run_id: input.runId,
      report_date: input.reportDate,
      organizer_id: input.organizerId ?? null,
      organizer_name: input.organizerName?.trim() || null,
      recipient_email: input.recipientEmail.trim().toLowerCase(),
      status: input.status,
      error_message: input.errorMessage?.trim() || null,
      subject: input.subject?.trim() || null,
      active_session_count: input.activeSessionCount ?? null,
      remaining_places: input.remainingPlaces ?? null,
      full_session_count: input.fullSessionCount ?? null,
      dry_run: Boolean(input.dryRun),
      force_run: Boolean(input.forceRun),
      metadata: (input.metadata ?? {}) as Json
    });

    if (error) {
      if (isMissingPublicTableError(error)) {
        console.warn(
          '[weekly-stock-report-email-logs] table absente — appliquez 20260916_create_weekly_stock_report_email_logs.sql'
        );
        return;
      }
      console.error('[weekly-stock-report-email-logs] insert failed', error.message);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error ?? '');
    console.error('[weekly-stock-report-email-logs] unexpected error', message);
  }
}

export async function listWeeklyStockReportEmailLogs(options?: {
  limit?: number;
  reportDate?: string | null;
  status?: WeeklyStockReportEmailLogStatus | null;
}) {
  const supabase = getServerSupabaseClient();
  let query = supabase
    .from('weekly_stock_report_email_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(options?.limit ?? 300);

  if (options?.reportDate?.trim()) {
    query = query.eq('report_date', options.reportDate.trim());
  }
  if (options?.status) {
    query = query.eq('status', options.status);
  }

  const { data, error } = await query;
  return {
    rows: (data as LogRow[] | null) ?? [],
    error,
    tableMissing: Boolean(error && isMissingPublicTableError(error))
  };
}

export type WeeklyStockReportRunSummary = {
  runId: string;
  reportDate: string;
  createdAt: string;
  dryRun: boolean;
  forceRun: boolean;
  sent: number;
  failed: number;
  skipped: number;
  total: number;
  rows: LogRow[];
};

export function groupWeeklyStockReportLogsByRun(rows: LogRow[]): WeeklyStockReportRunSummary[] {
  const byRun = new Map<string, WeeklyStockReportRunSummary>();

  for (const row of rows) {
    const existing = byRun.get(row.run_id);
    if (!existing) {
      byRun.set(row.run_id, {
        runId: row.run_id,
        reportDate: row.report_date,
        createdAt: row.created_at,
        dryRun: row.dry_run,
        forceRun: row.force_run,
        sent: row.status === 'sent' ? 1 : 0,
        failed: row.status === 'failed' ? 1 : 0,
        skipped: row.status === 'skipped' ? 1 : 0,
        total: 1,
        rows: [row]
      });
      continue;
    }

    existing.total += 1;
    if (row.status === 'sent') existing.sent += 1;
    if (row.status === 'failed') existing.failed += 1;
    if (row.status === 'skipped') existing.skipped += 1;
    if (row.created_at < existing.createdAt) existing.createdAt = row.created_at;
    existing.rows.push(row);
  }

  return Array.from(byRun.values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
