import { cache } from 'react';
import { NextRequest } from 'next/server';
import { formatAccommodationType } from '@/lib/accommodation-types';
import { extractAccommodationLocationMeta } from '@/lib/accommodation-location';
import { FILTER_LABELS } from '@/lib/constants';
import { normalizeStayCategories } from '@/lib/stay-categories';
import { deriveStayAudiences, formatStayAgeRange } from '@/lib/stay-ages';
import { normalizeStayTitle } from '@/lib/stay-title';
import { getServerSupabaseClient } from '@/lib/supabase/server';
import { slugify } from '@/lib/utils';
import type {
  Stay,
  StayDuration,
  StaySearchParams,
  StaySessionOption,
  StayExtraOption,
  StayInsuranceOption,
  StayTransportOption
} from '@/types/stay';
import type { Database } from '@/types/supabase';

type PeriodKey = keyof typeof FILTER_LABELS.periods;
type TransportKey = keyof typeof FILTER_LABELS.transport;
type OrganizerRow = Pick<
  Database['public']['Tables']['organizers']['Row'],
  'id' | 'name' | 'logo_path' | 'slug' | 'website_url'
>;
type SeasonRow = Pick<Database['public']['Tables']['seasons']['Row'], 'id' | 'name' | 'start_date'>;
type StayMediaRow = Pick<Database['public']['Tables']['stay_media']['Row'], 'url' | 'position' | 'media_type'>;
type SessionRow = Pick<Database['public']['Tables']['sessions']['Row'], 'start_date' | 'end_date'>;
type SessionPriceRow = Pick<
  Database['public']['Tables']['session_prices']['Row'],
  'amount_cents' | 'currency'
>;
type TransportOptionRow = Pick<
  Database['public']['Tables']['transport_options']['Row'],
  'id' | 'departure_city' | 'return_city' | 'amount_cents' | 'stay_id' | 'session_id'
>;
type InsuranceOptionRow = Pick<
  Database['public']['Tables']['insurance_options']['Row'],
  'id' | 'label' | 'amount_cents' | 'percent_value' | 'pricing_mode' | 'stay_id'
>;
type ExtraOptionRow = Pick<
  Database['public']['Tables']['stay_extra_options']['Row'],
  'id' | 'stay_id' | 'label' | 'amount_cents' | 'position'
>;
type SessionWithOptionsRow = Pick<
  Database['public']['Tables']['sessions']['Row'],
  'id' | 'stay_id' | 'start_date' | 'end_date' | 'status' | 'capacity_total' | 'capacity_reserved'
> & {
  session_prices: SessionPriceRow[] | SessionPriceRow | null;
};
type AccommodationRow = Pick<
  Database['public']['Tables']['accommodations']['Row'],
  | 'id'
  | 'name'
  | 'accommodation_type'
  | 'description'
  | 'bed_info'
  | 'bathroom_info'
  | 'catering_info'
  | 'accessibility_info'
>;
type StayAccommodationRow = Pick<
  Database['public']['Tables']['stay_accommodations']['Row'],
  'stay_id' | 'accommodation_id'
>;
type StayWithoutCanonical = Omit<Stay, 'canonicalSlug' | 'legacySlugs'>;
type StaySlugResolution = {
  stay: Stay;
  requestedSlug: string;
  canonicalSlug: string;
  canonicalPath: string;
  isCanonical: boolean;
};

const DAY_MS = 1000 * 60 * 60 * 24;
const STAY_SLUG_SUFFIX_LENGTH = 8;
const STAY_PATH_PREFIX = '/sejours';

function getEffectiveSessionStatus(
  session: Pick<
    SessionWithOptionsRow,
    'status' | 'capacity_total' | 'capacity_reserved'
  >
): SessionWithOptionsRow['status'] {
  if (session.status === 'COMPLETED' || session.status === 'ARCHIVED' || session.status === 'FULL') {
    return session.status;
  }

  if (session.capacity_reserved >= session.capacity_total) {
    return 'FULL';
  }

  return session.status;
}

function deriveSessionDurations(sessions: SessionRow[] | null | undefined) {
  if (!sessions || sessions.length === 0) return [];
  return sessions
    .map((session) => {
      const start = new Date(session.start_date).getTime();
      const end = new Date(session.end_date).getTime();
      if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
      const diff = Math.max(0, Math.round((end - start) / DAY_MS));
      return diff + 1;
    })
    .filter((value): value is number => typeof value === 'number' && value > 0);
}

