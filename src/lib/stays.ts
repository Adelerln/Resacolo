import { cache } from 'react';
import { NextRequest } from 'next/server';
import { formatAccommodationType } from '@/components/organisme/accommodation-type';
import { FILTER_LABELS } from '@/lib/constants';
import { normalizeStayCategories } from '@/lib/stay-categories';
import { deriveStayAudiences, formatStayAgeRange } from '@/lib/stay-ages';
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
type OrganizerRow = Pick<Database['public']['Tables']['organizers']['Row'], 'id' | 'name' | 'logo_path'>;
type SeasonRow = Pick<Database['public']['Tables']['seasons']['Row'], 'id' | 'name' | 'start_date'>;
type StayMediaRow = Pick<Database['public']['Tables']['stay_media']['Row'], 'url' | 'position' | 'media_type'>;
type SessionRow = Pick<Database['public']['Tables']['sessions']['Row'], 'start_date' | 'end_date'>;
type SessionPriceRow = Pick<
  Database['public']['Tables']['session_prices']['Row'],
  'amount_cents' | 'currency'
>;
type TransportOptionRow = Pick<
  Database['public']['Tables']['transport_options']['Row'],
  'id' | 'departure_city' | 'return_city' | 'amount_cents' | 'stay_id'
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

const DAY_MS = 1000 * 60 * 60 * 24;

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
      const details = [
        formatAccommodationType(accommodation.accommodation_type),
        accommodation.description,
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
      ? supabase.from('organizers').select('id,name,logo_path').in('id', organizerIds)
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
          .select('id,departure_city,return_city,amount_cents,stay_id')
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
      amount: item.amount_cents / 100
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

  const stays = await Promise.all(
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

          return {
            id: sessionItem.id,
            startDate: sessionItem.start_date,
            endDate: sessionItem.end_date,
            price: sessionPrice ? sessionPrice.amount_cents / 100 : null,
            status: sessionItem.status,
            transportOptions: sharedTransportOptions
          };
        })
        .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
      const insuranceOptions: StayInsuranceOption[] = (insuranceOptionsByStayId.get(stay.id) ?? []).map(
        (option) => ({
          id: option.id,
          label: option.label,
          amount: option.amount_cents != null ? option.amount_cents / 100 : null,
          percentValue: option.percent_value,
          pricingMode: option.pricing_mode
        })
      );
      const extraOptions: StayExtraOption[] = (extraOptionsByStayId.get(stay.id) ?? []).map((option) => ({
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

      return {
        id: stay.id,
        title: stay.title,
        slug: slugify(`${organizerName}-${stay.title}`) || stay.id,
        summary: stay.summary?.trim() || buildSummary(stay.title, stay.description),
        description: stay.description?.trim() || stay.program_text?.trim() || '',
        seasonId: stay.season_id,
        seasonName: season?.name?.trim() || 'Saison non précisée',
        organizerId: stay.organizer_id,
        organizer: {
          name: organizerName,
          website: '',
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
