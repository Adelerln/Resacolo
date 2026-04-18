import Link from 'next/link';
import { redirect } from 'next/navigation';
import DraftImportStatusBanner from '@/components/organisme/DraftImportStatusBanner';
import StayDraftReviewForm from '@/components/organisme/StayDraftReviewForm';
import { requireRole } from '@/lib/auth/require';
import { resolveOrganizerSelection, withOrganizerQuery } from '@/lib/organizers.server';
import { normalizeStayDraftCategories } from '@/lib/stay-categories';
import { extractVideoUrls } from '@/lib/stay-draft-import';
import {
  buildDraftTransportOptionsFromVariants,
  collapseTransportDraftOptionsJson,
  type TransportVariantForDraft
} from '@/lib/stay-draft-transport-display';
import {
  normalizeImportedImageUrlList,
  normalizeImportedVideoUrlList
} from '@/lib/stay-draft-url-extract';
import { getServerSupabaseClient } from '@/lib/supabase/server';
import type { Json } from '@/types/supabase';
import type { StayDraftReviewPayload } from '@/types/stay-draft-review';

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{
    organizerId?: string | string[];
    importPending?: string | string[];
  }>;
};

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type LinkedAccommodationSummary = {
  id: string;
  name: string;
  accommodationType: string | null;
};

type DraftSeasonOption = {
  id: string;
  name: string;
};

const SEASON_ORDER = ['Hiver', 'Printemps', 'Été', 'Automne', 'Toussaint', "Fin d'année"];