function deriveDurationBounds(days: number[]) {
  if (!days.length) return null;
  return {
    min: Math.min(...days),
    max: Math.max(...days)
  };
}

function formatDurationLabel(days: number[]) {
  const bounds = deriveDurationBounds(days);
  if (!bounds) return 'Durée à venir';
  if (bounds.min === bounds.max) {
    return bounds.min === 1 ? '1 jour' : `${bounds.min} jours`;
  }
  return `${bounds.min} à ${bounds.max} jours`;
}

function deriveDurationFilters(days: number[]): StayDuration[] {
  const durations = new Set<StayDuration>();

  for (const dayCount of days) {
    if (dayCount <= 4) {
      durations.add('mini-sejour');
    } else if (dayCount <= 7) {
      durations.add('semaine');
    } else if (dayCount <= 14) {
      durations.add('quinzaine');
    } else {
      durations.add('long');
    }
  }

  return Array.from(durations);
}

function derivePeriods(sessions: SessionRow[] | null | undefined): {
  keys: Stay['filters']['periods'];
  labels: string[];
} {
  if (!sessions || sessions.length === 0) {
    return { keys: [], labels: [] };
  }
  const periodKeys = new Set<PeriodKey>();
  sessions.forEach((session) => {
    const date = new Date(session.start_date);
    if (!Number.isFinite(date.getTime())) return;
    const month = date.getMonth() + 1;
    if (month === 10) {
      periodKeys.add('toussaint');
    } else if (month >= 12 || month <= 2) {
      periodKeys.add('hiver');
    } else if (month >= 3 && month <= 5) {
      periodKeys.add('printemps');
    } else if (month >= 6 && month <= 8) {
      periodKeys.add('ete');
    } else {
      periodKeys.add('automne');
    }
  });
  const keys = Array.from(periodKeys);
  const labels = keys.map((key) => FILTER_LABELS.periods[key]);
  return { keys, labels };
}

function mapTransport(transportMode?: string | null): TransportKey[] {
  if (!transportMode) return [];
  const normalized = transportMode.trim();
  const directMatch = Object.keys(FILTER_LABELS.transport).find((value) => value === normalized);
  if (directMatch) {
    return [directMatch as TransportKey];
  }

  const value = normalized.toLowerCase();
  if (value.includes('sans') || value.includes('aucun') || value === 'none') {
    return ['Sans transport'];
  }
  if (value.includes('diff') || value === 'one_way') {
    return ['Aller/Retour différencié'];
  }
  if (value.includes('simil') || value === 'round_trip') {
    return ['Aller/Retour similaire'];
  }

  return [];
}

function buildSummary(title: string, description?: string | null) {
  if (!description) return title;
  const line = description.split('\n').find((item) => item.trim().length > 0);
  return line ? line.trim() : description.trim();
}

function buildAccommodationText(accommodations: AccommodationRow[]) {
  if (!accommodations.length) return '';

  return accommodations
    .map((accommodation) => {
      const locationMeta = extractAccommodationLocationMeta(accommodation.description);
      const details = [
        formatAccommodationType(accommodation.accommodation_type),
        locationMeta.locationLabel,
        locationMeta.description,
        accommodation.bed_info,
        accommodation.bathroom_info,
        accommodation.catering_info,
        accommodation.accessibility_info
      ]
        .filter(Boolean)
        .join('\n');

      return [accommodation.name, details].filter(Boolean).join('\n');
    })
    .join('\n\n');
}

function isInsuranceLikeLabel(label: string | null | undefined) {
  if (!label) return false;
  return /(assur|annulation|rapatriement|multirisque)/i.test(label);
}

function normalizeStaySlug(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? '';
}

function normalizeStaySeoText(value: string | null | undefined) {
  const normalized = value?.trim() ?? '';
  return normalized || undefined;
}

function normalizeStaySeoTags(values: string[] | null | undefined) {
  const seen = new Set<string>();
  const output: string[] = [];

  for (const value of values ?? []) {
    const normalized = value?.trim();
    if (!normalized) continue;
    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(normalized);
  }

  return output;
}

