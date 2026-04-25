import {
  buildStaySessionMergeKey,
  extractCeslStructuredBookingData,
  fetchPaginatedDepartureTableData,
  fetchZigotoursDepartureData,
  extractJsonLdOfferPricesFromHtml,
  extractStayData,
  extractThalieOptionUrlPricing,
  extractTransportVariants,
  extractVideoUrls,
  fetchHtml,
  buildDraftTransportOptionsFromVariants,
  mergeDraftSessionItems,
  mergeThalieSessionBaselinesIntoSessions,
  pickImportedSessionReferencePriceCents,
  selectBestStayImages,
  type DraftTransportPriceDebug,
  type DraftTransportVariant,
  type ZigotoursDepartureDataResult
} from '@/lib/stay-draft-import';
import { load } from 'cheerio';
import {
  renderStayPageWithPlaywright,
  shouldUsePlaywrightForDynamicImages,
  shouldUsePlaywrightForDynamicSessions,
  shouldUsePlaywrightForDynamicTransport
} from '@/lib/stay-draft-playwright';
import { normalizeStayAges } from '@/lib/stay-ages';
import { tryCanonicalizeStaySourceUrl } from '@/lib/stay-source-url-canonical';
import { getServerSupabaseClient } from '@/lib/supabase/server';
import { normalizeStayTitle } from '@/lib/stay-title';
import type { Json } from '@/types/supabase';

function envTruthy(value: string | undefined): boolean {
  if (!value) return false;
  const v = value.trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}

const PLAYWRIGHT_RENDER_BUDGET_MS = 20_000;
const COLOS_CANDIDATE_LIMIT = 8;
const COLOS_SIGNAL_TOKENS = ['dates', 'tarifs', 'tarif', 'inscription', 'reserve', 'reserver', 'mobile'];

function normalizeForMatch(value: string | null | undefined): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function toAbsoluteHttpUrl(rawUrl: string | null | undefined, baseUrl: string): string | null {
  const normalized = String(rawUrl ?? '').trim();
  if (!normalized) return null;
  if (/^(?:mailto:|tel:|javascript:|#)/i.test(normalized)) return null;
  try {
    const url = new URL(normalized, baseUrl);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return url.toString();
  } catch {
    return null;
  }
}

function extractSignalHits(value: string): string[] {
  const normalized = normalizeForMatch(value);
  if (!normalized) return [];
  return COLOS_SIGNAL_TOKENS.filter((token) => normalized.includes(token));
}

function countUsableSessions(
  sessions: ReturnType<typeof extractStayData>['sessionsJson']
): number {
  return (sessions ?? []).filter((row) => Boolean(row.start_date || row.end_date || row.label)).length;
}

function countDatedSessions(
  sessions: ReturnType<typeof extractStayData>['sessionsJson']
): number {
  return (sessions ?? []).filter((row) => Boolean(row.start_date && row.end_date)).length;
}

function buildSessionQualitySignature(
  sessions: ReturnType<typeof extractStayData>['sessionsJson']
): string {
  return (sessions ?? [])
    .map((session) =>
      [
        String(session.start_date ?? ''),
        String(session.end_date ?? ''),
        String(session.label ?? ''),
        String(session.price ?? ''),
        String(session.availability ?? '')
      ].join('|')
    )
    .sort((a, b) => a.localeCompare(b, 'fr'))
    .join('||');
}

function countPricedTransportVariants(variants: DraftTransportVariant[]): number {
  return variants.filter(
    (variant) =>
      typeof variant.amount_cents === 'number' &&
      Number.isFinite(variant.amount_cents) &&
      variant.amount_cents >= 0
  ).length;
}

function countPricedTransportOptions(rows: Array<Record<string, unknown>>): number {
  return rows.filter((row) => {
    const amountCents = Number(row.amount_cents);
    if (Number.isFinite(amountCents) && amountCents >= 0) return true;
    const price = Number(row.price);
    return Number.isFinite(price) && price >= 0;
  }).length;
}

async function runZigotoursFallback(params: {
  html: string;
  pageUrl: string;
  includePricing: boolean;
  baseSessions: ReturnType<typeof extractStayData>['sessionsJson'];
  baseTransportVariants: DraftTransportVariant[];
}) {
  const beforeSessionCount = countUsableSessions(params.baseSessions);
  const beforeDatedSessionCount = countDatedSessions(params.baseSessions);
  const beforeSessionSignature = buildSessionQualitySignature(params.baseSessions);
  const beforePricedTransportCount = countPricedTransportVariants(params.baseTransportVariants);
  const baseTransportOptionsCount = countPricedTransportOptions(
    buildDraftTransportOptionsFromVariants(params.baseTransportVariants)
  );
  const fetchResult: ZigotoursDepartureDataResult = await fetchZigotoursDepartureData(
    params.html,
    params.pageUrl
  );

  const zigotoursData = fetchResult.data;
  const zigotoursDatedSessionCount = countDatedSessions(zigotoursData?.sessions ?? null);
  const shouldReplaceSessionsWithZigotours = Boolean(
    zigotoursData &&
      zigotoursDatedSessionCount > 0 &&
      (zigotoursDatedSessionCount >= beforeDatedSessionCount || beforeDatedSessionCount === 0)
  );
  const mergedSessions = shouldReplaceSessionsWithZigotours
    ? zigotoursData?.sessions ?? params.baseSessions
    : zigotoursData
      ? mergeExtractedSessions(params.baseSessions, zigotoursData.sessions)
      : params.baseSessions;
  const mergedTransportVariants =
    params.includePricing && zigotoursData
      ? mergeTransportVariants(params.baseTransportVariants, zigotoursData.transportVariants)
      : params.baseTransportVariants;

  const afterSessionCount = countUsableSessions(mergedSessions);
  const afterDatedSessionCount = countDatedSessions(mergedSessions);
  const afterSessionSignature = buildSessionQualitySignature(mergedSessions);
  const afterPricedTransportCount = countPricedTransportVariants(mergedTransportVariants);
  const fetchedTransportOptionsCount = countPricedTransportOptions(zigotoursData?.transportOptions ?? []);
  const improvedSessions =
    afterSessionSignature !== beforeSessionSignature &&
    (afterDatedSessionCount >= beforeDatedSessionCount || afterSessionCount > beforeSessionCount);
  const improvedTransport = afterPricedTransportCount > beforePricedTransportCount;
  const improvedTransportOptions =
    params.includePricing && fetchedTransportOptionsCount > baseTransportOptionsCount;

  return {
    sessions: mergedSessions,
    transportVariants: mergedTransportVariants,
    transportPriceDebug: zigotoursData?.transportPriceDebug ?? [],
    transportOptionsOverride:
      params.includePricing && improvedTransportOptions && (zigotoursData?.transportOptions.length ?? 0) > 0
        ? zigotoursData?.transportOptions ?? null
        : null,
    debrief: {
      enabled: true,
      triggered: true,
      endpoint_url: fetchResult.endpointUrl,
      sejour_id: fetchResult.stayId,
      fetch_reason: fetchResult.reason,
      fetch_status_code: fetchResult.statusCode,
      source_rows_count: fetchResult.rowCount,
      zigotours_data: zigotoursData
        ? {
            sessions_count: zigotoursData.sessions.length,
            transport_options_count: zigotoursData.transportOptions.length,
            transport_variants_count: zigotoursData.transportVariants.length
          }
        : null,
      before: {
        sessions_count: beforeSessionCount,
        dated_sessions_count: beforeDatedSessionCount,
        priced_transport_count: beforePricedTransportCount,
        priced_transport_options_count: baseTransportOptionsCount
      },
      after: {
        sessions_count: afterSessionCount,
        dated_sessions_count: afterDatedSessionCount,
        priced_transport_count: afterPricedTransportCount,
        priced_transport_options_count: fetchedTransportOptionsCount
      },
      improved: {
        sessions: improvedSessions,
        transport: improvedTransport,
        transport_options: improvedTransportOptions
      },
      applied_session_strategy: shouldReplaceSessionsWithZigotours ? 'zigotours-authoritative' : 'merged'
    }
  };
}

type ColosFallbackCandidate = {
  url: string;
  score: number;
  sources: string[];
  signal_hits: string[];
};

function discoverColosFallbackCandidates(html: string, pageUrl: string): ColosFallbackCandidate[] {
  const $ = load(html);
  const map = new Map<
    string,
    { url: string; score: number; sources: Set<string>; signalHits: Set<string> }
  >();

  const upsertCandidate = (
    rawUrl: string | null | undefined,
    source: string,
    context: string
  ) => {
    const resolvedUrl = toAbsoluteHttpUrl(rawUrl, pageUrl);
    if (!resolvedUrl) return;

    const contextSignals = extractSignalHits(context);
    const urlSignals = extractSignalHits(resolvedUrl);
    const allSignals = new Set([...contextSignals, ...urlSignals]);

    let score = source === 'iframe[src]' ? 200 : 80;
    score += allSignals.size * 25;
    if (normalizeForMatch(resolvedUrl).includes('reservation')) score += 40;
    if (normalizeForMatch(resolvedUrl).includes('inscription')) score += 30;
    if (normalizeForMatch(resolvedUrl).includes('mobile')) score += 30;
    if (normalizeForMatch(resolvedUrl).includes('tarif')) score += 25;
    if (normalizeForMatch(resolvedUrl).includes('date')) score += 20;

    const existing = map.get(resolvedUrl) ?? {
      url: resolvedUrl,
      score: 0,
      sources: new Set<string>(),
      signalHits: new Set<string>()
    };
    existing.score = Math.max(existing.score, score);
    existing.sources.add(source);
    for (const signal of Array.from(allSignals)) {
      existing.signalHits.add(signal);
    }
    map.set(resolvedUrl, existing);
  };

  $('iframe[src]').each((_, element) => {
    upsertCandidate(
      $(element).attr('src'),
      'iframe[src]',
      [
        $(element).attr('title') ?? '',
        $(element).attr('name') ?? '',
        $(element).attr('class') ?? '',
        $(element).attr('id') ?? ''
      ].join(' ')
    );
  });

  $('a[href]').each((_, element) => {
    const context = [
      $(element).text(),
      $(element).attr('title') ?? '',
      $(element).attr('aria-label') ?? '',
      $(element).attr('class') ?? '',
      $(element).attr('id') ?? ''
    ].join(' ');
    const hasSignals = extractSignalHits(context).length > 0 || extractSignalHits($(element).attr('href') ?? '').length > 0;
    if (!hasSignals) return;
    upsertCandidate($(element).attr('href'), 'a[href]', context);
  });

  return Array.from(map.values())
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      return left.url.localeCompare(right.url, 'fr');
    })
    .slice(0, COLOS_CANDIDATE_LIMIT)
    .map((candidate) => ({
      url: candidate.url,
      score: candidate.score,
      sources: Array.from(candidate.sources.values()),
      signal_hits: Array.from(candidate.signalHits.values())
    }));
}