function normalizeString(value: string | null | undefined): string {
  return value?.trim() ?? '';
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function asObject(value: Json | null): Record<string, unknown> {
  if (isPlainRecord(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (isPlainRecord(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return {};
    }
  }
  return {};
}

function asArrayOfObjects(value: Json | null): Array<Record<string, unknown>> {
  if (Array.isArray(value)) {
    return value.filter((item) => isPlainRecord(item));
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (Array.isArray(parsed)) {
        return parsed.filter((item) => isPlainRecord(item));
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

function asRecordArray(value: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(value)) {
    return value.filter((item): item is Record<string, unknown> => isPlainRecord(item));
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (Array.isArray(parsed)) {
        return parsed.filter((item): item is Record<string, unknown> => isPlainRecord(item));
      }
    } catch {
      return [];
    }
  }
  return [];
}

function countPricedTransportOptions(rows: Array<Record<string, unknown>>): number {
  return rows.filter((row) => {
    if (typeof row.amount_cents === 'number' && Number.isFinite(row.amount_cents)) return true;
    if (typeof row.price === 'number' && Number.isFinite(row.price)) return true;
    if (typeof row.price === 'string' && row.price.trim().length > 0) {
      const parsed = Number(row.price.trim().replace(',', '.'));
      return Number.isFinite(parsed);
    }
    return false;
  }).length;
}

function inferDraftSeasonName(sessions: Array<Record<string, unknown>>): string {
  if (sessions.length === 0) return '';

  const counts = new Map<string, number>();
  for (const session of sessions) {
    const rawStartDate = typeof session.start_date === 'string' ? session.start_date.trim() : '';
    if (!rawStartDate) continue;
    const parsed = new Date(`${rawStartDate}T00:00:00Z`);
    if (!Number.isFinite(parsed.getTime())) continue;
    const month = parsed.getUTCMonth() + 1;
    const season =
      month === 10
        ? 'Toussaint'
        : month >= 12 || month <= 2
          ? 'Hiver'
          : month >= 3 && month <= 5
            ? 'Printemps'
            : month >= 6 && month <= 8
              ? 'Été'
              : 'Automne';
    counts.set(season, (counts.get(season) ?? 0) + 1);
  }

  const ranked = Array.from(counts.entries()).sort((left, right) => {
    if (left[1] !== right[1]) return right[1] - left[1];
    return left[0].localeCompare(right[0], 'fr');
  });

  return ranked[0]?.[0] ?? '';
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

function readDraftSeasonIds(rawPayload: Record<string, unknown>): string[] {
  const raw = rawPayload.draft_season_ids;
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean);
}

function readDraftSeasonNames(rawPayload: Record<string, unknown>): string[] {
  const raw = rawPayload.draft_season_names;
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean);
}

function toTransportVariant(record: Record<string, unknown>): TransportVariantForDraft | null {
  const departureCity = String(record.departure_city ?? '').trim();
  const returnCity = String(record.return_city ?? departureCity).trim() || departureCity;
  const amountCents =
    typeof record.amount_cents === 'number' && Number.isFinite(record.amount_cents)
      ? Math.round(record.amount_cents)
      : typeof record.price === 'number' && Number.isFinite(record.price)
        ? Math.round(record.price * 100)
        : null;

  if (!departureCity || amountCents === null) return null;

  return {
    departure_city: departureCity,
    return_city: returnCity,
    amount_cents: amountCents,
    currency: 'EUR',
    source_url: typeof record.source_url === 'string' ? record.source_url : undefined,
    departure_label_raw:
      typeof record.departure_label_raw === 'string' ? record.departure_label_raw : null,
    return_label_raw: typeof record.return_label_raw === 'string' ? record.return_label_raw : null,
    page_price_cents:
      typeof record.page_price_cents === 'number' && Number.isFinite(record.page_price_cents)
        ? Math.round(record.page_price_cents)
        : null,
    base_price_cents:
      typeof record.base_price_cents === 'number' && Number.isFinite(record.base_price_cents)
        ? Math.round(record.base_price_cents)
        : null,
    pricing_method: record.pricing_method as TransportVariantForDraft['pricing_method'] | undefined,
    confidence: record.confidence as TransportVariantForDraft['confidence'] | undefined,
    reason: typeof record.reason === 'string' ? record.reason : undefined
  };
}

function recoverImportedTransportOptions(rawPayload: Record<string, unknown>): Array<Record<string, unknown>> {
  const variants = [
    ...asRecordArray(rawPayload.transport_variants),
    ...asRecordArray(rawPayload.transport_price_debug)
  ]
    .map(toTransportVariant)
    .filter((row): row is TransportVariantForDraft => Boolean(row));

  if (variants.length === 0) return [];
  return buildDraftTransportOptionsFromVariants(variants);
}

function asStringArray(value: Json | null): string[] {
  if (Array.isArray(value)) {
    return value
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (Array.isArray(parsed)) {
        return parsed
          .filter((item): item is string => typeof item === 'string')
          .map((item) => item.trim())
          .filter(Boolean);
      }
    } catch {
      return [];
    }
  }

  return [];
}

function asSeoChecks(
  value: Json | null
): Array<{ code: string; level: 'ok' | 'warning' | 'info'; message: string }> {
  if (!Array.isArray(value)) return [];
  return (value as unknown[])
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
    .map((item) => {
      const code = typeof item.code === 'string' ? item.code.trim() : '';
      const level = item.level === 'ok' || item.level === 'warning' || item.level === 'info' ? item.level : null;
      const message = typeof item.message === 'string' ? item.message.trim() : '';
      if (!code || !level || !message) return null;
      return { code, level, message };
    })
    .filter(
      (item): item is { code: string; level: 'ok' | 'warning' | 'info'; message: string } =>
        Boolean(item)
    );
}

function readPartnerDiscountPercentFromRaw(rawPayload: Record<string, unknown>): number | null {
  const v = rawPayload.partner_discount_percent;
  if (v == null || v === '') return null;
  const n = typeof v === 'number' ? v : Number(String(v).trim().replace(',', '.'));
  if (!Number.isFinite(n) || n < 0 || n > 100) return null;
  return n;
}

function readExistingAccommodationId(rawPayload: Record<string, unknown>): string | null {
  const importOptions = rawPayload.import_options;
  if (!isPlainRecord(importOptions)) return null;
  const selectedId = importOptions.existing_accommodation_id;
  return typeof selectedId === 'string' && selectedId.trim().length > 0 ? selectedId.trim() : null;
}

/** Brouillon créé depuis « Saisie manuelle » — pas d’import URL, pas de polling « import en cours ». */
function isManualCreationDraft(rawPayload: Record<string, unknown>): boolean {
  if (rawPayload.manual_entry === true) return true;
  if (rawPayload.created_via === 'manual-flow') return true;
  return false;
}

function draftStatusBadgeClass(status: string | null): string {
  switch ((status ?? '').toLowerCase()) {
    case 'validated':
      return 'bg-emerald-100 text-emerald-700';
    case 'pending':
      return 'bg-amber-100 text-amber-700';
    default:
      return 'bg-slate-100 text-slate-700';
  }
}

function formatDebugValue(value: unknown): string {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'string') return value;
  if (value == null) return '—';
  return JSON.stringify(value);
}

function formatDebugEuroFromCents(value: unknown): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value / 100);
}