function normalizeStaySeoScore(value: number | null | undefined) {
  if (!Number.isFinite(value)) return undefined;
  const clamped = Math.max(0, Math.min(100, Math.round(Number(value))));
  return clamped;
}

function normalizeStaySeoChecks(value: Database['public']['Tables']['stays']['Row']['seo_checks']) {
  if (!Array.isArray(value)) return undefined;
  const checks = (value as unknown[])
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
    .map((item) => {
      const code = typeof item.code === 'string' ? item.code.trim() : '';
      const level = item.level === 'ok' || item.level === 'warning' || item.level === 'info' ? item.level : null;
      const message = typeof item.message === 'string' ? item.message.trim() : '';
      if (!code || !level || !message) return null;
      return { code, level, message } as const;
    })
    .filter((item): item is { code: string; level: 'ok' | 'warning' | 'info'; message: string } => Boolean(item));

  return checks.length > 0 ? checks : undefined;
}

function buildStaySlugSuffix(stayId: string) {
  const normalized = stayId.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (normalized.length >= STAY_SLUG_SUFFIX_LENGTH) {
    return normalized.slice(0, STAY_SLUG_SUFFIX_LENGTH);
  }
  return (normalized || 'stay').padEnd(STAY_SLUG_SUFFIX_LENGTH, '0').slice(0, STAY_SLUG_SUFFIX_LENGTH);
}

function reserveUniqueSlug(baseCandidate: string, used: Set<string>) {
  const initial = normalizeStaySlug(baseCandidate) || 'sejour';
  if (!used.has(initial)) {
    used.add(initial);
    return initial;
  }

  let suffix = 2;
  let candidate = `${initial}-${suffix}`;
  while (used.has(candidate)) {
    suffix += 1;
    candidate = `${initial}-${suffix}`;
  }
  used.add(candidate);
  return candidate;
}

function applyCanonicalStaySlugs(stays: StayWithoutCanonical[]): Stay[] {
  const byBaseSlug = new Map<string, StayWithoutCanonical[]>();
  const sortedById = [...stays].sort((left, right) => left.id.localeCompare(right.id, 'fr'));

  for (const stay of sortedById) {
    const baseSlug = normalizeStaySlug(stay.slug) || stay.id;
    const group = byBaseSlug.get(baseSlug) ?? [];
    group.push(stay);
    byBaseSlug.set(baseSlug, group);
  }

  const canonicalSlugById = new Map<string, string>();
  const legacySlugsById = new Map<string, string[]>();
  const reservedCanonicalSlugs = new Set<string>();

  for (const [baseSlug, group] of Array.from(byBaseSlug.entries())) {
    if (group.length === 1) {
      const stay = group[0];
      const canonicalSlug = reserveUniqueSlug(baseSlug, reservedCanonicalSlugs);
      canonicalSlugById.set(stay.id, canonicalSlug);
      const legacySlugs =
        canonicalSlug !== baseSlug && baseSlug
          ? [baseSlug]
          : [];
      legacySlugsById.set(stay.id, legacySlugs);
      continue;
    }

    // When several stays collide on the same base slug, suffix each canonical slug
    // with a deterministic short id to guarantee uniqueness and stability.
    for (const stay of group) {
      const suffix = buildStaySlugSuffix(stay.id);
      const canonicalSlug = reserveUniqueSlug(`${baseSlug}-${suffix}`, reservedCanonicalSlugs);
      canonicalSlugById.set(stay.id, canonicalSlug);
      legacySlugsById.set(stay.id, []);
    }

    // Keep one deterministic alias for the legacy unsuffixed slug to preserve
    // the old entry point with a permanent redirect.
    const primary = group[0];
    const primaryLegacy = legacySlugsById.get(primary.id) ?? [];
    if (baseSlug) {
      primaryLegacy.push(baseSlug);
    }
    legacySlugsById.set(primary.id, primaryLegacy);
  }

  return stays.map((stay) => {
    const canonicalSlug =
      canonicalSlugById.get(stay.id) ?? (normalizeStaySlug(stay.slug) || stay.id);
    const dedupedLegacySlugs = Array.from(
      new Set(
        (legacySlugsById.get(stay.id) ?? [])
          .map((slug) => normalizeStaySlug(slug))
          .filter((slug) => slug && slug !== canonicalSlug)
      )
    );

    return {
      ...stay,
      slug: canonicalSlug,
      canonicalSlug,
      legacySlugs: dedupedLegacySlugs
    };
  });
}

