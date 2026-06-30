import { NextResponse } from 'next/server';
import { requireOrganizerApiAccess } from '@/lib/organizer-backoffice-access.server';
import { withOrganizerQuery } from '@/lib/organizers.server';
import {
  ensurePrimaryStaySettingCategory,
  normalizeStayDraftCategories,
  stayCategoryLabelToValue,
  stayCategoryValueToLabel
} from '@/lib/stay-categories';
import { inferTransportLogisticsModeFromSignals } from '@/lib/stay-draft-content';
import { writeDraftDestinationFields } from '@/lib/stay-draft-destination';
import {
  countDatedDraftSessions,
  repairZigotoursDraftSessions
} from '@/lib/stay-draft-import';
import {
  buildDraftTransportOptionsFromVariants,
  type TransportVariantForDraft
} from '@/lib/stay-draft-transport-display';
import { enrichStayDraftWithAI, StayDraftAiEnrichmentError } from '@/lib/stay-draft-ai-enrichment';
import { normalizeStayTitle } from '@/lib/stay-title';
import { resolveAccommodationCenterCoordinates } from '@/lib/accommodation-center-geocoding';
import { getServerSupabaseClient } from '@/lib/supabase/server';
import type { Database, Json } from '@/types/supabase';

export const runtime = 'nodejs';

type StayDraftRow = Database['public']['Tables']['stay_drafts']['Row'];
type StayDraftUpdate = Database['public']['Tables']['stay_drafts']['Update'];
type StayDraftRowAfterUpdate = Pick<
  StayDraftRow,
  | 'id'
  | 'summary'
  | 'description'
  | 'location_text'
  | 'region_text'
  | 'program_text'
  | 'supervision_text'
  | 'transport_text'
  | 'transport_mode'
  | 'categories'
  | 'ages'
  | 'sessions_json'
  | 'extra_options_json'
  | 'transport_options_json'
  | 'accommodations_json'
  | 'raw_payload'
  | 'updated_at'
>;

function logInfo(message: string, details?: Record<string, unknown>) {
  if (details) {
    console.info(`[stay-drafts/enrich] ${message}`, details);
    return;
  }
  console.info(`[stay-drafts/enrich] ${message}`);
}

function logError(message: string, details?: Record<string, unknown>) {
  if (details) {
    console.error(`[stay-drafts/enrich] ${message}`, details);
    return;
  }
  console.error(`[stay-drafts/enrich] ${message}`);
}

function requestExpectsJson(req: Request): boolean {
  const contentType = req.headers.get('content-type') ?? '';
  const accept = req.headers.get('accept') ?? '';
  return contentType.includes('application/json') || accept.includes('application/json');
}

function redirectToOrganizerStayCreation(
  req: Request,
  organizerId: string | null,
  params?: Record<string, string>
) {
  const query = new URLSearchParams(params ?? {}).toString();
  const path = withOrganizerQuery(
    query ? `/organisme/sejours/new/url?${query}` : '/organisme/sejours/new/url',
    organizerId
  );
  return NextResponse.redirect(new URL(path, req.url), 303);
}

function makeErrorResponse(
  req: Request,
  organizerId: string | null,
  errorMessage: string,
  status = 400
) {
  if (requestExpectsJson(req)) {
    return NextResponse.json({ error: errorMessage }, { status });
  }
  return redirectToOrganizerStayCreation(req, organizerId, { error: errorMessage });
}

