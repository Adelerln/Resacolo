import { cache } from 'react';
import { NextRequest } from 'next/server';
import { FILTER_LABELS } from '@/lib/constants';
import { deriveStayAudiences, formatStayAgeRange } from '@/lib/stay-ages';
import { getServerSupabaseClient } from '@/lib/supabase/server';
import { slugify } from '@/lib/utils';
import type { Stay, StayDuration, StaySearchParams } from '@/types/stay';
import type { Database } from '@/types/supabase';

type PeriodKey = keyof typeof FILTER_LABELS.periods;
type TransportKey = keyof typeof FILTER_LABELS.transport;
type OrganizerRow = Pick<Database['public']['Tables']['organizers']['Row'], 'id' | 'name' | 'logo_path'>;
type StayMediaRow = Pick<Database['public']['Tables']['stay_media']['Row'], 'url' | 'position' | 'media_type'>;
type SessionRow = Pick<Database['public']['Tables']['sessions']['Row'], 'start_date' | 'end_date'>;
type AccommodationRow = Pick<
  Database['public']['Tables']['accommodations']['Row'],
  'id' | 'name' | 'description' | 'country' | 'rooming_text' | 'catering_text'
>;
type StayAccommodationRow = Pick<
  Database['public']['Tables']['stay_accommodations']['Row'],
  'stay_id' | 'accommodation_id' | 'position'
>;

const DAY_MS = 1000 * 60 * 60 * 24;

function deriveDurationDays(sessions: SessionRow[] | null | undefined) {
  if (!sessions || sessions.length === 0) return null;
  const days = sessions
    .map((session) => {
      const start = new Date(session.start_date).getTime();
      const end = new Date(session.end_date).getTime();
      if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
      const diff = Math.max(0, Math.round((end - start) / DAY_MS));
      return diff + 1;
    })
    .filter((value): value is number => typeof value === 'number' && value > 0);

  if (!days.length) return null;
  return Math.min(...days);
}

function formatDurationLabel(days: number | null) {
  if (!days) return 'Durée à venir';
  return days === 1 ? '1 jour' : `${days} jours`;
}

function deriveDurationFilters(days: number | null): StayDuration[] {
  if (!days) return [];
  if (days <= 4) return ['mini-sejour'];
  if (days <= 7) return ['semaine'];
  if (days <= 14) return ['quinzaine'];
  return ['long'];
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
      const location = [accommodation.country].filter(Boolean).join(', ');
      const details = [
        accommodation.description,
        accommodation.rooming_text,
        accommodation.catering_text
      ]
        .filter(Boolean)
        .join('\n');

      return [accommodation.name, location, details].filter(Boolean).join('\n');
    })
    .join('\n\n');
}

async function fetchStaysFromSupabase(): Promise<Stay[]> {
  const supabase = getServerSupabaseClient();

  const { data, error } = await supabase
    .from('stays')
    .select(
      'id,title,summary,description,activities_text,program_text,supervision_text,required_documents_text,transport_text,location_text,ages,age_min,age_max,transport_mode,updated_at,status,organizer_id'
    )
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Erreur Supabase (stays)', error.message);
    return [];
  }

  const visibleStays = (data ?? []).filter(
    (stay) => stay.status !== 'ARCHIVED' && stay.status !== 'HIDDEN'
  );
  const stayIds = visibleStays.map((stay) => stay.id);
  const organizerIds = Array.from(new Set(visibleStays.map((stay) => stay.organizer_id)));

  const [
    { data: organizersRaw },
    { data: mediaRaw },
    { data: sessionsRaw },
    { data: stayAccommodationRows },
    { data: accommodationsRaw }
  ] = await Promise.all([
    organizerIds.length
      ? supabase.from('organizers').select('id,name,logo_path').in('id', organizerIds)
      : Promise.resolve({ data: [] as OrganizerRow[] | null }),
    stayIds.length
      ? supabase
          .from('stay_media')
          .select('stay_id,url,position,media_type')
          .in('stay_id', stayIds)
      : Promise.resolve({ data: [] as Array<StayMediaRow & { stay_id: string }> | null }),
    stayIds.length
      ? supabase
          .from('sessions')
          .select('stay_id,start_date,end_date')
          .in('stay_id', stayIds)
      : Promise.resolve({ data: [] as Array<SessionRow & { stay_id: string }> | null }),
    stayIds.length
      ? supabase
          .from('stay_accommodations')
          .select('stay_id,accommodation_id,position')
          .in('stay_id', stayIds)
      : Promise.resolve({ data: [] as StayAccommodationRow[] | null }),
    stayIds.length
      ? supabase
          .from('accommodations')
          .select('id,name,description,country,rooming_text,catering_text')
      : Promise.resolve({ data: [] as AccommodationRow[] | null })
  ]);

  const organizersById = new Map((organizersRaw ?? []).map((organizer) => [organizer.id, organizer]));
  const mediaByStayId = new Map<string, Array<StayMediaRow & { stay_id: string }>>();
  const sessionsByStayId = new Map<string, Array<SessionRow & { stay_id: string }>>();
  const accommodationIdsByStayId = new Map<string, Array<{ accommodation_id: string; position: number }>>();
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

  for (const item of stayAccommodationRows ?? []) {
    const group = accommodationIdsByStayId.get(item.stay_id) ?? [];
    group.push({ accommodation_id: item.accommodation_id, position: item.position });
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
      const media = [...(mediaByStayId.get(stay.id) ?? [])].sort(
        (a, b) => (a.position ?? 0) - (b.position ?? 0)
      );
      const coverImage =
        media.find((item) => item.media_type === 'cover')?.url ?? media[0]?.url ?? undefined;

      const sessionItems = sessionsByStayId.get(stay.id) ?? [];
      const stayAccommodations = [...(accommodationIdsByStayId.get(stay.id) ?? [])]
        .sort((a, b) => a.position - b.position)
        .map((item) => accommodationsById.get(item.accommodation_id))
        .filter((item): item is AccommodationRow => Boolean(item));
      const accommodationText = buildAccommodationText(stayAccommodations);
      const durationDays = deriveDurationDays(sessionItems);
      const { keys: periodKeys, labels: periodLabels } = derivePeriods(sessionItems);
      const audiences = deriveStayAudiences(stay.ages, stay.age_min, stay.age_max);
      const durations = deriveDurationFilters(durationDays);
      const transport = mapTransport(stay.transport_mode);

      return {
        id: stay.id,
        title: stay.title,
        slug: slugify(`${organizerName}-${stay.title}`) || stay.id,
        summary: stay.summary?.trim() || buildSummary(stay.title, stay.description),
        description: stay.program_text?.trim() || stay.description || '',
        organizer: {
          name: organizerName,
          website: '',
          logoUrl: logoUrlByOrganizerId.get(stay.organizer_id) ?? undefined
        },
        location: stay.location_text ?? '',
        country: '',
        ageRange: formatStayAgeRange(stay.ages, stay.age_min, stay.age_max),
        duration: formatDurationLabel(durationDays),
        priceFrom: null,
        period: periodLabels,
        categories: [],
        highlights: [],
        coverImage,
        rawContext: {
          presentation: stay.description ?? '',
          activites: stay.activities_text ?? '',
          programme: stay.program_text ?? '',
          hebergement: accommodationText,
          encadrement: stay.supervision_text ?? '',
          documents_obligatoires: stay.required_documents_text ?? '',
          transport: stay.transport_text ?? ''
        },
        filters: {
          categories: [],
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