function validateStaysSeoCatalog(stays: Stay[]) {
  const errors: string[] = [];
  const canonicalSlugToStayId = new Map<string, string>();

  for (const stay of stays) {
    if (!stay.id) {
      errors.push('Séjour sans id.');
      continue;
    }
    if (!stay.canonicalSlug) {
      errors.push(`Séjour ${stay.id}: canonicalSlug manquant.`);
    }
    if (!stay.title.trim()) {
      errors.push(`Séjour ${stay.id}: title manquant.`);
    }
    if (!stay.summary.trim()) {
      errors.push(`Séjour ${stay.id}: summary manquant.`);
    }

    const normalizedCanonical = normalizeStaySlug(stay.canonicalSlug);
    if (canonicalSlugToStayId.has(normalizedCanonical)) {
      errors.push(
        `Conflit canonicalSlug "${stay.canonicalSlug}" entre ${canonicalSlugToStayId.get(normalizedCanonical)} et ${stay.id}.`
      );
    } else {
      canonicalSlugToStayId.set(normalizedCanonical, stay.id);
    }

    if ((stay.legacySlugs ?? []).some((legacySlug) => normalizeStaySlug(legacySlug) === normalizedCanonical)) {
      errors.push(`Séjour ${stay.id}: un legacySlug est identique au canonicalSlug.`);
    }
  }

  if (errors.length === 0) return;

  const message = `SEO séjours invalide:\n${errors.map((error) => `- ${error}`).join('\n')}`;
  if (process.env.NODE_ENV === 'production') {
    console.error(message);
    return;
  }
  throw new Error(message);
}

function buildStaySlugIndex(stays: Stay[]) {
  const stayById = new Map(stays.map((stay) => [stay.id, stay]));
  const canonicalBySlug = new Map<string, Stay>();
  for (const stay of stays) {
    canonicalBySlug.set(normalizeStaySlug(stay.canonicalSlug), stay);
  }

  const aliasCandidates = new Map<string, string[]>();
  for (const stay of stays) {
    for (const aliasRaw of stay.legacySlugs ?? []) {
      const alias = normalizeStaySlug(aliasRaw);
      if (!alias || alias === normalizeStaySlug(stay.canonicalSlug)) continue;
      const stayIds = aliasCandidates.get(alias) ?? [];
      stayIds.push(stay.id);
      aliasCandidates.set(alias, stayIds);
    }
  }

  const aliasToStay = new Map<string, Stay>();
  for (const [alias, stayIds] of Array.from(aliasCandidates.entries())) {
    if (stayIds.length !== 1) continue;
    const stay = stayById.get(stayIds[0]);
    if (!stay) continue;
    aliasToStay.set(alias, stay);
  }

  return { canonicalBySlug, aliasToStay };
}

export function getStayCanonicalPath(stayOrCanonicalSlug: Pick<Stay, 'canonicalSlug'> | string) {
  const canonicalSlug =
    typeof stayOrCanonicalSlug === 'string'
      ? normalizeStaySlug(stayOrCanonicalSlug)
      : normalizeStaySlug(stayOrCanonicalSlug.canonicalSlug);
  return `${STAY_PATH_PREFIX}/${canonicalSlug}`;
}

export function resolveStayFromSlug(stays: Stay[], requestedSlug: string): StaySlugResolution | null {
  const normalizedRequestedSlug = normalizeStaySlug(requestedSlug);
  if (!normalizedRequestedSlug) return null;

  const { canonicalBySlug, aliasToStay } = buildStaySlugIndex(stays);
  const canonicalMatch = canonicalBySlug.get(normalizedRequestedSlug);
  if (canonicalMatch) {
    return {
      stay: canonicalMatch,
      requestedSlug: normalizedRequestedSlug,
      canonicalSlug: canonicalMatch.canonicalSlug,
      canonicalPath: getStayCanonicalPath(canonicalMatch),
      isCanonical: true
    };
  }

  const aliasMatch = aliasToStay.get(normalizedRequestedSlug);
  if (!aliasMatch) return null;

  return {
    stay: aliasMatch,
    requestedSlug: normalizedRequestedSlug,
    canonicalSlug: aliasMatch.canonicalSlug,
    canonicalPath: getStayCanonicalPath(aliasMatch),
    isCanonical: false
  };
}