async function runColosBonheurFallback(params: {
  html: string;
  pageUrl: string;
  includePricing: boolean;
  baseSessions: ReturnType<typeof extractStayData>['sessionsJson'];
  baseTransportVariants: DraftTransportVariant[];
}) {
  const beforeSessionCount = countUsableSessions(params.baseSessions);
  const beforePricedTransportCount = countPricedTransportVariants(params.baseTransportVariants);
  const candidates = discoverColosFallbackCandidates(params.html, params.pageUrl);
  const attempts: Array<Record<string, unknown>> = [];

  let mergedSessions = params.baseSessions;
  let mergedTransportVariants = [...params.baseTransportVariants];
  const mergedTransportPriceDebug: DraftTransportPriceDebug[] = [];
  let transportOptionsOverride: Array<Record<string, unknown>> | null = null;

  for (const candidate of candidates) {
    try {
      const fetched = await fetchHtml(candidate.url);
      const extracted = extractStayData(fetched.html, fetched.finalUrl);
      const paginatedData = await fetchPaginatedDepartureTableData(fetched.html, fetched.finalUrl).catch(
        () => null
      );
      mergedSessions = mergeExtractedSessions(
        mergeExtractedSessions(mergedSessions, extracted.sessionsJson),
        paginatedData?.sessions ?? null
      );

      let transportResult: {
        transportVariants: DraftTransportVariant[];
        transportPriceDebug: DraftTransportPriceDebug[];
      } = { transportVariants: [], transportPriceDebug: [] };
      let transportError: string | null = null;

      if (params.includePricing) {
        transportResult = await extractTransportVariants(fetched.html, fetched.finalUrl).catch((error) => {
          transportError = error instanceof Error ? error.message : 'unknown-error';
          return { transportVariants: [], transportPriceDebug: [] };
        });
        mergedTransportVariants = mergeTransportVariants(
          mergeTransportVariants(mergedTransportVariants, transportResult.transportVariants),
          paginatedData?.transportVariants ?? []
        );
        mergedTransportPriceDebug.push(...transportResult.transportPriceDebug);
        if (paginatedData?.transportPriceDebug?.length) {
          mergedTransportPriceDebug.push(...paginatedData.transportPriceDebug);
        }
        if ((paginatedData?.transportOptions?.length ?? 0) > (transportOptionsOverride?.length ?? 0)) {
          transportOptionsOverride = paginatedData?.transportOptions ?? null;
        }
      }

      attempts.push({
        stage: 'static',
        candidate_url: candidate.url,
        success: true,
        sessions_found: countUsableSessions(extracted.sessionsJson),
        sessions_from_paginated_table: paginatedData?.sessions.length ?? 0,
        transport_variants_found: transportResult.transportVariants.length,
        transport_variants_from_paginated_table: paginatedData?.transportVariants.length ?? 0,
        transport_options_from_paginated_table: paginatedData?.transportOptions.length ?? 0,
        priced_transport_variants_found: countPricedTransportVariants(transportResult.transportVariants),
        transport_error: transportError
      });
    } catch (error) {
      attempts.push({
        stage: 'static',
        candidate_url: candidate.url,
        success: false,
        error: error instanceof Error ? error.message : 'unknown-error',
        sessions_found: 0,
        transport_variants_found: 0,
        priced_transport_variants_found: 0
      });
    }
  }

  const sessionsStillMissing = countUsableSessions(mergedSessions) === 0;
  const transportStillMissing =
    params.includePricing && countPricedTransportVariants(mergedTransportVariants) === 0;
  const priorityUrl = candidates[0]?.url ?? null;

  if ((sessionsStillMissing || transportStillMissing) && priorityUrl) {
    const snapshot = await withTimeout(
      renderStayPageWithPlaywright(priorityUrl, {
        collectImages: false,
        collectTransport: transportStillMissing,
        collectVideos: false
      }),
      PLAYWRIGHT_RENDER_BUDGET_MS,
      'playwright-render-timeout'
    ).catch((error) => {
      attempts.push({
        stage: 'playwright',
        candidate_url: priorityUrl,
        success: false,
        error: error instanceof Error ? error.message : 'unknown-error',
        sessions_found: 0,
        transport_variants_found: 0,
        priced_transport_variants_found: 0
      });
      return null;
    });

    if (snapshot) {
      const extractedDynamic = extractStayData(snapshot.html, snapshot.finalUrl);
      mergedSessions = mergeExtractedSessions(
        mergeExtractedSessions(mergedSessions, extractedDynamic.sessionsJson),
        snapshot.tableSessionsFromPlaywright
      );
      if (params.includePricing) {
        mergedTransportVariants = mergeTransportVariants(
          mergedTransportVariants,
          snapshot.transportVariants
        );
        mergedTransportPriceDebug.push(...snapshot.transportPriceDebug);
        if (
          snapshot.tableTransportOptionsFromPlaywright.length >
          (transportOptionsOverride?.length ?? 0)
        ) {
          transportOptionsOverride = snapshot.tableTransportOptionsFromPlaywright;
        }
      }
      attempts.push({
        stage: 'playwright',
        candidate_url: snapshot.finalUrl,
        success: true,
        sessions_found: countUsableSessions(extractedDynamic.sessionsJson),
        sessions_from_departure_table: snapshot.tableSessionsFromPlaywright.length,
        transport_variants_found: snapshot.transportVariants.length,
        transport_options_from_departure_table: snapshot.tableTransportOptionsFromPlaywright.length,
        priced_transport_variants_found: countPricedTransportVariants(snapshot.transportVariants),
        browser_engine: snapshot.browserEngine
      });
    }
  }

  const afterSessionCount = countUsableSessions(mergedSessions);
  const afterPricedTransportCount = countPricedTransportVariants(mergedTransportVariants);

  return {
    sessions: mergedSessions,
    transportVariants: mergedTransportVariants,
    transportPriceDebug: mergedTransportPriceDebug,
    transportOptionsOverride,
    debrief: {
      enabled: true,
      triggered: true,
      detected_candidates: candidates.length,
      tested_candidates: attempts.length,
      prioritized_candidates: candidates,
      attempts,
      priority_playwright_url: priorityUrl,
      before: {
        sessions_count: beforeSessionCount,
        priced_transport_count: beforePricedTransportCount
      },
      after: {
        sessions_count: afterSessionCount,
        priced_transport_count: afterPricedTransportCount,
        transport_options_override_count: transportOptionsOverride?.length ?? 0
      },
      improved: {
        sessions: afterSessionCount > beforeSessionCount,
        transport: afterPricedTransportCount > beforePricedTransportCount,
        transport_options: (transportOptionsOverride?.length ?? 0) > 0
      }
    }
  };
}