export default async function StayDraftReviewPage({ params: paramsPromise, searchParams }: PageProps) {
  const params = await paramsPromise;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const session = await requireRole('ORGANISATEUR');
  const supabase = getServerSupabaseClient();
  const { selectedOrganizer, selectedOrganizerId } = await resolveOrganizerSelection(
    resolvedSearchParams?.organizerId,
    session.tenantId ?? null
  );

  if (!selectedOrganizerId) {
    redirect('/organisme/sejours');
  }

  const { data: draft } = await supabase
    .from('stay_drafts')
    .select('*')
    .eq('id', params.id)
    .eq('organizer_id', selectedOrganizerId)
    .maybeSingle();

  if (!draft) {
    redirect(withOrganizerQuery('/organisme/sejours', selectedOrganizerId));
  }

  const rawPayload = asObject(draft.raw_payload);

  const importErrorMessage =
    typeof rawPayload.fetch_error === 'string' && rawPayload.fetch_error.trim()
      ? rawPayload.fetch_error.trim()
      : typeof rawPayload.import_fatal_error === 'string' && rawPayload.import_fatal_error.trim()
        ? rawPayload.import_fatal_error.trim()
        : typeof rawPayload.import_update_error === 'string' && rawPayload.import_update_error.trim()
          ? rawPayload.import_update_error.trim()
          : null;

  const hasImportedTitle = Boolean(normalizeString(draft.title));
  const manualDraft = isManualCreationDraft(rawPayload);
  const pollWhilePending =
    !manualDraft &&
    (draft.status ?? '').toLowerCase() === 'pending' &&
    !importErrorMessage &&
    !hasImportedTitle;

  const aiModel = typeof rawPayload.ai_model === 'string' ? rawPayload.ai_model : null;
  const aiPromptVersion =
    typeof rawPayload.ai_prompt_version === 'string' ? rawPayload.ai_prompt_version : null;
  const aiEnrichedAt =
    typeof rawPayload.ai_enriched_at === 'string' ? rawPayload.ai_enriched_at : null;
  const accommodationsObject = asObject(draft.accommodations_json);
  const linkedAccommodationId = readExistingAccommodationId(rawPayload);
  const linkedAccommodation =
    linkedAccommodationId
      ? (
          await supabase
            .from('accommodations')
            .select('id,name,accommodation_type')
            .eq('id', linkedAccommodationId)
            .eq('organizer_id', selectedOrganizerId)
            .maybeSingle()
        ).data ?? null
      : null;
  const fallbackVideoUrls =
    asStringArray((rawPayload.video_urls as Json | null) ?? null).length > 0
      ? asStringArray((rawPayload.video_urls as Json | null) ?? null)
      : typeof rawPayload.html === 'string' && typeof draft.source_url === 'string'
        ? extractVideoUrls(rawPayload.html, draft.source_url)
        : [];
  const { data: seasonsRaw } = await supabase
    .from('seasons')
    .select('id,name')
    .order('name', { ascending: true });
  const seasonOptions: DraftSeasonOption[] = [...(seasonsRaw ?? [])].sort((a, b) => {
    const indexA = SEASON_ORDER.indexOf(a.name);
    const indexB = SEASON_ORDER.indexOf(b.name);
    if (indexA === -1 && indexB === -1) return a.name.localeCompare(b.name, 'fr');
    if (indexA === -1) return 1;
    if (indexB === -1) return -1;
    return indexA - indexB;
  });
  const importReviewDebrief = asObject((rawPayload.import_review_debrief as Json | null) ?? null);
  const sourceHost = normalizeString(String(importReviewDebrief.source_host ?? ''));
  const sessionPriceExtraction = asObject(
    (importReviewDebrief.session_price_extraction as Json | null) ?? null
  );
  const ceslStructuredDebug = asObject(
    (sessionPriceExtraction.cesl_structured_booking as Json | null) ?? null
  );
  const ceslStructuredSessions = Array.isArray(ceslStructuredDebug.sessions)
    ? ceslStructuredDebug.sessions.filter((item): item is Record<string, unknown> => isPlainRecord(item))
    : [];
  const transportPriceDebug = asRecordArray(rawPayload.transport_price_debug ?? null);
  const thalieTransportDebug = sourceHost.includes('thalie')
    ? transportPriceDebug
    : [];
  const thalieTransportDebugFailures = thalieTransportDebug.filter(
    (row) => typeof row.amount_cents !== 'number' || !Number.isFinite(row.amount_cents)
  );
  const draftSessionsFromDb = asArrayOfObjects(draft.sessions_json);
  const draftTransportOptionsFromDb = collapseTransportDraftOptionsJson(
    asArrayOfObjects(draft.transport_options_json)
  );
  const recoveredTransportOptions = recoverImportedTransportOptions(rawPayload);
  const shouldRepairCeslSessions =
    ceslStructuredSessions.length > 0 &&
    buildSessionSignature(draftSessionsFromDb) !== buildSessionSignature(ceslStructuredSessions);
  const shouldRepairTransportOptions =
    recoveredTransportOptions.length > 0 &&
    countPricedTransportOptions(recoveredTransportOptions) >
      countPricedTransportOptions(draftTransportOptionsFromDb);

  if (shouldRepairCeslSessions) {
    await supabase
      .from('stay_drafts')
      .update({
        sessions_json: ceslStructuredSessions as Json,
        updated_at: new Date().toISOString(),
        raw_payload: {
          ...rawPayload,
          cesl_page_repair_applied_at: new Date().toISOString()
        } as Json
      })
      .eq('id', draft.id)
      .eq('organizer_id', selectedOrganizerId);
  }

  if (shouldRepairTransportOptions) {
    await supabase
      .from('stay_drafts')
      .update({
        transport_options_json: recoveredTransportOptions as Json,
        updated_at: new Date().toISOString(),
        raw_payload: {
          ...rawPayload,
          transport_page_repair_applied_at: new Date().toISOString()
        } as Json
      })
      .eq('id', draft.id)
      .eq('organizer_id', selectedOrganizerId);
  }

  const effectiveSessionsJson = shouldRepairCeslSessions ? ceslStructuredSessions : draftSessionsFromDb;
  const effectiveTransportOptionsJson = shouldRepairTransportOptions
    ? recoveredTransportOptions
    : draftTransportOptionsFromDb;
  const inferredSeasonName = inferDraftSeasonName(effectiveSessionsJson);
  const storedDraftSeasonIds = readDraftSeasonIds(rawPayload);
  const storedDraftSeasonNames = readDraftSeasonNames(rawPayload);
  const resolvedSeasonIds =
    storedDraftSeasonIds.length > 0
      ? storedDraftSeasonIds
      : inferredSeasonName
        ? seasonOptions
            .filter((season) => normalizeSeasonKey(season.name) === normalizeSeasonKey(inferredSeasonName))
            .map((season) => season.id)
        : [];
  const resolvedSeasonNames =
    storedDraftSeasonNames.length > 0
      ? storedDraftSeasonNames
      : resolvedSeasonIds.length > 0
        ? seasonOptions
            .filter((season) => resolvedSeasonIds.includes(season.id))
            .map((season) => season.name)
        : inferredSeasonName
          ? [inferredSeasonName]
          : [];

  const initialPayload: StayDraftReviewPayload = {
    title: normalizeString(draft.title),
    season_name: resolvedSeasonNames.join(', ') || null,
    season_ids: resolvedSeasonIds,
    season_names: resolvedSeasonNames,
    summary: normalizeString(draft.summary),
    location_text: normalizeString(draft.location_text),
    region_text: normalizeString(draft.region_text),
    description: normalizeString(draft.description),
    program_text: normalizeString(draft.program_text),
    supervision_text: normalizeString(draft.supervision_text),
    transport_text: normalizeString(draft.transport_text),
    transport_mode: normalizeString(draft.transport_mode),
    categories: normalizeStayDraftCategories(draft.categories ?? []).categories,
    ages: draft.ages ?? [],
    sessions_json: effectiveSessionsJson,
    extra_options_json: asArrayOfObjects(draft.extra_options_json),
    transport_options_json: effectiveTransportOptionsJson,
    accommodations_json:
      !linkedAccommodation && Object.keys(accommodationsObject).length > 0
        ? accommodationsObject
        : null,
    seo_primary_keyword: normalizeString(draft.seo_primary_keyword),
    seo_secondary_keywords: draft.seo_secondary_keywords ?? [],
    seo_target_city: normalizeString(draft.seo_target_city),
    seo_target_region: normalizeString(draft.seo_target_region),
    seo_search_intents: draft.seo_search_intents ?? [],
    seo_title: normalizeString(draft.seo_title),
    seo_meta_description: normalizeString(draft.seo_meta_description),
    seo_intro_text: normalizeString(draft.seo_intro_text),
    seo_h1_variant: normalizeString(draft.seo_h1_variant),
    seo_internal_link_anchor_suggestions: draft.seo_internal_link_anchor_suggestions ?? [],
    seo_slug_candidate: normalizeString(draft.seo_slug_candidate),
    seo_score: Number.isFinite(draft.seo_score) ? draft.seo_score : null,
    seo_checks: asSeoChecks(draft.seo_checks),
    seo_generated_at: draft.seo_generated_at,
    seo_generation_source: normalizeString(draft.seo_generation_source) || null,
    images: normalizeImportedImageUrlList(asStringArray(draft.images)),
    video_urls: normalizeImportedVideoUrlList(fallbackVideoUrls),
    partner_discount_percent: readPartnerDiscountPercentFromRaw(rawPayload)
  };

  const backHref = withOrganizerQuery('/organisme/sejours', selectedOrganizerId);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Relecture du brouillon séjour</h1>
          <p className="text-sm text-slate-600">
            {selectedOrganizer
              ? `Relecture et validation manuelle pour ${selectedOrganizer.name}.`
              : 'Relecture et validation manuelle du brouillon.'}
          </p>
        </div>
        <Link
          href={backHref}
          className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"
        >
          Retour à la liste
        </Link>
      </div>

      <DraftImportStatusBanner pollWhilePending={pollWhilePending} importErrorMessage={importErrorMessage} />

      {!manualDraft ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <div className="grid gap-3 text-sm md:grid-cols-2">
            <p>
              <span className="font-medium text-slate-700">ID :</span>{' '}
              <span className="font-mono text-slate-900">{draft.id}</span>
            </p>
            <p>
              <span className="font-medium text-slate-700">Source :</span>{' '}
              <a
                href={draft.source_url}
                target="_blank"
                rel="noreferrer"
                className="break-all text-emerald-700 underline"
              >
                {draft.source_url}
              </a>
            </p>
            <p>
              <span className="font-medium text-slate-700">Statut :</span>{' '}
              <span
                className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase ${draftStatusBadgeClass(draft.status)}`}
              >
                {draft.status}
              </span>
            </p>
            <p>
              <span className="font-medium text-slate-700">Créé le :</span>{' '}
              {new Date(draft.created_at).toLocaleString('fr-FR')}
            </p>
            <p>
              <span className="font-medium text-slate-700">Mis à jour le :</span>{' '}
              {new Date(draft.updated_at).toLocaleString('fr-FR')}
            </p>
            <p>
              <span className="font-medium text-slate-700">Validé le :</span>{' '}
              {draft.validated_at ? new Date(draft.validated_at).toLocaleString('fr-FR') : '—'}
            </p>
            <p>
              <span className="font-medium text-slate-700">Validé par :</span>{' '}
              {draft.validated_by_user_id ?? '—'}
            </p>
            <p>
              <span className="font-medium text-slate-700">Modèle IA :</span> {aiModel ?? '—'}
            </p>
            <p>
              <span className="font-medium text-slate-700">Version du prompt IA :</span>{' '}
              {aiPromptVersion ?? '—'}
            </p>
            <p>
              <span className="font-medium text-slate-700">Enrichi par IA le :</span>{' '}
              {aiEnrichedAt ? new Date(aiEnrichedAt).toLocaleString('fr-FR') : '—'}
            </p>
          </div>
        </div>
      ) : null}

      {Object.keys(importReviewDebrief).length > 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">
            Diagnostic d&apos;import
          </h2>
          <div className="mt-3 grid gap-3 text-sm md:grid-cols-2">
            <p>
              <span className="font-medium text-slate-700">Sessions stockées dans le brouillon :</span>{' '}
              {initialPayload.sessions_json.length}
            </p>
            <p>
              <span className="font-medium text-slate-700">Villes de transport stockées :</span>{' '}
              {initialPayload.transport_options_json.length}
            </p>
            {sourceHost.includes('thalie') ? (
              <p>
                <span className="font-medium text-slate-700">Villes de transport réparées depuis `raw_payload` :</span>{' '}
                {shouldRepairTransportOptions ? 'oui' : 'non'}
              </p>
            ) : null}
            <p>
              <span className="font-medium text-slate-700">Prix de base statique :</span>{' '}
              {formatDebugValue(sessionPriceExtraction.price_from_eur_static)}
            </p>
            <p>
              <span className="font-medium text-slate-700">Prix après DOM dynamique :</span>{' '}
              {formatDebugValue(sessionPriceExtraction.price_from_eur_after_dynamic_dom)}
            </p>
            <p>
              <span className="font-medium text-slate-700">Prix CESL structuré :</span>{' '}
              {formatDebugValue(sessionPriceExtraction.price_from_eur_cesl_structured)}
            </p>
            <p>
              <span className="font-medium text-slate-700">Sessions CESL structurées :</span>{' '}
              {formatDebugValue(ceslStructuredDebug.session_count)}
            </p>
          </div>

          {ceslStructuredSessions.length > 0 ? (
            <div className="mt-4">
              <p className="text-sm font-medium text-slate-700">Sessions lues dans `sDureesJson`</p>
              <ul className="mt-2 space-y-1 text-xs text-slate-600">
                {ceslStructuredSessions.map((session, index) => (
                  <li key={`${session.start_date ?? 'na'}|${session.end_date ?? 'na'}|raw|${index}`}>
                    {formatDebugValue(session.start_date)} → {formatDebugValue(session.end_date)} · prix{' '}
                    {formatDebugValue(session.price)} · dispo {formatDebugValue(session.availability)}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {sourceHost.includes('thalie') ? (
            <div className="mt-4 space-y-3">
              <div>
                <p className="text-sm font-medium text-slate-700">Pourquoi un prix transport Thalie peut manquer</p>
                <ul className="mt-2 space-y-1 text-xs text-slate-600">
                  <li>Le calcul ne lit pas un prix “transport” direct: il calcule un delta entre le total de la date seule et le total de la même date avec une ville de départ.</li>
                  <li>Le prix reste vide si le prix de base de la date n&apos;a pas été lu, si l&apos;URL de la ville n&apos;a pas été récupérée, ou si le total ville n&apos;est pas supérieur au total de base.</li>
                  <li>Sur Thalie, une même ville peut aussi varier selon la session. Si les pages retournent des valeurs incohérentes ou incomplètes, la ville est importée sans montant fiable.</li>
                </ul>
              </div>

              <div>
                <p className="text-sm font-medium text-slate-700">Transport Thalie: données lues pendant l&apos;import</p>
                {thalieTransportDebug.length > 0 ? (
                  <ul className="mt-2 space-y-1 text-xs text-slate-600">
                    {thalieTransportDebug.slice(0, 40).map((row, index) => (
                      <li
                        key={`${String(row.variant_url ?? 'na')}|${String(row.departure_city ?? 'na')}|${index}`}
                      >
                        {formatDebugValue(row.departure_city)} · session {formatDebugValue(row.return_label_raw)} · total lu {formatDebugEuroFromCents(row.page_price_cents)} · base session {formatDebugEuroFromCents(row.base_price_cents)} · delta retenu {formatDebugEuroFromCents(row.amount_cents)} · méthode {formatDebugValue(row.pricing_method)} · raison {formatDebugValue(row.reason)}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-xs text-slate-600">Aucune ligne `transport_price_debug` disponible pour cet import.</p>
                )}
              </div>

              {thalieTransportDebugFailures.length > 0 ? (
                <div>
                  <p className="text-sm font-medium text-slate-700">Lignes Thalie sans prix calculé</p>
                  <ul className="mt-2 space-y-1 text-xs text-rose-700">
                    {thalieTransportDebugFailures.slice(0, 20).map((row, index) => (
                      <li
                        key={`fail|${String(row.variant_url ?? 'na')}|${String(row.departure_city ?? 'na')}|${index}`}
                      >
                        {formatDebugValue(row.departure_city)} · session {formatDebugValue(row.return_label_raw)} · total lu {formatDebugEuroFromCents(row.page_price_cents)} · base session {formatDebugEuroFromCents(row.base_price_cents)} · raison {formatDebugValue(row.reason)}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      <StayDraftReviewForm
        draftId={draft.id}
        organizerId={draft.organizer_id}
        backHref={backHref}
        initialPayload={initialPayload}
        seasonOptions={seasonOptions}
        initialStatus={draft.status}
        initialValidatedAt={draft.validated_at}
        initialValidatedByUserId={draft.validated_by_user_id}
        hideTopStatusCard={manualDraft}
        linkedAccommodation={
          linkedAccommodation
            ? ({
                id: linkedAccommodation.id,
                name: linkedAccommodation.name,
                accommodationType: linkedAccommodation.accommodation_type
              } satisfies LinkedAccommodationSummary)
            : null
        }
      />
    </div>
  );
}