export async function resolveStayBySlug(requestedSlug: string): Promise<StaySlugResolution | null> {
  const stays = await getStays();
  return resolveStayFromSlug(stays, requestedSlug);
}

async function fetchStaysFromSupabase(): Promise<Stay[]> {
  const supabase = getServerSupabaseClient();

  const { data, error } = await supabase
    .from('stays')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Erreur Supabase (stays)', error.message);
    return [];
  }

  const visibleStays = (data ?? []).filter((stay) => stay.status === 'PUBLISHED');
  const stayIds = visibleStays.map((stay) => stay.id);
  const organizerIds = Array.from(new Set(visibleStays.map((stay) => stay.organizer_id)));
  const seasonIds = Array.from(new Set(visibleStays.map((stay) => stay.season_id)));

  const [
    { data: organizersRaw },
    { data: seasonsRaw },
    { data: mediaRaw },
    { data: sessionsRaw },
    { data: stayAccommodationRows },
    { data: accommodationsRaw },
    { data: extraOptionsRaw },
    { data: insuranceOptionsRaw },
    { data: transportOptionsRaw }
  ] = await Promise.all([
    organizerIds.length
      ? supabase.from('organizers').select('id,name,logo_path,slug,website_url').in('id', organizerIds)
      : Promise.resolve({ data: [] as OrganizerRow[] | null }),
    seasonIds.length
      ? supabase.from('seasons').select('id,name,start_date').in('id', seasonIds)
      : Promise.resolve({ data: [] as SeasonRow[] | null }),
    stayIds.length
      ? supabase
          .from('stay_media')
          .select('stay_id,url,position,media_type')
          .in('stay_id', stayIds)
      : Promise.resolve({ data: [] as Array<StayMediaRow & { stay_id: string }> | null }),
    stayIds.length
      ? supabase
          .from('sessions')
          .select('id,stay_id,start_date,end_date,status,capacity_total,capacity_reserved,session_prices(amount_cents,currency)')
          .in('stay_id', stayIds)
      : Promise.resolve({ data: [] as SessionWithOptionsRow[] | null }),
    stayIds.length
      ? supabase
          .from('stay_accommodations')
          .select('stay_id,accommodation_id')
          .in('stay_id', stayIds)
      : Promise.resolve({ data: [] as StayAccommodationRow[] | null }),
    stayIds.length
      ? supabase
          .from('accommodations')
          .select('id,name,accommodation_type,description,bed_info,bathroom_info,catering_info,accessibility_info')
      : Promise.resolve({ data: [] as AccommodationRow[] | null }),
    stayIds.length
      ? supabase
          .from('stay_extra_options')
          .select('id,stay_id,label,amount_cents,position')
          .in('stay_id', stayIds)
          .order('position', { ascending: true })
      : Promise.resolve({ data: [] as ExtraOptionRow[] | null }),
    stayIds.length
      ? supabase
          .from('insurance_options')
          .select('id,label,amount_cents,percent_value,pricing_mode,stay_id')
          .in('stay_id', stayIds)
      : Promise.resolve({ data: [] as InsuranceOptionRow[] | null }),
    stayIds.length
      ? supabase
          .from('transport_options')
          .select('id,departure_city,return_city,amount_cents,stay_id,session_id')
          .in('stay_id', stayIds)
      : Promise.resolve({ data: [] as TransportOptionRow[] | null })
  ]);

  const organizersById = new Map((organizersRaw ?? []).map((organizer) => [organizer.id, organizer]));
  const seasonsById = new Map((seasonsRaw ?? []).map((season) => [season.id, season]));
  const mediaByStayId = new Map<string, Array<StayMediaRow & { stay_id: string }>>();
  const sessionsByStayId = new Map<string, SessionWithOptionsRow[]>();
  const accommodationIdsByStayId = new Map<string, string[]>();
  const extraOptionsByStayId = new Map<string, ExtraOptionRow[]>();
  const insuranceOptionsByStayId = new Map<string, InsuranceOptionRow[]>();
  const transportOptionsByStayId = new Map<string, StayTransportOption[]>();
  const accommodationsById = new Map((accommodationsRaw ?? []).map((accommodation) => [accommodation.id, accommodation]));

  for (const item of mediaRaw ?? []) {
    const group = mediaByStayId.get(item.stay_id) ?? [];
    group.push(item);
    mediaByStayId.set(item.stay_id, group);
  }

  for (const item of sessionsRaw ?? []) {
    const group = sessionsByStayId.get(item.stay_id) ?? [];
    group.push(item);
    sessionsByStayId.set(item.stay_id, group);
  }

  for (const item of extraOptionsRaw ?? []) {
    const group = extraOptionsByStayId.get(item.stay_id) ?? [];
    group.push(item);
    extraOptionsByStayId.set(item.stay_id, group);
  }

  for (const item of insuranceOptionsRaw ?? []) {
    if (!item.stay_id) continue;
    const group = insuranceOptionsByStayId.get(item.stay_id) ?? [];
    group.push(item);
    insuranceOptionsByStayId.set(item.stay_id, group);
  }

  for (const item of transportOptionsRaw ?? []) {
    if (!item.stay_id) continue;
    const group = transportOptionsByStayId.get(item.stay_id) ?? [];
    group.push({
      id: item.id,
      departureCity: item.departure_city,
      returnCity: item.return_city,
      amount: item.amount_cents / 100,
      sessionId: item.session_id
    });
    transportOptionsByStayId.set(item.stay_id, group);
  }

  for (const item of stayAccommodationRows ?? []) {
    const group = accommodationIdsByStayId.get(item.stay_id) ?? [];
    group.push(item.accommodation_id);
    accommodationIdsByStayId.set(item.stay_id, group);
  }

  const logoUrlByOrganizerId = new Map<string, string | null>();
  await Promise.all(
    (organizersRaw ?? []).map(async (organizer) => {
      const signedUrl = organizer.logo_path
        ? (await supabase.storage
            .from('organizer-logo')
            .createSignedUrl(organizer.logo_path, 60 * 60)).data?.signedUrl ?? null
        : null;
      logoUrlByOrganizerId.set(organizer.id, signedUrl);
    })
  );

  const staysWithoutCanonical = await Promise.all(
    visibleStays.map(async (stay) => {
      const organizer = organizersById.get(stay.organizer_id);
      const organizerName = organizer?.name ?? 'Organisateur';
      const season = seasonsById.get(stay.season_id);
      const media = [...(mediaByStayId.get(stay.id) ?? [])].sort(
        (a, b) => (a.position ?? 0) - (b.position ?? 0)
      );
      const coverImage =
        media.find((item) => item.media_type === 'cover')?.url ?? media[0]?.url ?? undefined;

      const sessionItems = sessionsByStayId.get(stay.id) ?? [];
      const stayAccommodations = [...(accommodationIdsByStayId.get(stay.id) ?? [])]
        .map((accommodationId) => accommodationsById.get(accommodationId))
        .filter((item): item is AccommodationRow => Boolean(item));
      const accommodationText = buildAccommodationText(stayAccommodations);
      const durationDays = deriveSessionDurations(sessionItems);
      const { keys: periodKeys, labels: periodLabels } = derivePeriods(sessionItems);
      const audiences = deriveStayAudiences(stay.ages, stay.age_min, stay.age_max);
      const durations = deriveDurationFilters(durationDays);
      const transport = mapTransport(stay.transport_mode);
      const categories = normalizeStayCategories(stay.categories ?? []);
      const sharedTransportOptions = transportOptionsByStayId.get(stay.id) ?? [];
      const visibleBookingSessionItems = sessionItems.filter(
        (sessionItem) => sessionItem.status !== 'COMPLETED' && sessionItem.status !== 'ARCHIVED'
      );
      const bookingSessions: StaySessionOption[] = visibleBookingSessionItems
        .map((sessionItem) => {
          const sessionPrice = Array.isArray(sessionItem.session_prices)
            ? sessionItem.session_prices[0] ?? null
            : sessionItem.session_prices;
          const effectiveStatus = getEffectiveSessionStatus(sessionItem);

          const transportForSession = sharedTransportOptions.filter(
            (opt) => opt.sessionId == null || opt.sessionId === sessionItem.id
          );

          return {
            id: sessionItem.id,
            startDate: sessionItem.start_date,
            endDate: sessionItem.end_date,
            price: sessionPrice ? sessionPrice.amount_cents / 100 : null,
            status: effectiveStatus,
            transportOptions: transportForSession
          };
        })
        .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
      const rawInsuranceOptions = insuranceOptionsByStayId.get(stay.id) ?? [];
      const rawExtraOptions = extraOptionsByStayId.get(stay.id) ?? [];

      const insuranceOptions: StayInsuranceOption[] = [
        ...rawInsuranceOptions.map((option) => ({
          id: option.id,
          label: option.label,
          amount: option.amount_cents != null ? option.amount_cents / 100 : null,
          percentValue: option.percent_value,
          pricingMode: option.pricing_mode
        })),
        ...rawExtraOptions
          .filter((option) => isInsuranceLikeLabel(option.label))
          .map((option) => ({
            id: option.id,
            label: option.label,
            amount: option.amount_cents / 100,
            percentValue: null,
            pricingMode: 'FLAT'
          }))
      ];

      const extraOptions: StayExtraOption[] = rawExtraOptions
        .filter((option) => !isInsuranceLikeLabel(option.label))
        .map((option) => ({
          id: option.id,
          label: option.label,
          amount: option.amount_cents / 100
        }));
      const sessionPrices = bookingSessions
        .filter((sessionItem) => sessionItem.status === 'OPEN')
        .map((sessionItem) => sessionItem.price)
        .filter((price): price is number => price != null);
      const fallbackSessionPrices = bookingSessions
        .map((sessionItem) => sessionItem.price)
        .filter((price): price is number => price != null);
      const minSessionPrice = sessionPrices.length
        ? Math.min(...sessionPrices)
        : fallbackSessionPrices.length
          ? Math.min(...fallbackSessionPrices)
          : null;
      const displayTitle = normalizeStayTitle(stay.title) || stay.title.trim();
      const baseSlug = slugify(`${organizerName}-${displayTitle}`) || stay.id;
      const seoPrimaryKeyword = normalizeStaySeoText(stay.seo_primary_keyword);
      const seoTargetCity = normalizeStaySeoText(stay.seo_target_city);
      const seoTargetRegion = normalizeStaySeoText(stay.seo_target_region);
      const seoTitle = normalizeStaySeoText(stay.seo_title);
      const seoMetaDescription = normalizeStaySeoText(stay.seo_meta_description);
      const seoIntroText = normalizeStaySeoText(stay.seo_intro_text);
      const seoH1Variant = normalizeStaySeoText(stay.seo_h1_variant);
      const seoSecondaryKeywords = normalizeStaySeoTags(stay.seo_secondary_keywords);
      const seoSearchIntents = normalizeStaySeoTags(stay.seo_search_intents);
      const seoInternalLinkAnchorSuggestions = normalizeStaySeoTags(
        stay.seo_internal_link_anchor_suggestions
      );
      const seoSlugCandidate = normalizeStaySeoText(stay.seo_slug_candidate);
      const seoScore = normalizeStaySeoScore(stay.seo_score);
      const seoChecks = normalizeStaySeoChecks(stay.seo_checks);
      const seoGeneratedAt = normalizeStaySeoText(stay.seo_generated_at);
      const seoGenerationSource = normalizeStaySeoText(stay.seo_generation_source);

      return {
        id: stay.id,
        title: displayTitle,
        slug: baseSlug,
        summary: stay.summary?.trim() || buildSummary(displayTitle, stay.description),
        description: stay.description?.trim() || stay.program_text?.trim() || '',
        seasonId: stay.season_id,
        seasonName: season?.name?.trim() || 'Saison non précisée',
        organizerId: stay.organizer_id,
        organizer: {
          name: organizerName,
          website: organizer?.website_url?.trim() || '',
          slug: organizer?.slug?.trim() || slugify(organizerName),
          logoUrl: logoUrlByOrganizerId.get(stay.organizer_id) ?? undefined
        },
        location: stay.location_text ?? '',
        region: stay.region_text ?? '',
        country: '',
        ageMin: stay.age_min,
        ageMax: stay.age_max,
        ageRange: formatStayAgeRange(stay.ages, stay.age_min, stay.age_max),
        duration: formatDurationLabel(durationDays),
        priceFrom: minSessionPrice,
        period: periodLabels,
        categories,
        highlights: [],
        activitiesText: stay.activities_text?.trim() ?? '',
        programText: stay.program_text?.trim() ?? '',
        transportText: stay.transport_text?.trim() ?? '',
        coverImage,
        bookingOptions: {
          transportMode: stay.transport_mode ?? 'Sans transport',
          sessions: bookingSessions,
          insuranceOptions,
          extraOptions
        },
        seo: {
          primaryKeyword: seoPrimaryKeyword,
          secondaryKeywords: seoSecondaryKeywords,
          targetCity: seoTargetCity,
          targetRegion: seoTargetRegion,
          searchIntents: seoSearchIntents,
          title: seoTitle,
          metaDescription: seoMetaDescription,
          introText: seoIntroText,
          h1Variant: seoH1Variant,
          internalLinkAnchorSuggestions: seoInternalLinkAnchorSuggestions,
          slugCandidate: seoSlugCandidate,
          score: seoScore,
          checks: seoChecks,
          generatedAt: seoGeneratedAt,
          generationSource: seoGenerationSource
        },
        rawContext: {
          presentation: stay.description ?? '',
          activites: stay.activities_text ?? '',
          programme: stay.program_text ?? '',
          hebergement: accommodationText,
          encadrement: stay.supervision_text ?? '',
          documents_obligatoires: stay.required_documents_text ?? '',
          transport: stay.transport_text ?? '',
          region: stay.region_text ?? ''
        },
        filters: {
          categories,
          audiences,
          durations,
          periods: periodKeys,
          priceRange: null,
          transport
        },
        updatedAt: stay.updated_at
      };
    })
  );

  const stays = applyCanonicalStaySlugs(staysWithoutCanonical);
  validateStaysSeoCatalog(stays);

  return stays;
}