function parseIsoDateAtUtcMidnight(value: unknown): Date | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null;
  const parsed = new Date(`${trimmed}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) ? parsed : null;
}

function seasonNameFromUtcDate(date: Date): string | null {
  const month = date.getUTCMonth() + 1;
  const day = date.getUTCDate();

  if ((month === 12 && day >= 15) || (month === 1 && day <= 15)) return "Fin d'année";
  if ((month === 1 && day >= 20) || month === 2 || (month === 3 && day <= 15)) return 'Hiver';
  if ((month === 3 && day >= 20) || month === 4 || (month === 5 && day <= 10)) return 'Printemps';
  if ((month === 6 && day >= 20) || month === 7 || month === 8 || (month === 9 && day <= 10)) return 'Été';
  if (month === 10 || (month === 11 && day <= 10)) return 'Toussaint';

  return null;
}

function normalizeSeasonKey(value: string | null | undefined): string {
  const normalized = (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

  if (!normalized) return '';
  if (normalized.includes('fin') && normalized.includes('annee')) return 'fin_annee';
  if (
    normalized.includes('toussaint') ||
    normalized.includes('octobre') ||
    normalized.includes('automne')
  ) {
    return 'toussaint';
  }
  if (normalized.includes('hiver')) return 'hiver';
  if (normalized.includes('printemps')) return 'printemps';
  if (normalized.includes('ete')) return 'ete';
  return normalized;
}

function inferDraftSeasonNamesFromSessions(
  sessions: ReturnType<typeof extractStayData>['sessionsJson']
): string[] {
  if (!Array.isArray(sessions)) return [];
  const required = new Set<string>();

  for (const session of sessions) {
    const start = parseIsoDateAtUtcMidnight(session.start_date);
    const end = parseIsoDateAtUtcMidnight(session.end_date);
    if (!start || !end) continue;

    const cursor = new Date(start.getTime());
    const limit = end.getTime();
    while (cursor.getTime() <= limit) {
      const seasonName = seasonNameFromUtcDate(cursor);
      if (seasonName) required.add(seasonName);
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
  }

  return Array.from(required);
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, timeoutMessage: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error(timeoutMessage));
        }, timeoutMs);
      })
    ]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

type ImportProgressStep =
  | 'created'
  | 'fetching'
  | 'analyzing'
  | 'rendering_dynamic'
  | 'pricing'
  | 'collecting_assets'
  | 'finalizing'
  | 'completed'
  | 'failed';

function buildImportProgress(step: ImportProgressStep, extra?: { error?: string | null }) {
  const updatedAt = new Date().toISOString();

  switch (step) {
    case 'created':
      return {
        step,
        label: 'Brouillon créé',
        percent: 5,
        completed: false,
        updated_at: updatedAt,
        error: null
      };
    case 'fetching':
      return {
        step,
        label: 'Récupération de la page',
        percent: 20,
        completed: false,
        updated_at: updatedAt,
        error: null
      };
    case 'analyzing':
      return {
        step,
        label: 'Analyse du contenu',
        percent: 45,
        completed: false,
        updated_at: updatedAt,
        error: null
      };
    case 'rendering_dynamic':
      return {
        step,
        label: 'Rendu dynamique de la page',
        percent: 60,
        completed: false,
        updated_at: updatedAt,
        error: null
      };
    case 'pricing':
      return {
        step,
        label: 'Lecture des sessions et des prix',
        percent: 72,
        completed: false,
        updated_at: updatedAt,
        error: null
      };
    case 'collecting_assets':
      return {
        step,
        label: 'Sélection des images et transports',
        percent: 84,
        completed: false,
        updated_at: updatedAt,
        error: null
      };
    case 'finalizing':
      return {
        step,
        label: 'Finalisation du brouillon',
        percent: 90,
        completed: false,
        updated_at: updatedAt,
        error: null
      };
    case 'completed':
      return {
        step,
        label: 'Import terminé',
        percent: 100,
        completed: true,
        updated_at: updatedAt,
        error: null
      };
    case 'failed':
      return {
        step,
        label: 'Import interrompu',
        percent: 100,
        completed: true,
        updated_at: updatedAt,
        error: extra?.error ?? null
      };
  }
}

function buildRawPayload(
  html: string,
  fetchedAt: string,
  sourceUrl: string,
  finalUrl: string,
  contentType: string | null,
  status: number,
  extracted: ReturnType<typeof extractStayData>,
  transportVariants: DraftTransportVariant[],
  transportPriceDebug: DraftTransportPriceDebug[],
  videoUrls: string[],
  importOptions?: {
    existingAccommodationId?: string | null;
    existingAccommodationName?: string | null;
    includePricing?: boolean;
  }
) {
  return {
    html,
    fetched_at: fetchedAt,
    source_url: sourceUrl,
    final_url: finalUrl,
    content_type: contentType,
    status_code: status,
    extracted,
    video_urls: videoUrls,
    transport_variants: transportVariants,
    transport_matrix: transportVariants,
    transport_price_debug: transportPriceDebug,
    import_options: {
      existing_accommodation_id: importOptions?.existingAccommodationId ?? null,
      existing_accommodation_name: importOptions?.existingAccommodationName ?? null,
      include_pricing: importOptions?.includePricing ?? true
    }
  };
}

function stripSessionPrices(
  sessions: ReturnType<typeof extractStayData>['sessionsJson']
): ReturnType<typeof extractStayData>['sessionsJson'] {
  if (!Array.isArray(sessions)) return sessions;
  return sessions.map((session) => ({
    ...session,
    price: null
  }));
}

function stripPricingFromExtracted(extracted: ReturnType<typeof extractStayData>) {
  return {
    ...extracted,
    priceFrom: null,
    sessionsJson: stripSessionPrices(extracted.sessionsJson)
  };
}

function mergeExtractedSessions(
  primary: ReturnType<typeof extractStayData>['sessionsJson'],
  secondary: ReturnType<typeof extractStayData>['sessionsJson']
): ReturnType<typeof extractStayData>['sessionsJson'] {
  const rows = [...(primary ?? []), ...(secondary ?? [])];
  if (rows.length === 0) return null;

  const map = new Map<string, (typeof rows)[number]>();
  for (const session of rows) {
    const key = buildStaySessionMergeKey(session);
    if (!key) continue;

    const existing = map.get(key);
    map.set(key, existing ? mergeDraftSessionItems(existing, session) : session);
  }

  return Array.from(map.values()).sort((left, right) => {
    const leftKey = left.start_date ?? left.end_date ?? left.label ?? '';
    const rightKey = right.start_date ?? right.end_date ?? right.label ?? '';
    return leftKey.localeCompare(rightKey, 'fr');
  });
}

function transportVariantScore(variant: DraftTransportVariant): number {
  let score = 0;
  if (typeof variant.amount_cents === 'number') score += 100;
  if (variant.confidence === 'high') score += 30;
  if (variant.confidence === 'medium') score += 20;
  if (variant.confidence === 'low') score += 10;
  return score;
}

function mergeTransportVariants(
  primary: DraftTransportVariant[],
  secondary: DraftTransportVariant[]
): DraftTransportVariant[] {
  const map = new Map<string, DraftTransportVariant>();

  for (const variant of [...primary, ...secondary]) {
    const key = `${variant.departure_city}|${variant.return_city}`.toLowerCase();
    const existing = map.get(key);
    if (!existing || transportVariantScore(variant) > transportVariantScore(existing)) {
      map.set(key, variant);
    }
  }

  return Array.from(map.values()).sort((a, b) =>
    `${a.departure_city}|${a.return_city}`.localeCompare(`${b.departure_city}|${b.return_city}`, 'fr')
  );
}

function buildDraftUpdatePayload(
  columns: Set<string>,
  extracted: ReturnType<typeof extractStayData>,
  rawPayload: ReturnType<typeof buildRawPayload>,
  transportVariants: DraftTransportVariant[],
  includePricing: boolean,
  directTransportOptionsOverride?: Array<Record<string, unknown>> | null
) {
  const payload: Record<string, unknown> = {};

  if (columns.has('title')) payload.title = normalizeStayTitle(extracted.title);
  if (columns.has('description')) payload.description = extracted.description;
  if (columns.has('age_min')) payload.age_min = extracted.ageMin;
  if (columns.has('age_max')) payload.age_max = extracted.ageMax;
  if (columns.has('ages')) {
    const ages = normalizeStayAges([], extracted.ageMin, extracted.ageMax);
    payload.ages = ages.length > 0 ? ages : null;
  }
  if (columns.has('images')) {
    payload.images = extracted.images.length > 0 ? extracted.images : null;
  }
  if (columns.has('image')) {
    payload.image = extracted.images[0] ?? null;
  }
  if (columns.has('source_url')) {
    payload.source_url = rawPayload.source_url;
  }
  if (columns.has('source_url_canonical')) {
    payload.source_url_canonical =
      tryCanonicalizeStaySourceUrl(String(rawPayload.source_url ?? '')) ?? String(rawPayload.source_url ?? '');
  }
  if (columns.has('raw_text')) {
    payload.raw_text = extracted.rawText;
  }
  if (columns.has('raw_payload')) {
    payload.raw_payload = rawPayload;
  }
  if (columns.has('sessions_json')) {
    payload.sessions_json = extracted.sessionsJson && extracted.sessionsJson.length > 0
      ? extracted.sessionsJson
      : null;
  }
  if (columns.has('accommodations_json')) {
    payload.accommodations_json = extracted.accommodationsJson ?? null;
  }
  if (columns.has('transport_mode')) {
    payload.transport_mode = extracted.transportMode ?? null;
  }
  if (columns.has('transport_options_json')) {
    const transportOptions = includePricing
      ? directTransportOptionsOverride ?? buildDraftTransportOptionsFromVariants(transportVariants)
      : [];
    payload.transport_options_json = transportOptions.length > 0 ? transportOptions : null;
  }
  if (columns.has('status')) {
    payload.status = 'pending';
  }

  return payload;
}

function asRecordArray(value: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(value)) {
    return value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object');
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (Array.isArray(parsed)) {
        return parsed.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object');
      }
    } catch {
      return [];
    }
  }
  return [];
}

function buildSessionSignature(rows: Array<Record<string, unknown>>): string {
  return rows
    .map((row) =>
      [
        String(row.start_date ?? ''),
        String(row.end_date ?? ''),
        String(row.price ?? ''),
        String(row.availability ?? '')
      ].join('|')
    )
    .sort((a, b) => a.localeCompare(b, 'fr'))
    .join('||');
}

async function updateDraftWithFallbacks(draftId: string, payload: Record<string, unknown>) {
  const supabase = getServerSupabaseClient();

  const attempts: Record<string, unknown>[] = [];
  const baseAttempt = { ...payload };
  attempts.push(baseAttempt);

  const stringifiedAttempt = { ...payload };
  let hasStringifiedFallback = false;
  const maybeComplexKeys = [
    'activities',
    'images',
    'sessions_json',
    'extra_options_json',
    'transport_options_json',
    'accommodations_json',
    'raw_payload'
  ];
  for (const key of maybeComplexKeys) {
    const value = stringifiedAttempt[key];
    if (Array.isArray(value)) {
      stringifiedAttempt[key] =
        key === 'activities' ? value.join(' | ') || null : JSON.stringify(value);
      hasStringifiedFallback = true;
      continue;
    }
    if (value && typeof value === 'object') {
      stringifiedAttempt[key] = JSON.stringify(value);
      hasStringifiedFallback = true;
    }
  }
  if (hasStringifiedFallback) {
    attempts.push(stringifiedAttempt);
  }

  const strippedAttempt = { ...payload };
  delete strippedAttempt.activities;
  delete strippedAttempt.images;
  delete strippedAttempt.sessions_json;
  delete strippedAttempt.transport_options_json;
  delete strippedAttempt.accommodations_json;
  if (Object.keys(strippedAttempt).length > 0) {
    attempts.push(strippedAttempt);
  }

  let lastError: { message: string } | null = null;
  for (const attempt of attempts) {
    const { error } = await supabase.from('stay_drafts').update(attempt).eq('id', draftId);

    if (!error) return null;
    lastError = error;
  }

  return lastError;
}

async function updateDraftCriticalJsonFields(
  draftId: string,
  payload: {
    sessions_json?: Record<string, unknown>[] | null;
    transport_options_json?: Array<Record<string, unknown>> | null;
  }
) {
  const supabase = getServerSupabaseClient();
  const { error } = await supabase
    .from('stay_drafts')
    .update({
      sessions_json: (payload.sessions_json ?? null) as Json,
      transport_options_json: (payload.transport_options_json ?? null) as Json
    })
    .eq('id', draftId);
  return error ?? null;
}

async function mergeRawPayloadError(
  draftId: string,
  patch: Record<string, unknown>
): Promise<void> {
  const supabase = getServerSupabaseClient();
  const { data: row } = await supabase.from('stay_drafts').select('raw_payload').eq('id', draftId).maybeSingle();
  const base =
    row?.raw_payload && typeof row.raw_payload === 'object' && !Array.isArray(row.raw_payload)
      ? { ...(row.raw_payload as Record<string, unknown>) }
      : {};
  await supabase
    .from('stay_drafts')
    .update({
      raw_payload: { ...base, ...patch } as Json
    })
    .eq('id', draftId);
}

async function mergeRawPayloadPatch(
  draftId: string,
  patch: Record<string, unknown>
): Promise<void> {
  await mergeRawPayloadError(draftId, patch);
}

/**
 * Import lourd (fetch, Playwright, Thalie…) — à lancer via `after()` pour ne pas bloquer la réponse HTTP.
 */
export async function runStayImportInBackground(params: {
  draftId: string;
  sourceUrl: string;
  selectedOrganizerId: string;
  selectedAccommodation: { id: string; name: string } | null;
  includePricing: boolean;
  draftColumnKeys: string[];
}): Promise<void> {
  const draftColumns = new Set(params.draftColumnKeys);
  const { draftId, sourceUrl, selectedOrganizerId, selectedAccommodation, includePricing } = params;
  const supabase = getServerSupabaseClient();

  try {
    await mergeRawPayloadPatch(draftId, {
      import_progress: buildImportProgress('fetching')
    });

    let fetchedHtml: Awaited<ReturnType<typeof fetchHtml>>;
    try {
      fetchedHtml = await fetchHtml(sourceUrl);
    } catch (error) {
      const fetchErrorMessage =
        error instanceof Error ? error.message : 'Impossible de récupérer la page source.';

      if (draftColumns.has('raw_payload')) {
        await supabase
          .from('stay_drafts')
          .update({
            raw_payload: {
              source_url: sourceUrl,
              fetch_error: fetchErrorMessage,
              fetched_at: new Date().toISOString(),
              import_progress: buildImportProgress('failed', { error: fetchErrorMessage })
            }
          })
          .eq('id', draftId);
      }
      return;
    }

    await mergeRawPayloadPatch(draftId, {
      import_progress: buildImportProgress('analyzing')
    });

    const extracted = extractStayData(fetchedHtml.html, fetchedHtml.finalUrl);
    let sourceHost: string | null = null;
    try {
      sourceHost = new URL(fetchedHtml.finalUrl || sourceUrl).hostname.toLowerCase();
    } catch {
      sourceHost = null;
    }
    const isThalieImport = Boolean(sourceHost?.includes('thalie.eu'));
    const isColosBonheurImport = Boolean(sourceHost?.includes('colosdubonheur.fr'));
    const isZigotoursImport = Boolean(sourceHost?.includes('zigotours.com'));
    const forcePlaywright = envTruthy(process.env.IMPORT_STAY_FORCE_PLAYWRIGHT);
    const needsDynamicImages = shouldUsePlaywrightForDynamicImages(fetchedHtml.html, extracted.images.length);
    const needsDynamicSessions = shouldUsePlaywrightForDynamicSessions(fetchedHtml.html);
    const needsDynamicTransport = includePricing
      ? shouldUsePlaywrightForDynamicTransport(fetchedHtml.html)
      : false;
    const shouldTryDynamicRender =
      forcePlaywright ||
      needsDynamicImages ||
      needsDynamicSessions ||
      needsDynamicTransport;

    await mergeRawPayloadPatch(draftId, {
      import_progress: buildImportProgress(shouldTryDynamicRender ? 'rendering_dynamic' : 'pricing')
    });

    let playwrightFailureMessage: string | null = null;
    const dynamicSnapshot = shouldTryDynamicRender
      ? await withTimeout(
          renderStayPageWithPlaywright(fetchedHtml.finalUrl, {
            collectImages: forcePlaywright || needsDynamicImages,
            collectTransport: forcePlaywright || needsDynamicTransport,
            collectVideos: true
          }),
          PLAYWRIGHT_RENDER_BUDGET_MS,
          'playwright-render-timeout'
        ).catch((error) => {
          playwrightFailureMessage = error instanceof Error ? error.message : 'unknown-error';
          console.warn('[import-stay] Playwright snapshot failed', {
            sourceUrl: fetchedHtml.finalUrl,
            error: playwrightFailureMessage
          });
          return null;
        })
      : null;
    const effectiveHtml = dynamicSnapshot?.html || fetchedHtml.html;
    const effectiveFinalUrl = dynamicSnapshot?.finalUrl || fetchedHtml.finalUrl;

    await mergeRawPayloadPatch(draftId, {
      import_progress: buildImportProgress('pricing')
    });

    const extractedWithDynamicDom =
      dynamicSnapshot && dynamicSnapshot.html
        ? extractStayData(dynamicSnapshot.html, dynamicSnapshot.finalUrl)
        : extracted;
    const thaliePricing = includePricing && isThalieImport
      ? await extractThalieOptionUrlPricing(fetchedHtml.html, fetchedHtml.finalUrl).catch((error) => {
          console.warn('[import-stay] Thalie option-url pricing failed', {
            sourceUrl: fetchedHtml.finalUrl,
            error: error instanceof Error ? error.message : 'unknown-error'
          });
          return null;
        })
      : null;
    const ceslStructuredBooking = includePricing && sourceHost?.includes('cesl.fr')
      ? extractCeslStructuredBookingData(fetchedHtml.html, fetchedHtml.finalUrl)
      : null;
    const paginatedDepartureTableData = await fetchPaginatedDepartureTableData(
      fetchedHtml.html,
      fetchedHtml.finalUrl
    ).catch(() => null);
    const mergedStaticAndDomSessions = mergeExtractedSessions(
      extracted.sessionsJson,
      extractedWithDynamicDom.sessionsJson
    );
    const mergedWithCeslPlaywrightSessions = mergeExtractedSessions(
      mergedStaticAndDomSessions,
      dynamicSnapshot?.ceslSessionsFromPlaywright ?? null
    );
    const mergedWithPlaywrightTableSessions = mergeExtractedSessions(
      mergedWithCeslPlaywrightSessions,
      dynamicSnapshot?.tableSessionsFromPlaywright ?? null
    );
    const mergedWithAjaxDepartureTableSessions = mergeExtractedSessions(
      mergedWithPlaywrightTableSessions,
      paginatedDepartureTableData?.sessions ?? null
    );
    const extractedAfterThalieSessions = {
      ...extractedWithDynamicDom,
      transportMode: thaliePricing?.transportMode || extractedWithDynamicDom.transportMode,
      sessionsJson:
        mergeThalieSessionBaselinesIntoSessions(
          ceslStructuredBooking?.sessions.length
            ? mergeExtractedSessions(mergedWithAjaxDepartureTableSessions, ceslStructuredBooking.sessions)
            : mergedWithAjaxDepartureTableSessions,
          thaliePricing?.sessionBaselines ?? dynamicSnapshot?.thalieSessionBaselines ?? []
        ) ??
        (ceslStructuredBooking?.sessions.length
          ? mergeExtractedSessions(mergedWithAjaxDepartureTableSessions, ceslStructuredBooking.sessions)
          : mergedWithAjaxDepartureTableSessions),
      priceFrom:
        ceslStructuredBooking?.priceFrom ??
        paginatedDepartureTableData?.priceFrom ??
        extractedWithDynamicDom.priceFrom
    };
    const mergedExtractedImages = Array.from(
      new Set([
        ...extracted.images,
        ...extractedWithDynamicDom.images,
        ...(dynamicSnapshot?.imageUrls ?? [])
      ])
    );
    const mergedVideoUrls = Array.from(
      new Set([
        ...extractVideoUrls(fetchedHtml.html, fetchedHtml.finalUrl),
        ...(dynamicSnapshot?.videoUrls ?? [])
      ])
    );

    await mergeRawPayloadPatch(draftId, {
      import_progress: buildImportProgress('collecting_assets')
    });

    const [selectedImages, staticTransportExtraction, effectiveTransportExtraction] = await Promise.all([
      selectBestStayImages(effectiveHtml, effectiveFinalUrl, mergedExtractedImages, {
        title: extractedAfterThalieSessions.title,
        description: extractedAfterThalieSessions.description,
        summary: extractedAfterThalieSessions.summary,
        locationText: extractedAfterThalieSessions.locationText,
        regionText: extractedAfterThalieSessions.regionText,
        activities: extractedAfterThalieSessions.activities
      }),
      includePricing
        ? extractTransportVariants(fetchedHtml.html, fetchedHtml.finalUrl)
        : Promise.resolve({ transportVariants: [], transportPriceDebug: [] }),
      includePricing
        ? (
            effectiveHtml === fetchedHtml.html && effectiveFinalUrl === fetchedHtml.finalUrl
              ? Promise.resolve({ transportVariants: [], transportPriceDebug: [] })
              : extractTransportVariants(effectiveHtml, effectiveFinalUrl)
          )
        : Promise.resolve({ transportVariants: [], transportPriceDebug: [] })
    ]);
    const extractedWithSmartImages = {
      ...extractedAfterThalieSessions,
      images:
        selectedImages.length > 0
          ? selectedImages
          : mergedExtractedImages.length > 0
            ? mergedExtractedImages
            : extractedAfterThalieSessions.images
    };
    const extractedWithCeslStructuredOverride = ceslStructuredBooking
      ? {
          ...extractedWithSmartImages,
          sessionsJson: ceslStructuredBooking.sessions,
          priceFrom: ceslStructuredBooking.priceFrom ?? extractedWithSmartImages.priceFrom
        }
      : extractedWithSmartImages;
    let extractedForDraft = includePricing
      ? extractedWithCeslStructuredOverride
      : stripPricingFromExtracted(extractedWithCeslStructuredOverride);
    const thaliePricingFromOptionUrls = Boolean(thaliePricing);
    const thaliePbpFromPlaywright =
      !thaliePricingFromOptionUrls && (dynamicSnapshot?.thalieSessionBaselines?.length ?? 0) > 0;
    let transportVariants = includePricing
      ? mergeTransportVariants(
          thaliePricing?.transportVariants ??
            paginatedDepartureTableData?.transportVariants ??
            dynamicSnapshot?.transportVariants ??
            [],
          thaliePricingFromOptionUrls || thaliePbpFromPlaywright
            ? []
            : mergeTransportVariants(
                staticTransportExtraction.transportVariants,
                effectiveTransportExtraction.transportVariants
              )
        )
      : [];
    let transportPriceDebug = includePricing
      ? [
          ...(
            thaliePricing?.transportPriceDebug ??
            paginatedDepartureTableData?.transportPriceDebug ??
            dynamicSnapshot?.transportPriceDebug ??
            []
          ),
          ...(thaliePricingFromOptionUrls || thaliePbpFromPlaywright
            ? []
            : [
                ...staticTransportExtraction.transportPriceDebug,
                ...effectiveTransportExtraction.transportPriceDebug
              ])
        ]
      : [];
    let zigotoursFallbackDebrief: Record<string, unknown> | null = null;
    let zigotoursTransportOptionsOverride: Array<Record<string, unknown>> | null = null;
    if (isZigotoursImport) {
      const sessionsMissing = countUsableSessions(extractedForDraft.sessionsJson) === 0;
      const datedSessionsMissing = countDatedSessions(extractedForDraft.sessionsJson) === 0;
      const transportMissing = includePricing && countPricedTransportVariants(transportVariants) === 0;
      if (sessionsMissing || datedSessionsMissing || transportMissing) {
        const fallbackResult = await runZigotoursFallback({
          html: effectiveHtml,
          pageUrl: effectiveFinalUrl,
          includePricing,
          baseSessions: extractedForDraft.sessionsJson,
          baseTransportVariants: transportVariants
        });
        const improvedSessions = Boolean(
          (fallbackResult.debrief.improved as Record<string, unknown>)?.sessions
        );
        const improvedTransport = Boolean(
          (fallbackResult.debrief.improved as Record<string, unknown>)?.transport
        );

        if (improvedSessions) {
          extractedForDraft = {
            ...extractedForDraft,
            sessionsJson: fallbackResult.sessions
          };
        }
        if (improvedTransport) {
          transportVariants = fallbackResult.transportVariants;
          transportPriceDebug = [...transportPriceDebug, ...fallbackResult.transportPriceDebug];
        }
        if ((fallbackResult.transportOptionsOverride?.length ?? 0) > 0) {
          zigotoursTransportOptionsOverride = fallbackResult.transportOptionsOverride;
        }
        zigotoursFallbackDebrief = fallbackResult.debrief;
      } else {
        zigotoursFallbackDebrief = {
          enabled: true,
          triggered: false,
          reason: 'base-import-already-had-dated-sessions-and-transport-pricing',
          before: {
            sessions_count: countUsableSessions(extractedForDraft.sessionsJson),
            dated_sessions_count: countDatedSessions(extractedForDraft.sessionsJson),
            priced_transport_count: countPricedTransportVariants(transportVariants)
          }
        };
      }
    }

    let colosFallbackDebrief: Record<string, unknown> | null = null;
    let colosTransportOptionsOverride: Array<Record<string, unknown>> | null = null;
    if (isColosBonheurImport) {
      const sessionsMissing = countUsableSessions(extractedForDraft.sessionsJson) === 0;
      const transportMissing = includePricing && countPricedTransportVariants(transportVariants) === 0;
      if (sessionsMissing || transportMissing) {
        const fallbackResult = await runColosBonheurFallback({
          html: effectiveHtml,
          pageUrl: effectiveFinalUrl,
          includePricing,
          baseSessions: extractedForDraft.sessionsJson,
          baseTransportVariants: transportVariants
        });
        const improvedSessions = Boolean(
          (fallbackResult.debrief.improved as Record<string, unknown>)?.sessions
        );
        const improvedTransport = Boolean(
          (fallbackResult.debrief.improved as Record<string, unknown>)?.transport
        );

        if (improvedSessions) {
          extractedForDraft = {
            ...extractedForDraft,
            sessionsJson: fallbackResult.sessions
          };
        }
        if (improvedTransport) {
          transportVariants = fallbackResult.transportVariants;
          transportPriceDebug = [...transportPriceDebug, ...fallbackResult.transportPriceDebug];
        }
        if ((fallbackResult.transportOptionsOverride?.length ?? 0) > 0) {
          colosTransportOptionsOverride = fallbackResult.transportOptionsOverride;
        }
        colosFallbackDebrief = fallbackResult.debrief;
      } else {
        colosFallbackDebrief = {
          enabled: true,
          triggered: false,
          reason: 'base-import-already-had-sessions-and-transport-pricing',
          before: {
            sessions_count: countUsableSessions(extractedForDraft.sessionsJson),
            priced_transport_count: countPricedTransportVariants(transportVariants)
          }
        };
      }
    }

    const sessionsStillMissingAfterFallback = countUsableSessions(extractedForDraft.sessionsJson) === 0;
    const transportStillMissingAfterFallback =
      includePricing && countPricedTransportVariants(transportVariants) === 0;
    const shouldWarnOnPartialImport = isColosBonheurImport || isZigotoursImport;
    const importWarning =
      shouldWarnOnPartialImport && (sessionsStillMissingAfterFallback || transportStillMissingAfterFallback)
        ? sessionsStillMissingAfterFallback && transportStillMissingAfterFallback
          ? "Import partiel: impossible d'extraire des sessions et des tarifs de transport fiables. Vérifiez la source de réservation/tarifs puis complétez manuellement."
          : sessionsStillMissingAfterFallback
            ? "Import partiel: impossible d'extraire des sessions fiables. Vérifiez la source de réservation/tarifs puis complétez manuellement."
            : "Import partiel: impossible d'extraire des tarifs de transport fiables. Vérifiez la source de réservation/tarifs puis complétez manuellement."
        : null;
    const inferredDraftSeasonNames = inferDraftSeasonNamesFromSessions(extractedForDraft.sessionsJson);
    const { data: seasonsRaw } = inferredDraftSeasonNames.length
      ? await supabase.from('seasons').select('id,name')
      : { data: [] as Array<{ id: string; name: string }> };
    const inferredDraftSeasonIds = (seasonsRaw ?? [])
      .filter((season) =>
        inferredDraftSeasonNames.some(
          (seasonName) => normalizeSeasonKey(seasonName) === normalizeSeasonKey(season.name)
        )
      )
      .map((season) => season.id);

    const rawPayload = buildRawPayload(
      effectiveHtml,
      fetchedHtml.fetchedAt,
      sourceUrl,
      effectiveFinalUrl,
      fetchedHtml.contentType,
      fetchedHtml.status,
      extractedForDraft,
      transportVariants,
      transportPriceDebug,
      mergedVideoUrls,
      {
        existingAccommodationId: selectedAccommodation?.id ?? null,
        existingAccommodationName: selectedAccommodation?.name ?? null,
        includePricing
      }
    );
    Object.assign(rawPayload, {
      draft_season_names: inferredDraftSeasonNames,
      draft_season_ids: inferredDraftSeasonIds
    });
    if (importWarning) {
      Object.assign(rawPayload, {
        import_warning: importWarning
      });
    }
    const traceDirConfigured = Boolean(process.env.PLAYWRIGHT_TRACE_DIR?.trim());
    const videoDirConfigured = Boolean(process.env.PLAYWRIGHT_IMPORT_VIDEO_DIR?.trim());

    const importReviewDebrief = {
      schema: 'import_review_debrief/v1',
      built_at: new Date().toISOString(),
      source_request_url: sourceUrl,
      source_host: sourceHost,
      session_price_extraction: {
        price_from_eur_static: extracted.priceFrom,
        price_from_eur_after_dynamic_dom: extractedWithDynamicDom.priceFrom,
        price_from_eur_cesl_structured: ceslStructuredBooking?.priceFrom ?? null,
        pick_reference_cents_static: pickImportedSessionReferencePriceCents(extracted),
        pick_reference_cents_after_dynamic_dom: pickImportedSessionReferencePriceCents(
          extractedAfterThalieSessions
        ),
        cesl_structured_booking:
          ceslStructuredBooking
            ? {
                session_count: ceslStructuredBooking.sessions.length,
                transport_option_count: ceslStructuredBooking.transportOptions.length,
                sessions: ceslStructuredBooking.sessions.map((session) => ({
                  label: session.label,
                  start_date: session.start_date,
                  end_date: session.end_date,
                  price: session.price,
                  availability: session.availability
                }))
              }
            : null,
        thalie_session_baselines_from_option_urls_eur:
          thaliePricing?.sessionBaselines?.map((b) => ({
            date_label: b.date_label,
            baseline_total_eur:
              b.baseline_total_cents != null && Number.isFinite(b.baseline_total_cents)
                ? Math.round(b.baseline_total_cents) / 100
                : null
          })) ?? null,
        thalie_session_baselines_from_playwright_eur:
          dynamicSnapshot?.thalieSessionBaselines?.map((b) => ({
            date_label: b.date_label,
            baseline_total_eur:
              b.baseline_total_cents != null && Number.isFinite(b.baseline_total_cents)
                ? Math.round(b.baseline_total_cents) / 100
                : null
          })) ?? null,
        json_ld_offer_prices_eur_sorted_static: extractJsonLdOfferPricesFromHtml(fetchedHtml.html),
        json_ld_offer_prices_eur_sorted_effective: extractJsonLdOfferPricesFromHtml(effectiveHtml),
        note:
          'Si plusieurs tarifs session dans sessionsJson : pas de référence unique (pick null). Sinon priorité aux prix session puis priceFrom (min JSON-LD). Pour Thalie, priorité au parcours statique par URLs d’options (dates puis villes aller), avec prix session = Dépose centre / Reprise centre et transport global = aller x 2.'
      },
      paginated_departure_table: dynamicSnapshot?.tableDepartureRowCount
        ? {
            detected: true,
            row_count:
              paginatedDepartureTableData?.rowCount ?? dynamicSnapshot.tableDepartureRowCount,
            session_count:
              paginatedDepartureTableData?.sessions.length ??
              dynamicSnapshot.tableSessionsFromPlaywright.length,
            transport_option_count:
              paginatedDepartureTableData?.transportOptions.length ??
              dynamicSnapshot.tableTransportOptionsFromPlaywright.length,
            note:
              'Tableau #tableSejour : prix session lu sur la ligne SUR PLACE, supplément transport calculé par delta ville - SUR PLACE pour la même session.'
          }
        : {
            detected: Boolean(paginatedDepartureTableData),
            row_count: paginatedDepartureTableData?.rowCount ?? 0,
            session_count: paginatedDepartureTableData?.sessions.length ?? 0,
            transport_option_count: paginatedDepartureTableData?.transportOptions.length ?? 0
          },
      session_collection: {
        needs_dynamic_sessions: needsDynamicSessions,
        sessions_from_paginated_table:
          paginatedDepartureTableData?.sessions.length ??
          dynamicSnapshot?.tableSessionsFromPlaywright.length ??
          0
      },
      playwright_how_to_debug: {
        trace_zip_ui: traceDirConfigured
          ? `Trace activée (PLAYWRIGHT_TRACE_DIR). Ouvrir le .zip avec : npx playwright show-trace <fichier.zip> — relecture action par action, captures, DOM.`
          : 'Pour un « écran » rejeu : exporter PLAYWRIGHT_TRACE_DIR=/un/dossier avant import, puis npx playwright show-trace sur le .zip généré.',
        headed_window:
          'IMPORT_STAY_PLAYWRIGHT_HEADED=1 : navigateur réel visible pendant l’import.',
        slow_mo: 'PLAYWRIGHT_SLOW_MO_MS=400 : ralentit les actions.',
        video_mp4: videoDirConfigured
          ? 'PLAYWRIGHT_IMPORT_VIDEO_DIR : vidéo MP4 enregistrée pour ce run.'
          : 'PLAYWRIGHT_IMPORT_VIDEO_DIR=/un/dossier : enregistre une vidéo MP4 de la page (si supporté).',
        server_logs: 'PLAYWRIGHT_VERBOSE_IMPORT=1 : détails dans les logs serveur Next.',
        inspector:
          'PWDEBUG=1 (avec next dev) : inspecteur Playwright, exécution pas à pas sur le premier await.'
      },
      static_fetch: {
        final_url: fetchedHtml.finalUrl,
        fetched_at: fetchedHtml.fetchedAt,
        status_code: fetchedHtml.status,
        content_type: fetchedHtml.contentType,
        html_length_chars: fetchedHtml.html.length,
        extracted_after_static_dom: {
          title: extracted.title ?? null,
          image_count: extracted.images.length
        }
      },
      effective_after_processing: {
        final_url: effectiveFinalUrl,
        html_length_chars: effectiveHtml.length,
        merged_candidate_image_count: mergedExtractedImages.length,
        selected_images_after_scoring: selectedImages.length,
        video_url_count: mergedVideoUrls.length,
        transport_variant_count: transportVariants.length,
        transport_price_debug_count: transportPriceDebug.length
      },
      playwright: !shouldTryDynamicRender
        ? { attempted: false, reason: 'skipped_static_html_sufficient_or_heuristic' }
        : dynamicSnapshot
          ? {
              attempted: true,
              success: true,
              browser_engine: dynamicSnapshot.browserEngine,
              snapshot_final_url: dynamicSnapshot.finalUrl,
              snapshot_html_length_chars: dynamicSnapshot.html.length,
              dom_image_urls_found: dynamicSnapshot.imageUrls.length,
              dom_video_urls_found: dynamicSnapshot.videoUrls.length,
              transport_variants_from_playwright: dynamicSnapshot.transportVariants.length,
              transport_detected_flag: dynamicSnapshot.transportDetected,
              ignored_for_thalie_transport: thaliePricingFromOptionUrls,
              force_playwright_flag: forcePlaywright
            }
          : {
              attempted: true,
              success: false,
              error_message: playwrightFailureMessage,
              force_playwright_flag: forcePlaywright
            }
    };
    if (zigotoursFallbackDebrief) {
      Object.assign(importReviewDebrief, {
        zigotours_fallback: zigotoursFallbackDebrief
      });
    }
    if (colosFallbackDebrief) {
      Object.assign(importReviewDebrief, {
        colos_fallback: colosFallbackDebrief
      });
    }

    Object.assign(rawPayload, {
      import_review_debrief: importReviewDebrief
    });
    if (dynamicSnapshot) {
      Object.assign(rawPayload, {
        playwright: {
          browser_engine: dynamicSnapshot.browserEngine,
          final_url: dynamicSnapshot.finalUrl,
          image_count: dynamicSnapshot.imageUrls.length,
          video_count: dynamicSnapshot.videoUrls.length,
          used_for_dynamic_images: true,
          used_for_dynamic_transport:
            dynamicSnapshot.transportDetected || dynamicSnapshot.transportVariants.length > 0,
          transport_variant_count: dynamicSnapshot.transportVariants.length,
          force_playwright: forcePlaywright
        }
      });
    }

    Object.assign(rawPayload, {
      import_progress: buildImportProgress('finalizing')
    });

    const updatePayload = buildDraftUpdatePayload(
      draftColumns,
      extractedForDraft,
      rawPayload,
      transportVariants,
      includePricing,
      ceslStructuredBooking?.transportOptions ??
        (paginatedDepartureTableData?.transportOptions.length
          ? paginatedDepartureTableData.transportOptions
          : null) ??
        zigotoursTransportOptionsOverride ??
        (dynamicSnapshot?.tableTransportOptionsFromPlaywright.length
          ? dynamicSnapshot.tableTransportOptionsFromPlaywright
          : null) ??
        colosTransportOptionsOverride ??
        null
    );
    const updateError = await updateDraftWithFallbacks(draftId, updatePayload);

    if (updateError) {
      console.error('[import-stay] updateDraftWithFallbacks failed', updateError);
      await mergeRawPayloadError(draftId, {
        import_update_error: updateError.message ?? 'Impossible de mettre à jour le brouillon.',
        import_update_failed_at: new Date().toISOString(),
        import_progress: buildImportProgress('failed', {
          error: updateError.message ?? 'Impossible de mettre à jour le brouillon.'
        })
      });
    } else {
      if (ceslStructuredBooking) {
        const expectedSessions = ceslStructuredBooking.sessions as Array<Record<string, unknown>>;
        const expectedTransportOptions =
          ceslStructuredBooking.transportOptions as Array<Record<string, unknown>>;

        const criticalUpdateError = await updateDraftCriticalJsonFields(draftId, {
          sessions_json: expectedSessions,
          transport_options_json: expectedTransportOptions
        });

        if (criticalUpdateError) {
          console.error('[import-stay] CESL critical JSON update failed', {
            draftId,
            error: criticalUpdateError.message
          });
          await mergeRawPayloadPatch(draftId, {
            cesl_structured_repair_failed_at: new Date().toISOString(),
            cesl_structured_repair_error: criticalUpdateError.message
          });
        } else {
          await mergeRawPayloadPatch(draftId, {
            cesl_structured_repair_applied_at: new Date().toISOString()
          });
          const { data: afterImportRow } = await supabase
            .from('stay_drafts')
            .select('sessions_json')
            .eq('id', draftId)
            .maybeSingle();
          const currentSessions = asRecordArray(afterImportRow?.sessions_json ?? null);
          console.info('[import-stay] CESL critical JSON update applied', {
            draftId,
            expectedSessionCount: expectedSessions.length,
            storedSessionCount: currentSessions.length,
            storedMatchesExpected:
              buildSessionSignature(currentSessions) === buildSessionSignature(expectedSessions)
          });
        }
      }

      await mergeRawPayloadPatch(draftId, {
        import_progress: buildImportProgress('completed')
      });
      console.info('[import-stay] background import terminé', { draftId, organizerId: selectedOrganizerId });
    }
  } catch (fatal) {
    const message = fatal instanceof Error ? fatal.message : 'Erreur inconnue';
    console.error('[import-stay] background import exception', { draftId, message, fatal });
    await mergeRawPayloadError(draftId, {
      import_fatal_error: message,
      import_fatal_at: new Date().toISOString(),
      import_progress: buildImportProgress('failed', { error: message })
    });
  }
}