function makeSuccessResponse(
  req: Request,
  organizerId: string | null,
  result: {
    draftId: string;
    force: boolean;
    aiModel: string;
    aiPromptVersion: string;
    aiEnrichedAt: string | null;
    transportDebugCities: string[];
    updatedDraft: {
      id: string;
      summary: string | null;
      description: string | null;
      location_text: string | null;
      region_text: string | null;
      program_text: string | null;
      supervision_text: string | null;
      transport_text: string | null;
      transport_mode: string | null;
      categories: string[] | null;
      ages: number[] | null;
      sessions_json: Json | null;
      extra_options_json: Json | null;
      transport_options_json: Json | null;
      accommodations_json: Json | null;
      updated_at: string;
      ai_extracted: unknown;
      ai_raw: unknown;
    };
  }
) {
  if (requestExpectsJson(req)) {
    return NextResponse.json({
      success: true,
      draftId: result.draftId,
      force: result.force,
      ai_model: result.aiModel,
      ai_prompt_version: result.aiPromptVersion,
      ai_enriched_at: result.aiEnrichedAt,
      transport_cities_debug: result.transportDebugCities,
      updated_draft: result.updatedDraft
    });
  }
  return redirectToOrganizerStayCreation(req, organizerId, {
    ai: 'success',
    aiDraftId: result.draftId,
    transportCitiesDebug: JSON.stringify(result.transportDebugCities)
  });
}

function parseBooleanInput(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value !== 'string') return undefined;

  const normalized = value.trim().toLowerCase();
  if (!normalized) return undefined;
  if (['1', 'true', 'on', 'yes', 'oui'].includes(normalized)) return true;
  if (['0', 'false', 'off', 'no', 'non'].includes(normalized)) return false;
  return undefined;
}

function cleanText(value: string | null | undefined) {
  const normalized = (value ?? '').trim();
  return normalized || null;
}

function extractCountryFromLocationText(value: string | null | undefined) {
  const candidate = cleanText(value);
  if (!candidate) return null;
  const parts = candidate.split(',').map((part) => part.trim()).filter(Boolean);
  return parts.length >= 2 ? parts.at(-1) ?? null : null;
}

function extractCityFromLocationText(value: string | null | undefined) {
  const candidate = cleanText(value);
  if (!candidate) return null;
  const parts = candidate.split(',').map((part) => part.trim()).filter(Boolean);
  return parts[0] ?? null;
}

function deriveDraftDestinationFromAi(input: {
  categories: string[];
  locationText: string | null;
  regionText: string | null;
  accommodation:
    | {
        city?: string | null;
        postal_code?: string | null;
        department_code?: string | null;
        region_text?: string | null;
        country?: string | null;
        location_mode: string | null;
        location_city: string | null;
        location_department_code: string | null;
        location_country: string | null;
        itinerant_zone: string | null;
      }
    | null;
}) {
  const categories = new Set(input.categories.map((value) => value.toLowerCase()));
  const accommodation = input.accommodation;
  const mode = accommodation?.location_mode ?? null;
  const regionText = cleanText(input.regionText);
  const locationText = cleanText(input.locationText);
  const city = cleanText(accommodation?.city) ?? cleanText(accommodation?.location_city);
  const postalCode = cleanText(accommodation?.postal_code);
  const departmentCode = cleanText(accommodation?.department_code) ?? cleanText(accommodation?.location_department_code);
  const country = cleanText(accommodation?.country) ?? cleanText(accommodation?.location_country);

  if (mode === 'itinerant' || categories.has('itinerant')) {
    return {
      destination_type: 'itinerant' as const,
      destination_city: null,
      destination_postal_code: null,
      destination_department_code: null,
      destination_region: null,
      destination_country: country,
      destination_itinerary_label: cleanText(accommodation?.itinerant_zone) ?? locationText,
      destination_countries:
        country != null ? [country] : []
    };
  }

  if (mode === 'abroad' || categories.has('etranger') || regionText === 'Étranger') {
    const destinationCity = city ?? extractCityFromLocationText(locationText);
    const destinationCountry = country ?? extractCountryFromLocationText(locationText);
    return {
      destination_type: 'fixed_abroad' as const,
      destination_city: destinationCity,
      destination_postal_code: null,
      destination_department_code: null,
      destination_region: null,
      destination_country: destinationCountry,
      destination_itinerary_label: null,
      destination_countries: []
    };
  }

  return {
    destination_type: 'fixed_france' as const,
    destination_city: city ?? locationText,
    destination_postal_code: postalCode,
    destination_department_code: departmentCode,
    destination_region: regionText,
    destination_country: 'France',
    destination_itinerary_label: null,
    destination_countries: []
  };
}