const loadStays = cache(async () => fetchStaysFromSupabase());

export async function getStays(options: { forceRefresh?: boolean } = {}) {
  if (options.forceRefresh) {
    return fetchStaysFromSupabase();
  }
  return loadStays();
}

export function filterStays(stays: Stay[], params: StaySearchParams = {}) {
  return stays.filter((stay) => {
    if (params.q) {
      const haystack = `${stay.title} ${stay.summary} ${stay.description}`.toLowerCase();
      if (!haystack.includes(params.q.toLowerCase())) {
        return false;
      }
    }

    if (params.categories?.length) {
      if (!params.categories.some((category) => stay.filters.categories.includes(category))) {
        return false;
      }
    }

    if (params.audiences?.length) {
      if (!params.audiences.some((audience) => stay.filters.audiences.includes(audience))) {
        return false;
      }
    }

    if (params.durations?.length) {
      if (!params.durations.some((duration) => stay.filters.durations.includes(duration))) {
        return false;
      }
    }

    if (params.periods?.length) {
      if (!params.periods.some((period) => stay.filters.periods.includes(period))) {
        return false;
      }
    }

    if (params.priceMax) {
      if (stay.priceFrom && stay.priceFrom > params.priceMax) {
        return false;
      }
    }

    if (params.organizer) {
      if (!stay.organizer.name.toLowerCase().includes(params.organizer.toLowerCase())) {
        return false;
      }
    }

    return true;
  });
}

export function buildQueryFromRequest(req: NextRequest): StaySearchParams {
  const searchParams = req.nextUrl.searchParams;
  const parseList = (key: string) =>
    searchParams
      .getAll(key)
      .flatMap((item) =>
        item
          .split(',')
          .map((value) => value.trim())
          .filter(Boolean)
      );

  const audiences = parseList('audiences') as StaySearchParams['audiences'];
  const categories = parseList('categories') as StaySearchParams['categories'];
  const durations = parseList('durations') as StaySearchParams['durations'];
  const periods = parseList('periods') as StaySearchParams['periods'];

  const priceMaxRaw = searchParams.get('priceMax');
  const priceMax = priceMaxRaw ? Number.parseInt(priceMaxRaw, 10) : undefined;

  const organizer = searchParams.get('organizer') || undefined;
  const q = searchParams.get('q') || undefined;

  return {
    q,
    audiences: audiences?.length ? audiences : undefined,
    categories: categories?.length ? categories : undefined,
    durations: durations?.length ? durations : undefined,
    periods: periods?.length ? periods : undefined,
    priceMax: Number.isFinite(priceMax) ? priceMax : undefined,
    organizer
  };
}
