import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '@/types/supabase';

type StayDraftRow = Database['public']['Tables']['stay_drafts']['Row'];
type StayStatus = Database['public']['Enums']['stay_status'];
type SessionStatus = Database['public']['Enums']['session_status'];
type StayInsert = Database['public']['Tables']['stays']['Insert'];
type StayUpdate = Database['public']['Tables']['stays']['Update'];
type SessionInsert = Database['public']['Tables']['sessions']['Insert'];
type StayMediaInsert = Database['public']['Tables']['stay_media']['Insert'];
type ExtraOptionInsert = Database['public']['Tables']['stay_extra_options']['Insert'];
type TransportOptionInsert = Database['public']['Tables']['transport_options']['Insert'];
type AccommodationInsert = Database['public']['Tables']['accommodations']['Insert'];
type AccommodationUpdate = Database['public']['Tables']['accommodations']['Update'];

type LivePublication = {
  stay_id: string;
  published_at: string;
  synced_tables: string[];
  accommodation_id?: string | null;
};

export type PublishStayDraftToLiveInput = {
  supabase: SupabaseClient<Database>;
  draft: StayDraftRow;
};

export type PublishStayDraftToLiveResult = {
  stayId: string;
  publishedAt: string;
  syncedTables: string[];
  rawPayload: Record<string, unknown>;
};

export class PublishStayDraftError extends Error {
  readonly step: string;

  constructor(step: string, message: string) {
    super(message);
    this.name = 'PublishStayDraftError';
    this.step = step;
  }
}

const CATEGORY_LABEL_TO_VALUE = {
  'Séjour à la mer': 'mer',
  'Séjour à la montagne': 'montagne',
  'Séjour à la campagne': 'campagne',
  'Séjour artistique': 'artistique',
  'Séjour équestre': 'equestre',
  'Séjour linguistique': 'linguistique',
  'Séjour scientifique': 'scientifique',
  'Séjour sportif': 'sportif',
  'Séjour itinérant': 'itinerant',
  "Séjour à l'étranger": 'etranger'
} as const;
const CATEGORY_VALUE_TO_LABEL = Object.fromEntries(
  Object.entries(CATEGORY_LABEL_TO_VALUE).map(([label, value]) => [value, label])
) as Record<(typeof CATEGORY_LABEL_TO_VALUE)[keyof typeof CATEGORY_LABEL_TO_VALUE], string>;

const LIVE_TRANSPORT_MODES = new Set([
  'Aller/Retour similaire',
  'Aller/Retour différencié',
  'Sans transport'
]);

const CATEGORY_NOISE_KEYS = new Set([
  'colonie de vacances',
  'colonies de vacances',
  'colo',
  'sejour',
  'sejour enfant',
  'sejour enfants',
  'sejour jeunes'
]);

const CATEGORY_ALIASES: Record<string, (typeof CATEGORY_LABEL_TO_VALUE)[keyof typeof CATEGORY_LABEL_TO_VALUE]> = {
  mer: 'mer',
  maritime: 'mer',
  nautique: 'mer',
  montagne: 'montagne',
  campagne: 'campagne',
  artistique: 'artistique',
  musique: 'artistique',
  danse: 'artistique',
  theatre: 'artistique',
  'arts plastiques': 'artistique',
  equestre: 'equestre',
  equitation: 'equestre',
  linguistique: 'linguistique',
  langue: 'linguistique',
  scientifique: 'scientifique',
  sciences: 'scientifique',
  sportif: 'sportif',
  sport: 'sportif',
  itinerant: 'itinerant',
  itinerance: 'itinerant',
  etranger: 'etranger',
  international: 'etranger'
};

function normalizeWhitespace(value: string | null | undefined): string {
  if (!value) return '';
  return value.replace(/\s+/g, ' ').trim();
}

