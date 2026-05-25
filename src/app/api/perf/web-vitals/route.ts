import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  isPerfPageTemplate,
  isTrackedWebVitalMetric,
  PERF_BUDGETS,
  resolvePerfPageTemplate
} from '@/lib/perf/budgets';
import { getServerSupabaseClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

const PayloadSchema = z.object({
  route: z.string().trim().min(1).max(512),
  pageTemplate: z.string().trim().min(1).max(64),
  metricName: z.string().trim().min(1).max(16),
  metricValue: z.number().finite().nonnegative(),
  rating: z.enum(['good', 'needs-improvement', 'poor']).nullable().optional(),
  navigationType: z.string().trim().max(64).nullable().optional(),
  deviceType: z.enum(['mobile', 'tablet', 'desktop']),
  connectionType: z.string().trim().max(64).nullable().optional(),
  withinBudget: z.boolean().nullable().optional(),
  budgetTarget: z.number().finite().nonnegative().nullable().optional(),
  userAgent: z.string().trim().max(240).nullable().optional(),
  details: z.record(z.string(), z.unknown()).default({})
});

type InsertPayload = {
  route: string;
  page_template: string;
  metric_name: string;
  metric_value: number;
  rating: 'good' | 'needs-improvement' | 'poor' | null;
  navigation_type: string | null;
  device_type: 'mobile' | 'tablet' | 'desktop';
  connection_type: string | null;
  within_budget: boolean | null;
  budget_target: number | null;
  user_agent: string | null;
  details: Record<string, unknown>;
};

function getNormalizedOriginHost(origin: string | null) {
  if (!origin) return null;
  try {
    return new URL(origin).host;
  } catch {
    return null;
  }
}

function isAllowedOrigin(req: Request) {
  const originHost = getNormalizedOriginHost(req.headers.get('origin'));
  if (!originHost) return true;
  const requestHost = req.headers.get('host');
  if (!requestHost) return true;
  return originHost === requestHost;
}

export async function POST(req: Request) {
  if (!isAllowedOrigin(req)) {
    return NextResponse.json({ ok: false }, { status: 403 });
  }

  const rawText = await req.text();
  let rawPayload: unknown = null;
  try {
    rawPayload = JSON.parse(rawText);
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const parsed = PayloadSchema.safeParse(rawPayload);
  if (!parsed.success) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const payload = parsed.data;
  if (!isTrackedWebVitalMetric(payload.metricName)) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const resolvedTemplate = resolvePerfPageTemplate(payload.route);
  const inferredTemplate =
    resolvedTemplate ?? (isPerfPageTemplate(payload.pageTemplate) ? payload.pageTemplate : null);
  const pageTemplate = inferredTemplate ?? payload.pageTemplate;
  const budgetTarget =
    inferredTemplate != null ? PERF_BUDGETS[inferredTemplate][payload.metricName] : payload.budgetTarget ?? null;
  const withinBudget = budgetTarget != null ? payload.metricValue <= budgetTarget : payload.withinBudget ?? null;

  const row: InsertPayload = {
    route: payload.route,
    page_template: pageTemplate,
    metric_name: payload.metricName,
    metric_value: payload.metricValue,
    rating: payload.rating ?? null,
    navigation_type: payload.navigationType ?? null,
    device_type: payload.deviceType,
    connection_type: payload.connectionType ?? null,
    within_budget: withinBudget,
    budget_target: budgetTarget,
    user_agent: payload.userAgent ?? req.headers.get('user-agent'),
    details: payload.details
  };

  const supabase = getServerSupabaseClient();
  const webVitalsTable = (
    supabase.from as unknown as (
      table: string
    ) => {
      insert: (
        values: InsertPayload
      ) => Promise<{
        error: { message?: string } | null;
      }>;
    }
  )('web_vitals_events');

  const { error } = await webVitalsTable.insert(row);
  if (error) {
    console.warn('[perf/web-vitals] insert failed:', error.message ?? 'unknown');
  }

  return NextResponse.json({ ok: true }, { status: 202 });
}