async function readEnrichInput(req: Request) {
  const contentType = req.headers.get('content-type') ?? '';

  if (contentType.includes('application/json')) {
    const body = (await req.json().catch(() => ({}))) as {
      draftId?: unknown;
      draft_id?: unknown;
      organizerId?: unknown;
      organizer_id?: unknown;
      force?: unknown;
    };
    return {
      draftId:
        typeof body.draftId === 'string'
          ? body.draftId
          : typeof body.draft_id === 'string'
            ? body.draft_id
            : '',
      organizerId:
        typeof body.organizerId === 'string'
          ? body.organizerId
          : typeof body.organizer_id === 'string'
            ? body.organizer_id
            : '',
      force: parseBooleanInput(body.force)
    };
  }

  const formData = await req.formData();
  return {
    draftId: String(formData.get('draftId') ?? formData.get('draft_id') ?? ''),
    organizerId: String(formData.get('organizerId') ?? formData.get('organizer_id') ?? ''),
    force: parseBooleanInput(formData.get('force'))
  };
}

function hasText(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function hasJsonValue(value: Json | null | undefined): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Object.keys(value).length > 0;
  return true;
}

function asRecordArray(value: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(value)) {
    return value.filter(
      (item): item is Record<string, unknown> =>
        Boolean(item) && typeof item === 'object' && !Array.isArray(item)
    );
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (Array.isArray(parsed)) {
        return parsed.filter(
          (item): item is Record<string, unknown> =>
            Boolean(item) && typeof item === 'object' && !Array.isArray(item)
        );
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

function normalizeTransportDebugCity(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.replace(/\s+/g, ' ').trim();
  return normalized.length > 0 ? normalized : null;
}

function extractTransportDebugCities(value: unknown): string[] {
  const cities = new Set<string>();

  for (const row of asRecordArray(value)) {
    const candidates = [row.label, row.departure_city, row.return_city];
    for (const candidate of candidates) {
      const city = normalizeTransportDebugCity(candidate);
      if (city) cities.add(city);
    }
  }

  return Array.from(cities).slice(0, 50);
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

function recoverImportedTransportOptions(
  rawPayload: Record<string, unknown>
): Array<Record<string, unknown>> {
  const variantSources = [
    ...asRecordArray(rawPayload.transport_variants),
    ...asRecordArray(rawPayload.transport_matrix),
    ...asRecordArray(rawPayload.transport_price_debug)
  ];
  const variants = variantSources
    .map(toTransportVariant)
    .filter((row): row is TransportVariantForDraft => Boolean(row));
  if (variants.length === 0) return [];
  return buildDraftTransportOptionsFromVariants(variants);
}

function simplifyForMatch(value: string | null | undefined): string {
  if (!value) return '';
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function isLikelySeoDescription(value: string | null | undefined): boolean {
  if (!hasText(value)) return false;
  const normalized = simplifyForMatch(value);
  if (!normalized) return false;

  const keywordSignals = [
    'colonie',
    'stage',
    'sejour',
    'pour enfant',
    'pour adolescents',
    'meilleures colonies',
    'encadree par',
    'artistiques'
  ];

  const keywordHits = keywordSignals.reduce((count, signal) => {
    return count + (normalized.includes(signal) ? 1 : 0);
  }, 0);

  return keywordHits >= 3 || /(^| )colonie( |$).*(^| )colonie( |$)/.test(normalized);
}

function shouldReplaceDescription(
  draft: StayDraftRow,
  currentRawPayload: Record<string, unknown>,
  force: boolean
): boolean {
  if (force || !hasText(draft.description)) return true;

  const extractedValue = currentRawPayload.extracted;
  const extracted =
    extractedValue && typeof extractedValue === 'object' && !Array.isArray(extractedValue)
      ? (extractedValue as Record<string, unknown>)
      : null;
  const importedDescription =
    extracted && typeof extracted.description === 'string' ? extracted.description.trim() : null;

  if (importedDescription && draft.description?.trim() === importedDescription) return true;
  return isLikelySeoDescription(draft.description);
}

function asObject(value: Json | null): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return { ...value };
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return {};
    }
  }

  return {};
}

function readImportedExistingAccommodationId(rawPayload: Json | null): string | null {
  const raw = asObject(rawPayload);
  const importOptions = raw.import_options;
  if (!importOptions || typeof importOptions !== 'object' || Array.isArray(importOptions)) {
    return null;
  }

  const selectedId = (importOptions as Record<string, unknown>).existing_accommodation_id;
  return typeof selectedId === 'string' && selectedId.trim().length > 0 ? selectedId.trim() : null;
}

async function buildDraftUpdateFromAi(
  draft: StayDraftRow,
  ai: Awaited<ReturnType<typeof enrichStayDraftWithAI>>,
  force: boolean
): Promise<StayDraftUpdate> {
  const patch: StayDraftUpdate = {};
  const extracted = ai.extracted;
  const currentRawPayload = asObject(draft.raw_payload);
  const currentTransportOptions = asRecordArray(draft.transport_options_json);
  const recoveredImportedTransportOptions = recoverImportedTransportOptions(currentRawPayload);
  const linkedAccommodationId = readImportedExistingAccommodationId(draft.raw_payload);
  let extractedAccommodation = linkedAccommodationId ? null : extracted.accommodations_json;
  let accommodationGeocodingMeta: Json | null = null;
  const shouldResolveAccommodationCoordinates =
    Boolean(extractedAccommodation) && (force || !hasJsonValue(draft.accommodations_json));

  if (extractedAccommodation && shouldResolveAccommodationCoordinates) {
    const resolvedCoordinates = await resolveAccommodationCenterCoordinates({
      title: extractedAccommodation.title,
      locationMode: extractedAccommodation.location_mode,
      locationCity: extractedAccommodation.city ?? extractedAccommodation.location_city,
      locationDepartmentCode: extractedAccommodation.department_code ?? extractedAccommodation.location_department_code,
      locationCountry: extractedAccommodation.country ?? extractedAccommodation.location_country,
      geocodingQuery: extractedAccommodation.center_geocoding_query,
      draftLocationText: draft.location_text,
      draftRegionText: draft.region_text,
      centerLatitude: extractedAccommodation.center_latitude,
      centerLongitude: extractedAccommodation.center_longitude
    });

    if (
      resolvedCoordinates.centerLatitude != null &&
      resolvedCoordinates.centerLongitude != null
    ) {
      extractedAccommodation = {
        ...extractedAccommodation,
        center_latitude: resolvedCoordinates.centerLatitude,
        center_longitude: resolvedCoordinates.centerLongitude
      };
    }

    accommodationGeocodingMeta = {
      source: resolvedCoordinates.source,
      query_used: resolvedCoordinates.queryUsed,
      confidence: resolvedCoordinates.confidence,
      center_latitude: resolvedCoordinates.centerLatitude,
      center_longitude: resolvedCoordinates.centerLongitude
    } as Json;
  }
  const normalizedCategoryLabels = normalizeStayDraftCategories(extracted.categories).categories;
  const categoryContext = [
    extracted.location_text,
    extracted.region_text,
    extracted.summary,
    extracted.program_text,
    extracted.transport_text,
    draft.location_text,
    draft.region_text,
    draft.summary,
    draft.program_text,
    draft.description
  ]
    .filter(Boolean)
    .join(' ');
  const normalizedCategoryValues = ensurePrimaryStaySettingCategory(
    normalizedCategoryLabels
      .map((label) => stayCategoryLabelToValue(label))
      .filter((value): value is NonNullable<ReturnType<typeof stayCategoryLabelToValue>> => value !== null),
    categoryContext
  );
  const normalizedCategories = normalizedCategoryValues.reduce<string[]>((acc, value) => {
    const label = stayCategoryValueToLabel(value);
    if (label) acc.push(label);
    return acc;
  }, []);
  const derivedDestination = deriveDraftDestinationFromAi({
    categories: normalizedCategoryValues,
    locationText: extracted.location_text,
    regionText: extracted.region_text,
    accommodation: extractedAccommodation
      ? {
          city: extractedAccommodation.city,
          postal_code: extractedAccommodation.postal_code,
          department_code: extractedAccommodation.department_code,
          region_text: extractedAccommodation.region_text,
          country: extractedAccommodation.country,
          location_mode: extractedAccommodation.location_mode,
          location_city: extractedAccommodation.location_city,
          location_department_code: extractedAccommodation.location_department_code,
          location_country: extractedAccommodation.location_country,
          itinerant_zone: extractedAccommodation.itinerant_zone
        }
      : null
  });
  const normalizedTitle = normalizeStayTitle(draft.title);

  if (hasText(normalizedTitle) && normalizedTitle !== String(draft.title ?? '').trim()) {
    patch.title = normalizedTitle;
  }
  if ((force || !hasText(draft.summary)) && hasText(extracted.summary)) patch.summary = extracted.summary;
  if (shouldReplaceDescription(draft, currentRawPayload, force) && hasText(extracted.description)) {
    patch.description = extracted.description;
  }
  if ((force || !hasText(draft.location_text)) && hasText(extracted.location_text)) {
    patch.location_text = extracted.location_text;
  }
  if ((force || !hasText(draft.region_text)) && hasText(extracted.region_text)) {
    patch.region_text = extracted.region_text;
  }
  if ((force || !hasText(draft.program_text)) && hasText(extracted.program_text)) {
    patch.program_text = extracted.program_text;
  }
  if ((force || !hasText(draft.supervision_text)) && hasText(extracted.supervision_text)) {
    patch.supervision_text = extracted.supervision_text;
  }
  if ((force || !hasText(draft.transport_text)) && hasText(extracted.transport_text)) {
    patch.transport_text = extracted.transport_text;
  }
  const inferredTransportMode = inferTransportLogisticsModeFromSignals({
    currentValue: extracted.transport_mode,
    html: typeof currentRawPayload.html === 'string' ? currentRawPayload.html : null,
    visibleText:
      typeof currentRawPayload.main_text === 'string'
        ? currentRawPayload.main_text
        : typeof currentRawPayload.html_excerpt === 'string'
          ? currentRawPayload.html_excerpt
          : null,
    transportOptions: Array.isArray(currentRawPayload.transport_variants)
      ? currentRawPayload.transport_variants
      : Array.isArray(currentRawPayload.transport_matrix)
        ? currentRawPayload.transport_matrix
        : null
  });
  if ((force || !hasText(draft.transport_mode)) && hasText(inferredTransportMode)) {
    patch.transport_mode = inferredTransportMode;
  }
  if ((force || !draft.categories || draft.categories.length === 0) && normalizedCategories.length > 0) {
    patch.categories = normalizedCategories;
  }
  if ((force || !draft.ages || draft.ages.length === 0) && extracted.ages.length > 0) {
    patch.ages = extracted.ages;
  }
  const currentDatedSessionCount = countDatedDraftSessions(draft.sessions_json);
  const extractedDatedSessionCount = countDatedDraftSessions(extracted.sessions_json);
  if (
    extracted.sessions_json.length > 0 &&
    extractedDatedSessionCount > 0 &&
    (currentDatedSessionCount === 0 ||
      (force && extractedDatedSessionCount >= currentDatedSessionCount))
  ) {
    patch.sessions_json = extracted.sessions_json;
  }
  const recoveredPricedTransportCount = countPricedTransportOptions(recoveredImportedTransportOptions);
  const currentPricedTransportCount = countPricedTransportOptions(currentTransportOptions);
  if (recoveredPricedTransportCount > currentPricedTransportCount) {
    patch.transport_options_json = recoveredImportedTransportOptions as Json;
  } else if (
    currentPricedTransportCount === 0 &&
    !hasJsonValue(draft.transport_options_json) &&
    extracted.transport_options_json.length > 0
  ) {
    patch.transport_options_json = extracted.transport_options_json as Json;
  }
  if ((force || !hasJsonValue(draft.accommodations_json)) && extractedAccommodation) {
    patch.accommodations_json = extractedAccommodation;
  }

  const aiEnrichedAt = new Date().toISOString();
  patch.raw_payload = {
    ...writeDraftDestinationFields(currentRawPayload, derivedDestination),
    ai_raw: ai.rawResponse,
    ai_extracted: {
      ...extracted,
      extra_options_json: [],
      accommodations_json: extractedAccommodation,
      categories: normalizedCategories
    },
    ai_accommodation_geocoding: accommodationGeocodingMeta,
    ai_prompt_version: ai.promptVersion,
    ai_model: ai.model,
    ai_enriched_at: aiEnrichedAt,
    ai_usage: ai.usage
  };

  return patch;
}

async function updateDraftWithFallbacks(
  supabase: ReturnType<typeof getServerSupabaseClient>,
  draftId: string,
  organizerId: string,
  payload: StayDraftUpdate
): Promise<{
  data: StayDraftRowAfterUpdate | null;
  error: { message: string } | null;
  attempt: 'json-object' | 'json-string';
}> {
  const selectColumns = 'id,summary,description,location_text,region_text,program_text,supervision_text,transport_text,transport_mode,categories,ages,sessions_json,extra_options_json,transport_options_json,accommodations_json,raw_payload,updated_at';

  const attempts: Array<{ label: 'json-object' | 'json-string'; payload: StayDraftUpdate }> = [
    { label: 'json-object', payload }
  ];

  if (payload.raw_payload && typeof payload.raw_payload === 'object' && !Array.isArray(payload.raw_payload)) {
    attempts.push({
      label: 'json-string',
      payload: {
        ...payload,
        raw_payload: JSON.stringify(payload.raw_payload)
      }
    });
  }

  let lastError: { message: string } | null = null;
  for (const attempt of attempts) {
    const { data, error } = await supabase
      .from('stay_drafts')
      .update(attempt.payload)
      .eq('id', draftId)
      .eq('organizer_id', organizerId)
      .select(selectColumns)
      .maybeSingle();

    logInfo('supabase update attempt', {
      draftId,
      organizerId,
      attempt: attempt.label,
      hasError: Boolean(error),
      error: error?.message ?? null,
      updatedId: data?.id ?? null
    });

    if (!error && data) {
      return { data, error: null, attempt: attempt.label };
    }

    if (!error && !data) {
      lastError = { message: "Aucune ligne n'a été mise à jour." };
      continue;
    }

    lastError = error;
  }

  return { data: null, error: lastError, attempt: 'json-object' };
}

function extractAiMeta(rawPayload: Json | null): {
  ai_enriched_at: string | null;
  ai_model: string | null;
  ai_prompt_version: string | null;
  ai_extracted: unknown;
  ai_raw: unknown;
} {
  const raw = asObject(rawPayload);
  return {
    ai_enriched_at: typeof raw.ai_enriched_at === 'string' ? raw.ai_enriched_at : null,
    ai_model: typeof raw.ai_model === 'string' ? raw.ai_model : null,
    ai_prompt_version: typeof raw.ai_prompt_version === 'string' ? raw.ai_prompt_version : null,
    ai_extracted: raw.ai_extracted ?? null,
    ai_raw: raw.ai_raw ?? null
  };
}

async function persistAiRawOnFailure(
  supabase: ReturnType<typeof getServerSupabaseClient>,
  draft: StayDraftRow,
  organizerId: string,
  options: {
    rawResponse: string;
    model: string | null;
    promptVersion: string | null;
    usage: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | null;
    errorMessage: string;
  }
) {
  const currentRaw = asObject(draft.raw_payload);
  const nextRaw = {
    ...currentRaw,
    ai_raw: options.rawResponse,
    ai_model: options.model,
    ai_prompt_version: options.promptVersion,
    ai_enriched_at: new Date().toISOString(),
    ai_usage: options.usage,
    ai_error: options.errorMessage
  };

  const attempts: StayDraftUpdate[] = [
    { raw_payload: nextRaw },
    { raw_payload: JSON.stringify(nextRaw) }
  ];

  for (const attempt of attempts) {
    const { error } = await supabase
      .from('stay_drafts')
      .update(attempt)
      .eq('id', draft.id)
      .eq('organizer_id', organizerId);

    if (!error) {
      logInfo('ai raw saved on failure', {
        draftId: draft.id,
        organizerId
      });
      return;
    }

    logError('failed to save ai raw on failure attempt', {
      draftId: draft.id,
      organizerId,
      error: error.message
    });
  }
}

export async function POST(req: Request) {
  const queryForce = parseBooleanInput(new URL(req.url).searchParams.get('force'));
  const { draftId: draftIdRaw, organizerId: organizerIdRaw, force: bodyForce } = await readEnrichInput(req);
  const draftId = draftIdRaw.trim();
  const requestedOrganizerId = organizerIdRaw.trim();
  const force = bodyForce ?? queryForce ?? false;

  logInfo('request received', {
    draftId,
    requestedOrganizerId,
    force,
    expectsJson: requestExpectsJson(req)
  });

  if (!draftId) {
    return makeErrorResponse(req, requestedOrganizerId || null, "L'identifiant du draft est requis.");
  }
  const access = await requireOrganizerApiAccess({
    requestedOrganizerId: requestedOrganizerId || undefined,
    requiredSection: 'stays'
  });
  if (!access.ok) {
    if (requestExpectsJson(req)) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }
    return NextResponse.redirect(new URL('/login', req.url), 303);
  }
  const { selectedOrganizerId } = access.context;

  const supabase = getServerSupabaseClient();

  const { data: draft, error: draftError } = await supabase
    .from('stay_drafts')
    .select('*')
    .eq('id', draftId)
    .eq('organizer_id', selectedOrganizerId)
    .maybeSingle();

  if (draftError || !draft) {
    logError('draft not found', {
      draftId,
      selectedOrganizerId,
      error: draftError?.message ?? null
    });
    return makeErrorResponse(
      req,
      selectedOrganizerId,
      draftError?.message ?? 'Brouillon introuvable pour cet organisateur.',
      404
    );
  }

  let workingDraft = draft;
  if (
    countDatedDraftSessions(draft.sessions_json) === 0 &&
    typeof draft.source_url === 'string' &&
    draft.source_url.trim().length > 0
  ) {
    const rawPayload = asObject(draft.raw_payload);
    const repairedSessions = await repairZigotoursDraftSessions({
      sourceUrl: draft.source_url,
      html: typeof rawPayload.html === 'string' ? rawPayload.html : null,
      currentSessions: draft.sessions_json
    });
    if (repairedSessions?.length) {
      const { data: repairedDraft, error: repairError } = await supabase
        .from('stay_drafts')
        .update({
          sessions_json: repairedSessions as Json,
          updated_at: new Date().toISOString(),
          raw_payload: {
            ...rawPayload,
            zigotours_enrich_repair_applied_at: new Date().toISOString()
          } as Json
        })
        .eq('id', draftId)
        .eq('organizer_id', selectedOrganizerId)
        .select('*')
        .maybeSingle();
      if (!repairError && repairedDraft) {
        workingDraft = repairedDraft;
        logInfo('zigotours sessions repaired before enrich', {
          draftId,
          sessionCount: repairedSessions.length
        });
      }
    }
  }

  let aiResult: Awaited<ReturnType<typeof enrichStayDraftWithAI>>;
  try {
    aiResult = await enrichStayDraftWithAI(workingDraft);
    logInfo('openai response received', {
      draftId,
      model: aiResult.model,
      promptVersion: aiResult.promptVersion,
      usage: aiResult.usage,
      rawResponse: aiResult.rawResponse
    });
    logInfo('openai validation ok', {
      draftId,
      extracted: aiResult.extracted
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "L'enrichissement IA a échoué. Réessayez plus tard.";

    if (error instanceof StayDraftAiEnrichmentError && error.rawResponse) {
      await persistAiRawOnFailure(supabase, draft, selectedOrganizerId, {
        rawResponse: error.rawResponse,
        model: error.model,
        promptVersion: error.promptVersion,
        usage: error.usage,
        errorMessage: message
      });
    }

    logError('openai enrichment failed', {
      draftId,
      message
    });
    return makeErrorResponse(req, selectedOrganizerId, message, 502);
  }

  const updatePayload = await buildDraftUpdateFromAi(workingDraft, aiResult, force);
  logInfo('supabase payload prepared', {
    draftId,
    force,
    payload: updatePayload
  });

  const updateResult = await updateDraftWithFallbacks(
    supabase,
    draft.id,
    selectedOrganizerId,
    updatePayload
  );

  if (updateResult.error || !updateResult.data) {
    logError('supabase update failed', {
      draftId,
      force,
      attempt: updateResult.attempt,
      error: updateResult.error?.message ?? null
    });
    return makeErrorResponse(
      req,
      selectedOrganizerId,
      updateResult.error?.message ?? 'Impossible de sauvegarder le résultat IA.',
      500
    );
  }

  const aiMeta = extractAiMeta(updateResult.data.raw_payload);
  const transportDebugCities = extractTransportDebugCities(updateResult.data.transport_options_json);
  logInfo('supabase update success', {
    draftId,
    force,
    attempt: updateResult.attempt,
    updatedAt: updateResult.data.updated_at,
    aiMeta
  });
  logInfo('transport cities after AI import', {
    draftId,
    transportCities: transportDebugCities,
    transportCityCount: transportDebugCities.length
  });

  return makeSuccessResponse(req, selectedOrganizerId, {
    draftId: draft.id,
    force,
    aiModel: aiMeta.ai_model ?? aiResult.model,
    aiPromptVersion: aiMeta.ai_prompt_version ?? aiResult.promptVersion,
    aiEnrichedAt: aiMeta.ai_enriched_at,
    transportDebugCities,
    updatedDraft: {
      id: updateResult.data.id,
      summary: updateResult.data.summary,
      description: updateResult.data.description,
      location_text: updateResult.data.location_text,
      region_text: updateResult.data.region_text,
      program_text: updateResult.data.program_text,
      supervision_text: updateResult.data.supervision_text,
      transport_text: updateResult.data.transport_text,
      transport_mode: updateResult.data.transport_mode,
      categories: updateResult.data.categories,
      ages: updateResult.data.ages,
      sessions_json: updateResult.data.sessions_json,
      extra_options_json: updateResult.data.extra_options_json,
      transport_options_json: updateResult.data.transport_options_json,
      accommodations_json: updateResult.data.accommodations_json,
      updated_at: updateResult.data.updated_at,
      ai_extracted: aiMeta.ai_extracted,
      ai_raw: aiMeta.ai_raw
    }
  });
}