function normalizeCategoryKey(value: string): string {
  return normalizeWhitespace(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function toNullableText(value: string | null | undefined): string | null {
  const normalized = normalizeWhitespace(value);
  return normalized.length > 0 ? normalized : null;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function asObject(value: Json | null): Record<string, unknown> {
  if (isPlainObject(value)) {
    return { ...value };
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (isPlainObject(parsed)) {
        return parsed;
      }
    } catch {
      return {};
    }
  }

  return {};
}

function asRecordArray(value: Json | null): Array<Record<string, unknown>> {
  if (Array.isArray(value)) {
    const output: Array<Record<string, unknown>> = [];
    for (const item of value) {
      if (isPlainObject(item)) {
        output.push(item);
      }
    }
    return output;
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (Array.isArray(parsed)) {
        const output: Array<Record<string, unknown>> = [];
        for (const item of parsed) {
          if (isPlainObject(item)) {
            output.push(item);
          }
        }
        return output;
      }
    } catch {
      return [];
    }
  }

  return [];
}

function asStringArray(value: Json | null): string[] {
  if (Array.isArray(value)) {
    return value
      .filter((item): item is string => typeof item === 'string')
      .map((item) => normalizeWhitespace(item))
      .filter(Boolean);
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (Array.isArray(parsed)) {
        return parsed
          .filter((item): item is string => typeof item === 'string')
          .map((item) => normalizeWhitespace(item))
          .filter(Boolean);
      }
    } catch {
      return [];
    }
  }

  return [];
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === 'string') {
    const normalized = value.trim().replace(/\s+/g, '').replace(',', '.');
    if (!normalized) return null;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function normalizeDateOnly(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const raw = value.trim();
  if (!raw) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return raw;
  }

  const parsed = new Date(raw);
  if (!Number.isFinite(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString().slice(0, 10);
}

function isMissingColumnError(message: string | undefined, columnName: string): boolean {
  if (!message) return false;
  const normalized = message.toLowerCase();
  return normalized.includes('column') && normalized.includes(columnName.toLowerCase());
}

function mapDraftCategoriesToLiveCategories(categories: string[] | null): {
  draftReceived: string[];
  liveValues: string[];
  liveLabels: string[];
  rejected: string[];
} {
  const input = categories ?? [];
  const normalizedLabelMap = new Map<string, (typeof CATEGORY_LABEL_TO_VALUE)[keyof typeof CATEGORY_LABEL_TO_VALUE]>(
    Object.entries(CATEGORY_LABEL_TO_VALUE).map(([label, value]) => [normalizeCategoryKey(label), value])
  );
  const mapped: string[] = [];
  const invalid: string[] = [];

  for (const item of input) {
    const chunks = String(item)
      .split(/[,;|/]+/g)
      .map((chunk) => normalizeWhitespace(chunk))
      .filter(Boolean);

    for (const chunk of chunks) {
      const key = normalizeCategoryKey(chunk);
      if (!key) continue;

      if (CATEGORY_NOISE_KEYS.has(key)) {
        continue;
      }

      const valueFromLabel = normalizedLabelMap.get(key);
      if (valueFromLabel) {
        mapped.push(valueFromLabel);
        continue;
      }

      const valueFromAlias = CATEGORY_ALIASES[key];
      if (valueFromAlias) {
        mapped.push(valueFromAlias);
        continue;
      }

      let matchedByContains = false;
      for (const [aliasKey, aliasValue] of Object.entries(CATEGORY_ALIASES)) {
        if (key.includes(aliasKey)) {
          mapped.push(aliasValue);
          matchedByContains = true;
          break;
        }
      }
      if (matchedByContains) {
        continue;
      }

      let isNoiseByContains = false;
      for (const noiseKey of Array.from(CATEGORY_NOISE_KEYS)) {
        if (key.includes(noiseKey)) {
          isNoiseByContains = true;
          break;
        }
      }
      if (isNoiseByContains) {
        continue;
      }

      invalid.push(chunk);
    }
  }

  const liveValues = Array.from(new Set(mapped));
  const liveLabels = liveValues.map(
    (value) =>
      CATEGORY_VALUE_TO_LABEL[
        value as (typeof CATEGORY_LABEL_TO_VALUE)[keyof typeof CATEGORY_LABEL_TO_VALUE]
      ]
  );

  return {
    draftReceived: input.map((item) => normalizeWhitespace(item)).filter(Boolean),
    liveValues,
    liveLabels,
    rejected: Array.from(new Set(invalid))
  };
}

function normalizeAges(ages: number[] | null, ageMin: number | null, ageMax: number | null): number[] {
  const fromArray = (ages ?? []).filter((age) => Number.isInteger(age) && age >= 3 && age <= 25);
  const sortedFromArray = Array.from(new Set(fromArray)).sort((a, b) => a - b);
  if (sortedFromArray.length > 0) {
    return sortedFromArray;
  }

  const min = typeof ageMin === 'number' && ageMin >= 3 && ageMin <= 25 ? ageMin : null;
  const max = typeof ageMax === 'number' && ageMax >= 3 && ageMax <= 25 ? ageMax : null;

  if (min !== null && max !== null) {
    const start = Math.min(min, max);
    const end = Math.max(min, max);
    const values: number[] = [];
    for (let age = start; age <= end; age += 1) {
      values.push(age);
    }
    return values;
  }

  if (min !== null) return [min];
  if (max !== null) return [max];

  return [];
}

function normalizeTransportMode(draftMode: string | null, hasTransportText: boolean, hasTransportOptions: boolean): string {
  const normalized = normalizeWhitespace(draftMode ?? '');
  if (normalized && LIVE_TRANSPORT_MODES.has(normalized)) {
    return normalized;
  }
  if (hasTransportText || hasTransportOptions) {
    return 'Aller/Retour similaire';
  }
  return 'Sans transport';
}

function parseSessions(value: Json | null): Array<{ startDate: string; endDate: string; status: SessionStatus; priceCents: number | null; currency: string }> {
  const rows = asRecordArray(value);
  const output: Array<{ startDate: string; endDate: string; status: SessionStatus; priceCents: number | null; currency: string }> = [];

  for (const row of rows) {
    const startDate = normalizeDateOnly(row.start_date);
    const endDate = normalizeDateOnly(row.end_date);
    if (!startDate || !endDate) continue;
    if (endDate < startDate) continue;

    const availability = normalizeWhitespace(String(row.availability ?? '')).toLowerCase();
    const status: SessionStatus = availability === 'full' ? 'FULL' : 'OPEN';

    const price = toNumber(row.price);
    const currency = normalizeWhitespace(String(row.currency ?? 'EUR')).toUpperCase() || 'EUR';
    const priceCents = price !== null && price >= 0 ? Math.round(price * 100) : null;

    output.push({
      startDate,
      endDate,
      status,
      priceCents,
      currency
    });
  }

  return output;
}

function parseExtraOptions(value: Json | null): Array<{ label: string; amountCents: number }> {
  const rows = asRecordArray(value);
  const output: Array<{ label: string; amountCents: number }> = [];

  for (const row of rows) {
    const label = normalizeWhitespace(String(row.label ?? ''));
    if (!label) continue;

    const price = toNumber(row.price);
    if (price === null || price < 0) continue;

    output.push({
      label,
      amountCents: Math.round(price * 100)
    });
  }

  return output;
}

function parseTransportOptions(value: Json | null): Array<{ city: string; amountCents: number }> {
  const rows = asRecordArray(value);
  const output: Array<{ city: string; amountCents: number }> = [];

  for (const row of rows) {
    const city = normalizeWhitespace(
      String(row.label ?? row.city ?? row.departure_city ?? row.return_city ?? '')
    );
    if (!city) continue;

    const price = toNumber(row.price);
    const amountCents = price !== null && price >= 0 ? Math.round(price * 100) : 0;

    output.push({ city, amountCents });
  }

  return output;
}

function parseAccommodation(value: Json | null): { title: string; description: string | null } | null {
  const object = asObject(value);
  if (Object.keys(object).length === 0) return null;

  const title = normalizeWhitespace(String(object.title ?? ''));
  const description = toNullableText(String(object.description ?? ''));

  if (!title && !description) {
    return null;
  }

  return {
    title: title || 'Hébergement',
    description
  };
}

function readLivePublication(rawPayload: Record<string, unknown>): {
  stayId: string | null;
  accommodationId: string | null;
} {
  const live = rawPayload.live_publication;
  if (!isPlainObject(live)) {
    return { stayId: null, accommodationId: null };
  }

  return {
    stayId: typeof live.stay_id === 'string' ? live.stay_id : null,
    accommodationId: typeof live.accommodation_id === 'string' ? live.accommodation_id : null
  };
}

async function resolveSeasonId(supabase: SupabaseClient<Database>): Promise<string> {
  const { data: seasons, error } = await supabase.from('seasons').select('id,name');
  if (error) {
    throw new PublishStayDraftError('resolve-season', error.message);
  }

  const list = seasons ?? [];
  if (list.length === 0) {
    throw new PublishStayDraftError('resolve-season', 'Aucune saison disponible.');
  }

  const month = new Date().getMonth() + 1;
  const targetName =
    month >= 12 || month <= 2
      ? 'Hiver'
      : month >= 3 && month <= 5
        ? 'Printemps'
        : month >= 6 && month <= 8
          ? 'Été'
          : 'Automne';

  return list.find((season) => season.name === targetName)?.id ?? list[0].id;
}

async function findExistingStayBySourceUrl(
  supabase: SupabaseClient<Database>,
  organizerId: string,
  sourceUrl: string
): Promise<string | null> {
  const dynamicFrom = supabase.from('stays') as unknown as {
    select: (columns: string) => {
      eq: (column: string, value: string) => {
        eq: (column: string, value: string) => {
          limit: (value: number) => {
            maybeSingle: () => Promise<{ data: { id: string } | null; error: { message?: string } | null }>;
          };
        };
      };
    };
  };

  try {
    const { data, error } = await dynamicFrom
      .select('id')
      .eq('organizer_id', organizerId)
      .eq('source_url', sourceUrl)
      .limit(1)
      .maybeSingle();

    if (error) {
      if (isMissingColumnError(error.message, 'source_url')) {
        return null;
      }
      throw new PublishStayDraftError('find-stay-by-source-url', error.message ?? 'Erreur inconnue.');
    }

    return data?.id ?? null;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erreur inconnue.';
    if (isMissingColumnError(message, 'source_url')) {
      return null;
    }
    throw new PublishStayDraftError('find-stay-by-source-url', message);
  }
}

async function updateOrInsertStay(
  supabase: SupabaseClient<Database>,
  draft: StayDraftRow,
  stayId: string | null,
  mappedCategories: string[],
  ages: number[],
  transportMode: string
): Promise<string> {
  const now = new Date().toISOString();
  const ageMin = ages.length > 0 ? ages[0] : draft.age_min;
  const ageMax = ages.length > 0 ? ages[ages.length - 1] : draft.age_max;

  const basePayload: StayUpdate = {
    title: normalizeWhitespace(draft.title ?? ''),
    description: toNullableText(draft.description),
    summary: toNullableText(draft.summary),
    activities_text: toNullableText(draft.activities_text),
    program_text: toNullableText(draft.program_text),
    supervision_text: toNullableText(draft.supervision_text),
    required_documents_text: toNullableText(draft.required_documents_text),
    location_text: toNullableText(draft.location_text),
    region_text: toNullableText(draft.region_text),
    age_min: ageMin ?? null,
    age_max: ageMax ?? null,
    ages,
    categories: mappedCategories,
    transport_mode: transportMode,
    transport_text: toNullableText(draft.transport_text),
    status: 'PUBLISHED' as StayStatus,
    updated_at: now
  };

  if (!basePayload.title) {
    throw new PublishStayDraftError('validate-title', 'Le titre est requis pour publier.');
  }

  if (stayId) {
    const updateWithSourceUrl = {
      ...basePayload,
      source_url: draft.source_url
    };

    const dynamicUpdate = supabase.from('stays') as unknown as {
      update: (payload: Record<string, unknown>) => {
        eq: (column: string, value: string) => {
          eq: (column: string, value: string) => Promise<{ error: { message?: string } | null }>;
        };
      };
    };

    const firstTry = await dynamicUpdate
      .update(updateWithSourceUrl)
      .eq('id', stayId)
      .eq('organizer_id', draft.organizer_id);

    if (firstTry.error && !isMissingColumnError(firstTry.error.message, 'source_url')) {
      throw new PublishStayDraftError('update-stay', firstTry.error.message ?? 'Impossible de mettre à jour le séjour.');
    }

    if (firstTry.error && isMissingColumnError(firstTry.error.message, 'source_url')) {
      const { error: fallbackError } = await supabase
        .from('stays')
        .update(basePayload)
        .eq('id', stayId)
        .eq('organizer_id', draft.organizer_id);

      if (fallbackError) {
        throw new PublishStayDraftError('update-stay', fallbackError.message);
      }
    }

    return stayId;
  }

  const seasonId = await resolveSeasonId(supabase);
  const insertPayload: StayInsert = {
    organizer_id: draft.organizer_id,
    season_id: seasonId,
    title: basePayload.title,
    description: basePayload.description ?? null,
    summary: basePayload.summary ?? null,
    activities_text: basePayload.activities_text ?? null,
    program_text: basePayload.program_text ?? null,
    supervision_text: basePayload.supervision_text ?? null,
    required_documents_text: basePayload.required_documents_text ?? null,
    location_text: basePayload.location_text ?? null,
    region_text: basePayload.region_text ?? null,
    age_min: basePayload.age_min ?? null,
    age_max: basePayload.age_max ?? null,
    ages,
    categories: mappedCategories,
    transport_mode: transportMode,
    transport_text: basePayload.transport_text ?? null,
    status: 'PUBLISHED'
  };

  const dynamicInsert = supabase.from('stays') as unknown as {
    insert: (payload: Record<string, unknown>) => {
      select: (columns: string) => {
        single: () => Promise<{ data: { id: string } | null; error: { message?: string } | null }>;
      };
    };
  };

  const insertWithSourceUrl = {
    ...insertPayload,
    source_url: draft.source_url
  };

  const firstTry = await dynamicInsert.insert(insertWithSourceUrl).select('id').single();

  if (firstTry.error && !isMissingColumnError(firstTry.error.message, 'source_url')) {
    throw new PublishStayDraftError('insert-stay', firstTry.error.message ?? 'Impossible de créer le séjour.');
  }

  if (!firstTry.error && firstTry.data?.id) {
    return firstTry.data.id;
  }

  const fallbackTry = await supabase.from('stays').insert(insertPayload).select('id').single();
  if (fallbackTry.error || !fallbackTry.data?.id) {
    throw new PublishStayDraftError('insert-stay', fallbackTry.error?.message ?? 'Impossible de créer le séjour.');
  }

  return fallbackTry.data.id;
}

async function syncSessions(
  supabase: SupabaseClient<Database>,
  stayId: string,
  sessions: Array<{ startDate: string; endDate: string; status: SessionStatus; priceCents: number | null; currency: string }>
): Promise<void> {
  const { data: existingSessions, error: listError } = await supabase
    .from('sessions')
    .select('id')
    .eq('stay_id', stayId);

  if (listError) {
    throw new PublishStayDraftError('list-sessions', listError.message);
  }

  const existingSessionIds = (existingSessions ?? []).map((item) => item.id);

  if (existingSessionIds.length > 0) {
    const { error: deletePricesError } = await supabase
      .from('session_prices')
      .delete()
      .in('session_id', existingSessionIds);

    if (deletePricesError) {
      throw new PublishStayDraftError('delete-session-prices', deletePricesError.message);
    }
  }

  const { error: deleteSessionsError } = await supabase
    .from('sessions')
    .delete()
    .eq('stay_id', stayId);

  if (deleteSessionsError) {
    throw new PublishStayDraftError('delete-sessions', deleteSessionsError.message);
  }

  for (const session of sessions) {
    const insertSessionPayload: SessionInsert = {
      stay_id: stayId,
      start_date: session.startDate,
      end_date: session.endDate,
      status: session.status,
      capacity_total: 0,
      capacity_reserved: 0
    };

    const { data: createdSession, error: createSessionError } = await supabase
      .from('sessions')
      .insert(insertSessionPayload)
      .select('id')
      .single();

    if (createSessionError || !createdSession) {
      throw new PublishStayDraftError(
        'insert-session',
        createSessionError?.message ?? 'Impossible de créer une session.'
      );
    }

    if (session.priceCents !== null) {
      const { error: priceError } = await supabase.from('session_prices').insert({
        session_id: createdSession.id,
        amount_cents: session.priceCents,
        currency: session.currency || 'EUR'
      });

      if (priceError) {
        throw new PublishStayDraftError('insert-session-price', priceError.message);
      }
    }
  }
}

async function syncStayMedia(
  supabase: SupabaseClient<Database>,
  stayId: string,
  images: string[]
): Promise<void> {
  const { error: deleteError } = await supabase.from('stay_media').delete().eq('stay_id', stayId);
  if (deleteError) {
    throw new PublishStayDraftError('delete-stay-media', deleteError.message);
  }

  if (images.length === 0) {
    return;
  }

  const rows: StayMediaInsert[] = images.map((url, index) => ({
    stay_id: stayId,
    url,
    position: index + 1,
    media_type: index === 0 ? 'cover' : 'gallery'
  }));

  const { error: insertError } = await supabase.from('stay_media').insert(rows);
  if (insertError) {
    throw new PublishStayDraftError('insert-stay-media', insertError.message);
  }
}

async function syncExtraOptions(
  supabase: SupabaseClient<Database>,
  stayId: string,
  options: Array<{ label: string; amountCents: number }>
): Promise<void> {
  const { error: deleteError } = await supabase
    .from('stay_extra_options')
    .delete()
    .eq('stay_id', stayId);

  if (deleteError) {
    throw new PublishStayDraftError('delete-extra-options', deleteError.message);
  }

  if (options.length === 0) {
    return;
  }

  const rows: ExtraOptionInsert[] = options.map((option, index) => ({
    stay_id: stayId,
    label: option.label,
    amount_cents: option.amountCents,
    position: index + 1
  }));

  const { error: insertError } = await supabase.from('stay_extra_options').insert(rows);
  if (insertError) {
    throw new PublishStayDraftError('insert-extra-options', insertError.message);
  }
}

async function syncTransportOptions(
  supabase: SupabaseClient<Database>,
  stayId: string,
  options: Array<{ city: string; amountCents: number }>
): Promise<void> {
  const { error: deleteError } = await supabase
    .from('transport_options')
    .delete()
    .eq('stay_id', stayId);

  if (deleteError) {
    throw new PublishStayDraftError('delete-transport-options', deleteError.message);
  }

  if (options.length === 0) {
    return;
  }

  const rows: TransportOptionInsert[] = options.map((option) => ({
    stay_id: stayId,
    session_id: null,
    departure_city: option.city,
    return_city: option.city,
    amount_cents: option.amountCents
  }));

  const { error: insertError } = await supabase.from('transport_options').insert(rows);
  if (insertError) {
    throw new PublishStayDraftError('insert-transport-options', insertError.message);
  }
}

async function syncAccommodation(
  supabase: SupabaseClient<Database>,
  draft: StayDraftRow,
  stayId: string,
  currentAccommodationId: string | null,
  parsedAccommodation: { title: string; description: string | null } | null
): Promise<string | null> {
  const { error: deleteLinksError } = await supabase
    .from('stay_accommodations')
    .delete()
    .eq('stay_id', stayId);

  if (deleteLinksError) {
    throw new PublishStayDraftError('delete-stay-accommodations', deleteLinksError.message);
  }

  if (!parsedAccommodation) {
    return currentAccommodationId ?? null;
  }

  const now = new Date().toISOString();
  let accommodationId = currentAccommodationId;

  if (accommodationId) {
    const updatePayload: AccommodationUpdate = {
      name: parsedAccommodation.title,
      description: parsedAccommodation.description,
      source_url: draft.source_url,
      updated_at: now
    };

    const { data: updatedAccommodation, error: updateError } = await supabase
      .from('accommodations')
      .update(updatePayload)
      .eq('id', accommodationId)
      .eq('organizer_id', draft.organizer_id)
      .select('id')
      .maybeSingle();

    if (updateError) {
      throw new PublishStayDraftError('update-accommodation', updateError.message);
    }

    if (!updatedAccommodation?.id) {
      accommodationId = null;
    }
  }

  if (!accommodationId) {
    const insertPayload: AccommodationInsert = {
      organizer_id: draft.organizer_id,
      name: parsedAccommodation.title,
      description: parsedAccommodation.description,
      source_url: draft.source_url,
      accommodation_type: 'centre',
      status: 'DRAFT',
      created_at: now,
      updated_at: now
    };

    const { data: insertedAccommodation, error: insertError } = await supabase
      .from('accommodations')
      .insert(insertPayload)
      .select('id')
      .single();

    if (insertError || !insertedAccommodation) {
      throw new PublishStayDraftError(
        'insert-accommodation',
        insertError?.message ?? "Impossible de créer l'hébergement."
      );
    }

    accommodationId = insertedAccommodation.id;
  }

  const { error: insertLinkError } = await supabase.from('stay_accommodations').insert({
    stay_id: stayId,
    accommodation_id: accommodationId
  });

  if (insertLinkError) {
    throw new PublishStayDraftError('insert-stay-accommodation-link', insertLinkError.message);
  }

  return accommodationId;
}

async function resolveStayId(
  supabase: SupabaseClient<Database>,
  draft: StayDraftRow,
  rawPayload: Record<string, unknown>
): Promise<string | null> {
  const livePublication = readLivePublication(rawPayload);

  if (livePublication.stayId) {
    const { data: linkedStay, error } = await supabase
      .from('stays')
      .select('id')
      .eq('id', livePublication.stayId)
      .eq('organizer_id', draft.organizer_id)
      .maybeSingle();

    if (error) {
      throw new PublishStayDraftError('resolve-linked-stay', error.message);
    }

    if (linkedStay?.id) {
      return linkedStay.id;
    }
  }

  const bySourceUrl = await findExistingStayBySourceUrl(supabase, draft.organizer_id, draft.source_url);
  if (bySourceUrl) {
    return bySourceUrl;
  }

  return null;
}

export async function publishStayDraftToLive(
  input: PublishStayDraftToLiveInput
): Promise<PublishStayDraftToLiveResult> {
  const { supabase, draft } = input;
  console.info('[publish-stay-draft] entrée', {
    draftId: draft.id,
    organizerId: draft.organizer_id,
    status: draft.status,
    validatedAt: draft.validated_at
  });

  if (draft.status !== 'validated') {
    throw new PublishStayDraftError(
      'validate-draft-status',
      "Le draft doit être validé avant la publication live."
    );
  }

  const title = normalizeWhitespace(draft.title ?? '');
  if (!title) {
    throw new PublishStayDraftError('validate-title', 'Le titre est requis pour publier.');
  }

  const categoryMapping = mapDraftCategoriesToLiveCategories(draft.categories);
  const categories = categoryMapping.liveValues;
  const ages = normalizeAges(draft.ages, draft.age_min, draft.age_max);
  const sessions = parseSessions(draft.sessions_json);
  const extraOptions = parseExtraOptions(draft.extra_options_json);
  const transportOptions = parseTransportOptions(draft.transport_options_json);
  const accommodation = parseAccommodation(draft.accommodations_json);
  const images = Array.from(
    new Set(asStringArray(draft.images).filter((url) => /^https?:\/\//i.test(url)))
  ).slice(0, 20);

  const rawPayload = asObject(draft.raw_payload);
  const livePublication = readLivePublication(rawPayload);
  console.info('[publish-stay-draft] mapping catégories', {
    draftId: draft.id,
    draftCategories: categoryMapping.draftReceived,
    liveCategories: categoryMapping.liveLabels,
    rejectedCategories: categoryMapping.rejected
  });
  if (categories.length === 0) {
    console.warn('[publish-stay-draft] no-valid-live-category-after-mapping', {
      draftId: draft.id,
      draftCategories: categoryMapping.draftReceived
    });
  }
  console.info('[publish-stay-draft] draft validé, parsing terminé', {
    draftId: draft.id,
    categories: categoryMapping.liveLabels,
    ages: ages.length,
    sessions: sessions.length,
    extraOptions: extraOptions.length,
    transportOptions: transportOptions.length,
    images: images.length,
    hasAccommodation: Boolean(accommodation),
    linkedStayIdInRaw: livePublication.stayId
  });

  const transportMode = normalizeTransportMode(
    draft.transport_mode,
    Boolean(toNullableText(draft.transport_text)),
    transportOptions.length > 0
  );

  const resolvedStayId = await resolveStayId(supabase, draft, rawPayload);
  console.info('[publish-stay-draft] résolution du stay live', {
    draftId: draft.id,
    resolvedStayId
  });

  const stayId = await updateOrInsertStay(
    supabase,
    draft,
    resolvedStayId,
    categories,
    ages,
    transportMode
  );
  console.info('[publish-stay-draft] stay upserté', {
    draftId: draft.id,
    stayId
  });

  const syncedTables = ['stays'] as string[];

  console.info('[publish-stay-draft] sync sessions', { stayId, sessions: sessions.length });
  await syncSessions(supabase, stayId, sessions);
  syncedTables.push('sessions', 'session_prices');

  console.info('[publish-stay-draft] sync médias', { stayId, images: images.length });
  await syncStayMedia(supabase, stayId, images);
  syncedTables.push('stay_media');

  console.info('[publish-stay-draft] sync options extras', { stayId, extraOptions: extraOptions.length });
  await syncExtraOptions(supabase, stayId, extraOptions);
  syncedTables.push('stay_extra_options');

  console.info('[publish-stay-draft] sync options transport', {
    stayId,
    transportOptions: transportOptions.length
  });
  await syncTransportOptions(supabase, stayId, transportOptions);
  syncedTables.push('transport_options');

  console.info('[publish-stay-draft] sync hébergement', {
    stayId,
    hasAccommodation: Boolean(accommodation)
  });
  const accommodationId = await syncAccommodation(
    supabase,
    draft,
    stayId,
    livePublication.accommodationId,
    accommodation
  );
  syncedTables.push('stay_accommodations', 'accommodations');

  const publishedAt = new Date().toISOString();
  const nextLivePublication: LivePublication = {
    stay_id: stayId,
    published_at: publishedAt,
    synced_tables: Array.from(new Set(syncedTables)),
    accommodation_id: accommodationId
  };

  const nextRawPayload: Record<string, unknown> = {
    ...rawPayload,
    live_publication: nextLivePublication,
    published_at: publishedAt,
    publish_error: null
  };

  console.info('[publish-stay-draft] sortie succès', {
    draftId: draft.id,
    stayId,
    publishedAt,
    syncedTables: nextLivePublication.synced_tables,
    accommodationId
  });

  return {
    stayId,
    publishedAt,
    syncedTables: nextLivePublication.synced_tables,
    rawPayload: nextRawPayload
  };
}
