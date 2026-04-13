import { readdir } from 'node:fs/promises';
import path from 'node:path';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { OrganizerStayPreviewCard } from '@/components/organisateurs/OrganizerStayPreviewCard';
import { HorizontalCardsCarousel } from '@/components/organisateurs/HorizontalCardsCarousel';
import { ExternalLink, MapPin } from 'lucide-react';
import { formatAccommodationType } from '@/lib/accommodation-types';
import { extractAccommodationLocationMeta } from '@/lib/accommodation-location';
import { getOrganizerBySlug } from '@/lib/mockOrganizers';
import {
  ORGANIZER_ACTIVITY_OPTIONS,
  ORGANIZER_SEASON_OPTIONS,
  ORGANIZER_STAY_TYPE_OPTIONS,
  resolveStaySeasonPicto
} from '@/lib/organizer-profile-options';
import {
  buildOrganizerPresentationHtml,
  extractOrganizerDurationMeta,
  extractOrganizerPresentationSummary
} from '@/lib/organizer-rich-text';
import { getStays } from '@/lib/stays';
import { getServerSupabaseClient } from '@/lib/supabase/server';
import { slugify } from '@/lib/utils';

type PageProps = { params: Promise<{ slug: string }> };

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const BANNER_DIR = path.join(process.cwd(), 'public/image/organisateurs/bannieres_orga');
const LIGHT_HERO_TEXT_KEYS = new Set([
  'cei',
  'cesl',
  'chicplanet',
  'eoleloisirs',
  'lezebre',
  'lesvacancesduzebre',
  'oceanevoyage',
  'oceanevoyagejunior',
  'silc',
  'visasloisirs'
]);
const DARK_HERO_TEXT_KEYS = new Set([
  'aventuresvacancesenergie',
  'ave',
  'djuringa',
  'equifun',
  'lescolosdubonheur',
  'lescolosdubonheurs',
  'p4s',
  'planeteaventure',
  'planeteaventures',
  'planetevacances',
  'thalie',
  'zigo',
  'zigotours'
]);

function compactKey(value: string) {
  return slugify(value).replace(/-/g, '');
}

async function resolveOrganizerBannerPath(input: { name: string; slug: string }) {
  try {
    const files = (await readdir(BANNER_DIR))
      .filter((file) => /\.(png|jpe?g|webp)$/i.test(file))
      .sort((a, b) => a.localeCompare(b, 'fr'));

    if (files.length === 0) return null;

    const organizerSlugKey = compactKey(input.slug);
    const organizerNameKey = compactKey(input.name);

    if (
      organizerSlugKey.includes('poneydesquatresaisons') ||
      organizerSlugKey.includes('poneysdes4saisons') ||
      organizerSlugKey.includes('poneysdesquatresaisons') ||
      organizerNameKey.includes('poneydesquatresaisons') ||
      organizerNameKey.includes('poneysdes4saisons') ||
      organizerNameKey.includes('poneysdesquatresaisons')
    ) {
      const p4sBanner = files.find((file) => compactKey(file).includes('p4s'));
      if (p4sBanner) {
        return `/image/organisateurs/bannieres_orga/${p4sBanner}`;
      }
    }

    if (organizerSlugKey === 'cesl') {
      const chicPlanetBanner = files.find((file) => compactKey(file).includes('chicplanet'));
      if (chicPlanetBanner) {
        return `/image/organisateurs/bannieres_orga/${chicPlanetBanner}`;
      }
    }

    const organizerKeys = [compactKey(input.slug), compactKey(input.name)].filter(Boolean);
    const matchedFile =
      files.find((file) => {
        const fileKey = compactKey(file.replace(/\.[^.]+$/, '').replace(/^banniere[-_\s]*/i, ''));
        return organizerKeys.some((key) => fileKey.includes(key) || key.includes(fileKey));
      }) ?? files[0];

    return `/image/organisateurs/bannieres_orga/${matchedFile}`;
  } catch {
    return null;
  }
}

function formatPublicAgeRange(ageMin?: number | null, ageMax?: number | null) {
  if (ageMin != null || ageMax != null) return `De ${ageMin ?? '?'} à ${ageMax ?? '?'} ans`;
  return 'Âges non renseignés';
}

function formatOrganizerStayDurationLabel(minDays?: number | null, maxDays?: number | null) {
  const min = minDays != null && Number.isFinite(minDays) ? Math.round(minDays) : null;
  const max = maxDays != null && Number.isFinite(maxDays) ? Math.round(maxDays) : null;
  if (min != null && max != null) {
    if (min === max) return `${min} jour${min > 1 ? 's' : ''}`;
    return `De ${min} à ${max} jours`;
  }
  if (min != null) return `À partir de ${min} jour${min > 1 ? 's' : ''}`;
  if (max != null) return `Jusqu'à ${max} jour${max > 1 ? 's' : ''}`;
  return 'Durées non renseignées';
}

const DAY_MS = 86_400_000;

function pickSeasonNameFromJoin(raw: unknown): string | null {
  if (!raw) return null;
  if (Array.isArray(raw)) {
    const first = raw[0] as { name?: string } | undefined;
    return first?.name?.trim() ?? null;
  }
  if (typeof raw === 'object' && raw !== null && 'name' in raw) {
    return String((raw as { name: string }).name).trim() || null;
  }
  return null;
}

function sessionLengthDays(start: string, end: string): number | null {
  const startMs = new Date(start).getTime();
  const endMs = new Date(end).getTime();
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return null;
  const diff = Math.max(0, Math.round((endMs - startMs) / DAY_MS));
  return diff + 1;
}

function formatAggregatedStayDays(days: number[]): string {
  if (days.length === 0) return 'Durée à venir';
  const min = Math.min(...days);
  const max = Math.max(...days);
  if (min === max) return min === 1 ? '1 jour' : `${min} jours`;
  return `${min} à ${max} jours`;
}

type FeaturedSessionRow = {
  stay_id: string;
  start_date: string;
  end_date: string;
  status: string | null;
  session_prices:
    | { amount_cents: number | null }[]
    | { amount_cents: number | null }
    | null;
};

function readSessionPriceEuros(row: FeaturedSessionRow): number | null {
  const raw = row.session_prices;
  const first = Array.isArray(raw) ? raw[0] : raw;
  const cents = first?.amount_cents;
  if (cents == null || !Number.isFinite(cents)) return null;
  return cents / 100;
}

function buildFeaturedStaySessionMeta(sessions: FeaturedSessionRow[]) {
  const visible = sessions.filter(
    (session) => session.status !== 'COMPLETED' && session.status !== 'ARCHIVED'
  );
  const dayCounts = visible
    .map((session) => sessionLengthDays(session.start_date, session.end_date))
    .filter((value): value is number => typeof value === 'number' && value > 0);
  const openPrices = visible
    .filter((session) => session.status === 'OPEN')
    .map((session) => readSessionPriceEuros(session))
    .filter((value): value is number => value != null);
  const fallbackPrices = visible
    .map((session) => readSessionPriceEuros(session))
    .filter((value): value is number => value != null);
  const minPrice =
    openPrices.length > 0
      ? Math.min(...openPrices)
      : fallbackPrices.length > 0
        ? Math.min(...fallbackPrices)
        : null;
  return {
    durationLabel: formatAggregatedStayDays(dayCounts),
    priceFrom: minPrice
  };
}

function formatStayHref(organizerName: string, stayTitle: string, stayId: string) {
  return `/sejours/${slugify(`${organizerName}-${stayTitle}`) || stayId}`;
}

function formatAccommodationCarouselLabel(type?: string | null, locationLabel?: string | null) {
  const typeLabel =
    type === 'centre'
      ? 'Centre de vacances'
      : type
        ? formatAccommodationType(type)
        : 'Centre de vacances';

  return locationLabel ? `${typeLabel}, ${locationLabel}` : typeLabel;
}

function formatOrganizerDisplayName(name: string) {
  const trimmed = name.trim();
  if (!trimmed) return name;

  const preservedAcronyms = new Set(['AVE', 'CEI', 'CESL', 'P4S', 'SILC']);
  if (preservedAcronyms.has(trimmed)) return trimmed;

  const isAllCaps = trimmed === trimmed.toLocaleUpperCase('fr-FR');
  if (!isAllCaps) return trimmed;

  return trimmed
    .toLocaleLowerCase('fr-FR')
    .replace(/(^|[\s'’-])([A-Za-zÀ-ÿ])/g, (match, prefix: string, letter: string) => {
      return `${prefix}${letter.toLocaleUpperCase('fr-FR')}`;
    });
}

function splitOrganizerDisplayName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) {
    return { firstLine: name, secondLine: '' };
  }

  let bestSplit = {
    firstLine: name,
    secondLine: '',
    score: Number.POSITIVE_INFINITY
  };

  for (let index = 1; index < parts.length; index += 1) {
    const firstLine = parts.slice(0, index).join(' ');
    const secondLine = parts.slice(index).join(' ');
    const firstLength = firstLine.length;
    const secondLength = secondLine.length;
    const penalty = secondLength < firstLength ? 100 : 0;
    const score = Math.abs(secondLength - firstLength) + penalty;

    if (score < bestSplit.score) {
      bestSplit = { firstLine, secondLine, score };
    }
  }

  return { firstLine: bestSplit.firstLine, secondLine: bestSplit.secondLine };
}

function resolveHeroTextTheme(input: { slug: string; name: string; bannerPath?: string | null }) {
  const candidateKeys = [
    compactKey(input.slug),
    compactKey(input.name),
    input.bannerPath
      ? compactKey(
          input.bannerPath
            .split('/')
            .pop()
            ?.replace(/\.[^.]+$/, '')
            .replace(/^banniere[-_\s]*/i, '') ?? ''
        )
      : ''
  ].filter(Boolean);

  if (candidateKeys.some((key) => DARK_HERO_TEXT_KEYS.has(key))) return 'dark';
  if (candidateKeys.some((key) => LIGHT_HERO_TEXT_KEYS.has(key))) return 'light';
  return 'light';
}

function resolveHeroLogoFallbackPosition(slug: string) {
  const key = compactKey(slug);

  if (key === 'aventuresvacancesenergie' || key === 'ave') return '74% 48%';
  if (key === 'cei') return '78% 46%';
  if (key === 'cesl') return '80% 48%';
  if (key === 'chicplanet') return '77% 48%';
  if (key === 'eoleloisirs') return '79% 48%';
  if (key === 'lezebre' || key === 'lesvacancesduzebre') return '77% 48%';
  if (key === 'thalie') return '78% 48%';
  if (key === 'zigo' || key === 'zigotours') return '78% 48%';

  return '78% 48%';
}

function resolveHeroLogoImageClass(slug: string) {
  const key = compactKey(slug);

  if (key === 'cesl') {
    return 'max-h-52 w-auto object-contain object-center sm:max-h-60 lg:max-h-72';
  }

  return 'max-h-44 w-auto object-contain sm:max-h-52 lg:max-h-64';
}

export default async function OrganisateurDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const supabase = getServerSupabaseClient();
  const organizerSelectWithCatalog =
    'id,name,slug,description,hero_intro_text,founded_year,age_min,age_max,logo_path,education_project_path,season_keys,stay_type_keys,activity_keys';
  const organizerSelectFallback =
    'id,name,slug,description,hero_intro_text,founded_year,age_min,age_max,logo_path,education_project_path';

  const organizerQueryWithCatalog = await supabase
    .from('organizers')
    .select(organizerSelectWithCatalog)
    .eq('slug', slug)
    .maybeSingle();
  const organizerFallbackQuery = organizerQueryWithCatalog.data
    ? null
    : await supabase
        .from('organizers')
        .select(organizerSelectFallback)
        .eq('slug', slug)
        .maybeSingle();

  const organizer = organizerQueryWithCatalog.data
    ? organizerQueryWithCatalog.data
    : organizerFallbackQuery?.data
      ? {
          ...organizerFallbackQuery.data,
          season_keys: [],
          stay_type_keys: [],
          activity_keys: []
        }
      : null;

  let resolvedOrganizer = organizer;
  if (!resolvedOrganizer) {
    const allOrganizersWithCatalog = await supabase
      .from('organizers')
      .select(organizerSelectWithCatalog);
    const allOrganizers =
      allOrganizersWithCatalog.data ??
      (
        await supabase
          .from('organizers')
          .select(organizerSelectFallback)
      ).data?.map((item) => ({
          ...item,
          season_keys: [],
          stay_type_keys: [],
          activity_keys: []
        })) ??
      [];
    resolvedOrganizer =
      allOrganizers.find((item) => slugify(item.name) === slug) ?? null;
  }

  const fallbackOrganizer = !resolvedOrganizer ? getOrganizerBySlug(slug) : null;

  if (!resolvedOrganizer && !fallbackOrganizer) {
    notFound();
  }

  let stayDurationMinDays: number | null = null;
  let stayDurationMaxDays: number | null = null;
  const organizerDescriptionMeta = extractOrganizerDurationMeta(resolvedOrganizer?.description);
  if (resolvedOrganizer?.id) {
    const { data: durRow, error: durErr } = await supabase
      .from('organizers')
      .select('stay_duration_min_days,stay_duration_max_days')
      .eq('id', resolvedOrganizer.id)
      .maybeSingle();
    if (!durErr && durRow) {
      stayDurationMinDays = durRow.stay_duration_min_days ?? null;
      stayDurationMaxDays = durRow.stay_duration_max_days ?? null;
    }
  }
  if (stayDurationMinDays == null) {
    stayDurationMinDays = organizerDescriptionMeta.stayDurationMinDays;
  }
  if (stayDurationMaxDays == null) {
    stayDurationMaxDays = organizerDescriptionMeta.stayDurationMaxDays;
  }

  const organizerName = resolvedOrganizer?.name ?? fallbackOrganizer?.name ?? 'Organisateur';
  const organizerDisplayName = formatOrganizerDisplayName(organizerName);
  const organizerTitleLines = splitOrganizerDisplayName(organizerDisplayName);
  const organizerSlug = resolvedOrganizer?.slug ?? fallbackOrganizer?.slug ?? slug;
  const selectedSeasonOptions = ORGANIZER_SEASON_OPTIONS.filter((option) =>
    (resolvedOrganizer?.season_keys ?? []).includes(option.key)
  );
  const selectedStayTypeOptions = ORGANIZER_STAY_TYPE_OPTIONS.filter((option) =>
    (resolvedOrganizer?.stay_type_keys ?? []).includes(option.key)
  );
  const selectedActivityOptions = ORGANIZER_ACTIVITY_OPTIONS.filter((option) =>
    (resolvedOrganizer?.activity_keys ?? []).includes(option.key)
  );
  const seasonHeading =
    selectedSeasonOptions.length === 0
      ? null
      : selectedSeasonOptions.length === 1
        ? 'Saison :'
        : 'Saisons :';
  const stayTypeHeading =
    selectedStayTypeOptions.length === 0
      ? null
      : selectedStayTypeOptions.length === 1
        ? 'Type de séjour :'
        : 'Types de séjours :';
  const activityHeading =
    selectedActivityOptions.length === 0
      ? null
      : selectedActivityOptions.length === 1
        ? 'Activité proposée :'
        : 'Activités proposées :';
  const publicAgeRange = resolvedOrganizer
    ? formatPublicAgeRange(resolvedOrganizer.age_min, resolvedOrganizer.age_max)
    : fallbackOrganizer?.publicAgeRange ?? 'Âges non renseignés';
  const stayDurationLabel = resolvedOrganizer
    ? formatOrganizerStayDurationLabel(stayDurationMinDays, stayDurationMaxDays)
    : 'Durées non renseignées';

  const [bannerPath, organizerLogoUrl, projectUrl, fallbackOrganizerStaysData] = await Promise.all([
    resolveOrganizerBannerPath({
      name: organizerName,
      slug: organizerSlug
    }),
    resolvedOrganizer?.logo_path
      ? supabase.storage
          .from('organizer-logo')
          .createSignedUrl(resolvedOrganizer.logo_path, 60 * 60)
          .then((result) => result.data?.signedUrl ?? null)
      : Promise.resolve(fallbackOrganizer?.logoUrl ?? null),
    resolvedOrganizer?.education_project_path
      ? supabase.storage
          .from('organizer-docs')
          .createSignedUrl(resolvedOrganizer.education_project_path, 60 * 60)
          .then((result) => result.data?.signedUrl ?? null)
      : Promise.resolve(null),
    !resolvedOrganizer || !resolvedOrganizer.logo_path
      ? getStays({ forceRefresh: true }).then((stays) =>
          stays
            .filter((stay) => slugify(stay.organizer.name) === slug || stay.organizer.name === organizerName)
            .slice(0, 6)
            .map((stay) => ({
              id: stay.id,
              title: stay.title,
              summary: stay.summary,
              description: stay.description,
              location_text: stay.location,
              age_min: stay.ageMin,
              age_max: stay.ageMax,
              coverImage: stay.coverImage ?? null,
              organizerLogoUrl: stay.organizer.logoUrl ?? null
            }))
        )
      : Promise.resolve([])
  ]);
  const fallbackPublishedStays = fallbackOrganizerStaysData.map(
    ({ id, title, summary, description, location_text, age_min, age_max, coverImage }) => ({
      id,
      title,
      summary,
      description,
      location_text,
      age_min,
      age_max,
      coverImage
    })
  );
  const logoUrl =
    organizerLogoUrl ??
    fallbackOrganizerStaysData.find((stay) => stay.organizerLogoUrl)?.organizerLogoUrl ??
    null;
  const heroTextTheme = resolveHeroTextTheme({
    slug: organizerSlug,
    name: organizerName,
    bannerPath
  });
  const heroTextClass = heroTextTheme === 'dark' ? 'text-white' : 'text-[#505050]';
  const heroLinkClass =
    heroTextTheme === 'dark'
      ? 'text-white/90 hover:text-white decoration-white/40'
      : 'text-slate-600 hover:text-slate-900 decoration-slate-300';

  const publishedStaysRaw = resolvedOrganizer
    ? (
        await supabase
          .from('stays')
          .select(
            'id,title,summary,description,location_text,age_min,age_max,updated_at,status,season_id,seasons(name)'
          )
          .eq('organizer_id', resolvedOrganizer.id)
          .eq('status', 'PUBLISHED')
          .order('updated_at', { ascending: false })
          .limit(6)
      ).data ?? []
    : [];

  const publishedStays = resolvedOrganizer ? publishedStaysRaw : fallbackPublishedStays;
  const publishedStayIds = publishedStays.map((stay) => stay.id);

  const { data: featuredSessionsRaw } =
    resolvedOrganizer && publishedStayIds.length > 0
      ? await supabase
          .from('sessions')
          .select('stay_id,start_date,end_date,status,session_prices(amount_cents)')
          .in('stay_id', publishedStayIds)
      : { data: [] as FeaturedSessionRow[] };

  const featuredSessionsByStayId = new Map<string, FeaturedSessionRow[]>();
  for (const row of featuredSessionsRaw ?? []) {
    const group = featuredSessionsByStayId.get(row.stay_id) ?? [];
    group.push(row as FeaturedSessionRow);
    featuredSessionsByStayId.set(row.stay_id, group);
  }

  const [{ data: stayMediaRaw }, { data: accommodationsRaw }, { data: stayAccommodationLinksRaw }, { data: accommodationMediaRaw }] =
    resolvedOrganizer
      ? await Promise.all([
          publishedStayIds.length > 0
            ? supabase
                .from('stay_media')
                .select('stay_id,url,position')
                .in('stay_id', publishedStayIds)
                .order('position', { ascending: true })
            : Promise.resolve({ data: [] as Array<{ stay_id: string; url: string; position: number }> }),
          supabase
            .from('accommodations')
            .select(
              'id,name,accommodation_type,description,bed_info,bathroom_info,catering_info,accessibility_info,status,updated_at'
            )
            .eq('organizer_id', resolvedOrganizer.id)
            .order('updated_at', { ascending: false }),
          supabase.from('stay_accommodations').select('accommodation_id,stay_id'),
          supabase
            .from('accommodation_media')
            .select('accommodation_id,url,position')
            .order('position', { ascending: true })
        ])
      : [
          { data: [] as Array<{ stay_id: string; url: string; position: number }> },
          {
            data: [] as Array<{
              id: string;
              name: string;
              accommodation_type: string | null;
              description: string | null;
              bed_info: string | null;
              bathroom_info: string | null;
              catering_info: string | null;
              accessibility_info: string | null;
              status: string | null;
              updated_at: string;
            }>
          },
          { data: [] as Array<{ accommodation_id: string; stay_id: string }> },
          { data: [] as Array<{ accommodation_id: string; url: string; position: number }> }
        ];

  const coverImageByStayId = new Map<string, string>();
  for (const media of stayMediaRaw ?? []) {
    if (!coverImageByStayId.has(media.stay_id)) {
      coverImageByStayId.set(media.stay_id, media.url);
    }
  }

  const publishedStayTitleById = new Map(publishedStays.map((stay) => [stay.id, stay.title]));
  const publishedStayLocationById = new Map(
    publishedStays.map((stay) => [stay.id, stay.location_text?.trim() || ''])
  );
  const linkedPublishedTitlesByAccommodationId = new Map<string, string[]>();
  const linkedPublishedLocationsByAccommodationId = new Map<string, string[]>();
  for (const link of stayAccommodationLinksRaw ?? []) {
    const stayTitle = publishedStayTitleById.get(link.stay_id);
    if (!stayTitle) continue;
    const titles = linkedPublishedTitlesByAccommodationId.get(link.accommodation_id) ?? [];
    titles.push(stayTitle);
    linkedPublishedTitlesByAccommodationId.set(link.accommodation_id, titles);

    const stayLocation = publishedStayLocationById.get(link.stay_id);
    if (stayLocation) {
      const locations = linkedPublishedLocationsByAccommodationId.get(link.accommodation_id) ?? [];
      locations.push(stayLocation);
      linkedPublishedLocationsByAccommodationId.set(link.accommodation_id, locations);
    }
  }

  const coverImageByAccommodationId = new Map<string, string>();
  for (const media of accommodationMediaRaw ?? []) {
    if (!coverImageByAccommodationId.has(media.accommodation_id)) {
      coverImageByAccommodationId.set(media.accommodation_id, media.url);
    }
  }

  const accommodations = (accommodationsRaw ?? []).map((accommodation) => {
    const locationMeta = extractAccommodationLocationMeta(accommodation.description);
    return {
      ...accommodation,
      description: locationMeta.description,
      locationLabel: locationMeta.locationLabel,
      coverImage: coverImageByAccommodationId.get(accommodation.id) ?? null,
      linkedStayTitles: linkedPublishedTitlesByAccommodationId.get(accommodation.id) ?? [],
      linkedStayLocations: linkedPublishedLocationsByAccommodationId.get(accommodation.id) ?? []
    };
  });
  const featuredPublishedStays = publishedStays.slice(0, 3);
  const organizerCatalogHref = `/sejours?organizer=${encodeURIComponent(organizerName)}`;

  const presentationHtml = buildOrganizerPresentationHtml(
    resolvedOrganizer?.description ?? fallbackOrganizer?.description,
    publicAgeRange
  );
  const heroIntroText =
    resolvedOrganizer?.hero_intro_text?.trim() ||
    extractOrganizerPresentationSummary(
      resolvedOrganizer?.description ?? fallbackOrganizer?.description,
      publicAgeRange
    ) ||
    `Découvrez les séjours collectifs proposés par ${organizerDisplayName}.`;

  return (
    <div className="min-h-screen bg-[#fcfcfb]">
      <section
        className="relative overflow-hidden bg-[#edf7f5]"
        style={
          bannerPath
            ? {
                backgroundImage: `url(${bannerPath})`,
                backgroundPosition: 'center',
                backgroundRepeat: 'no-repeat',
                backgroundSize: 'cover'
              }
            : undefined
        }
      >
        <div
          className="absolute inset-x-0 bottom-0 h-20 bg-white/35 sm:h-24"
          style={{ clipPath: 'polygon(0 0, 14% 12%, 36% 28%, 63% 56%, 86% 86%, 100% 40%, 100% 100%, 0 100%)' }}
        />
        <div
          className="absolute inset-x-0 bottom-0 h-16 bg-[#fcfcfb] sm:h-20"
          style={{ clipPath: 'polygon(0 0, 17% 8%, 39% 24%, 66% 52%, 87% 84%, 100% 36%, 100% 100%, 0 100%)' }}
        />
        <div className="section-container relative py-5 sm:py-6 lg:py-8">
          <Link
            href="/organisateurs"
            className={`absolute -left-6 top-3 inline-flex text-sm font-semibold sm:-left-10 sm:top-4 lg:-left-16 lg:top-5 ${heroLinkClass}`}
          >
            ← Retour aux organisateurs
          </Link>

          <div className="relative mt-0 grid gap-8 lg:min-h-[27rem] lg:grid-cols-[minmax(0,1.15fr)_minmax(260px,0.85fr)] lg:items-center">
            <div className="relative z-[1] max-w-[44rem] self-center -ml-8 px-0 py-0 sm:-ml-12 lg:-ml-20">
                <p className="text-[0.65rem] font-extrabold uppercase tracking-[0.18em] text-[#6DC7FE] sm:text-[0.7rem]">
                  Organisateur de séjours collectifs
                </p>
                <h1 className={`mt-5 max-w-[18ch] font-display text-4xl font-bold leading-[1.08] sm:max-w-[19ch] sm:text-5xl lg:max-w-[20ch] lg:text-[4rem] ${heroTextClass}`}>
                  <span className="block">{organizerTitleLines.firstLine}</span>
                  {organizerTitleLines.secondLine ? (
                    <span className="block">{organizerTitleLines.secondLine}</span>
                  ) : null}
                </h1>

                <div className={`mt-7 max-w-[34rem] whitespace-pre-line text-sm font-bold leading-[1.6] sm:text-[0.95rem] ${heroTextClass}`}>
                  <p>{heroIntroText}</p>
                </div>

            </div>

            <div className="relative z-[1] flex items-center justify-center lg:justify-end">
              <div className="flex min-h-[190px] w-full max-w-[24rem] items-center justify-center p-3 sm:p-4 lg:min-h-[220px]">
                {logoUrl ? (
                  <img
                    src={logoUrl}
                    alt={organizerDisplayName}
                    className={resolveHeroLogoImageClass(organizerSlug)}
                  />
                ) : bannerPath ? (
                  <div className="relative h-40 w-40 overflow-hidden rounded-full bg-white/15 shadow-[0_18px_40px_-28px_rgba(15,23,42,0.35)] sm:h-48 sm:w-48 lg:h-56 lg:w-56">
                    <img
                      src={bannerPath}
                      alt={organizerDisplayName}
                      className="h-full w-full scale-[2.35] object-cover"
                      style={{ objectPosition: resolveHeroLogoFallbackPosition(organizerSlug) }}
                    />
                  </div>
                ) : (
                  <div className="flex h-40 w-40 items-center justify-center rounded-full bg-white/90 text-5xl font-bold text-slate-300 shadow-[0_18px_40px_-28px_rgba(15,23,42,0.35)]">
                    {organizerDisplayName.slice(0, 2)}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="relative bg-white pb-28 pt-10 sm:pb-32 sm:pt-12">
        <div className="section-container">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,0.56fr)_minmax(340px,0.44fr)] lg:gap-10">
            <div className="max-w-4xl -ml-8 sm:-ml-12 lg:-ml-20">
              <p className="text-sm font-bold uppercase tracking-[0.12em] text-slate-400">Présentation</p>
              <h1 className="mt-2 font-display text-4xl font-bold leading-[1.02] text-[#505050] sm:text-5xl lg:text-[3.6rem]">
                {organizerDisplayName}
              </h1>
              <div
                className="mt-5 text-left text-[0.88rem] font-medium leading-[1.6] text-slate-600 sm:text-[0.95rem] [&_b]:text-[1rem] [&_b]:font-extrabold [&_br]:block [&_br]:content-[''] [&_em]:italic [&_i]:italic [&_li]:ml-5 [&_li]:list-disc [&_li]:pl-1 [&_ol]:ml-5 [&_ol]:list-decimal [&_ol]:space-y-2 [&_p]:mb-4 [&_strong]:text-[1rem] [&_strong]:font-extrabold [&_u]:underline [&_ul]:space-y-2 sm:[&_b]:text-[1.05rem] sm:[&_strong]:text-[1.05rem]"
                dangerouslySetInnerHTML={{ __html: presentationHtml }}
              />
              {projectUrl && (
                <a
                  className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-slate-700 underline decoration-slate-300 underline-offset-4"
                  href={projectUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Télécharger le projet éducatif
                  <ExternalLink className="h-4 w-4" />
                </a>
              )}
            </div>

            <div className="hidden lg:block lg:self-start lg:pt-[6.4rem]">
              <div className="ml-auto w-full max-w-[30rem] rounded-[28px] border border-slate-200 bg-slate-50/80 p-6 shadow-[0_18px_40px_-28px_rgba(15,23,42,0.18)]">
                {seasonHeading ? (
                  <p className="text-[0.72rem] font-extrabold uppercase tracking-[0.18em] text-slate-900">
                    {seasonHeading}
                  </p>
                ) : null}
                {selectedSeasonOptions.length > 0 ? (
                  <div className="mt-5 flex flex-wrap gap-4">
                    {selectedSeasonOptions.map((season) => (
                      <div
                        key={season.key}
                        className="group relative flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-[0_10px_24px_-18px_rgba(15,23,42,0.35)]"
                      >
                        <Image
                          src={season.iconPath}
                          alt={season.label}
                          width={40}
                          height={40}
                          className="h-6 w-6 object-contain"
                        />
                        <span className="pointer-events-none absolute -top-3 left-1/2 z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white opacity-0 shadow-[0_12px_24px_-16px_rgba(15,23,42,0.7)] transition-opacity duration-150 group-hover:opacity-100">
                          {season.label}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-5 max-w-[14rem] text-sm leading-6 text-slate-500">
                    Aucune saison mise en avant pour le moment.
                  </p>
                )}
                {stayTypeHeading ? (
                  <p className="mt-8 text-[0.72rem] font-extrabold uppercase tracking-[0.18em] text-slate-900">
                    {stayTypeHeading}
                  </p>
                ) : null}
                {selectedStayTypeOptions.length > 0 ? (
                  <div className="mt-5 flex flex-wrap gap-4">
                    {selectedStayTypeOptions.map((stayType) => (
                      <div
                        key={stayType.key}
                        className="group relative flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-[0_10px_24px_-18px_rgba(15,23,42,0.35)]"
                      >
                        <Image
                          src={stayType.iconPath}
                          alt={stayType.label}
                          width={40}
                          height={40}
                          className="h-6 w-6 object-contain"
                        />
                        <span className="pointer-events-none absolute -top-3 left-1/2 z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white opacity-0 shadow-[0_12px_24px_-16px_rgba(15,23,42,0.7)] transition-opacity duration-150 group-hover:opacity-100">
                          {stayType.label}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : null}
                <p className="mt-8 text-[0.72rem] font-extrabold uppercase tracking-[0.18em] text-slate-900">
                  Durées de séjour :
                </p>
                <div className="mt-3 flex items-center gap-3">
                  <Image
                    src="/image/sejours/pictos_duree/duree.png"
                    alt=""
                    width={24}
                    height={24}
                    className="h-6 w-6 shrink-0 object-contain"
                  />
                  <p className="text-sm font-semibold leading-relaxed text-slate-700">{stayDurationLabel}</p>
                </div>
                <p className="mt-8 text-[0.72rem] font-extrabold uppercase tracking-[0.18em] text-slate-900">
                  Tranche d&apos;âge :
                </p>
                <div className="mt-3 flex items-center gap-3">
                  <Image
                    src="/image/sejours/pictos_age/age.png"
                    alt=""
                    width={24}
                    height={24}
                    className="h-6 w-6 shrink-0 object-contain"
                  />
                  <p className="text-sm font-semibold leading-relaxed text-slate-700">{publicAgeRange}</p>
                </div>
                {activityHeading ? (
                  <p className="mt-8 text-[0.72rem] font-extrabold uppercase tracking-[0.18em] text-slate-900">
                    {activityHeading}
                  </p>
                ) : null}
                {selectedActivityOptions.length > 0 ? (
                  <div className="mt-5 flex flex-wrap gap-4">
                    {selectedActivityOptions.map((activity) => (
                      <div
                        key={activity.key}
                        className="group relative flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-[0_10px_24px_-18px_rgba(15,23,42,0.35)]"
                      >
                        <Image
                          src={activity.iconPath}
                          alt={activity.label}
                          width={40}
                          height={40}
                          className="h-6 w-6 object-contain"
                        />
                        <span className="pointer-events-none absolute -top-3 left-1/2 z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white opacity-0 shadow-[0_12px_24px_-16px_rgba(15,23,42,0.7)] transition-opacity duration-150 group-hover:opacity-100">
                          {activity.label}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <div className="pointer-events-none absolute inset-x-0 bottom-0 translate-y-1/2 px-4 sm:px-6">
            <div className="mx-auto grid max-w-[30rem] justify-center gap-4 md:grid-cols-2">
              <article className="pointer-events-auto flex min-h-[116px] w-full max-w-[210px] flex-col items-center justify-center rounded-[18px] bg-white px-4 py-3 text-center shadow-[0_18px_44px_-34px_rgba(15,23,42,0.2)] sm:px-4 sm:py-4">
                <Image
                  src="/image/organisateurs/pictos_orga/creation.png"
                  alt=""
                  width={82}
                  height={82}
                  className="h-8 w-8 object-contain sm:h-9 sm:w-9"
                />
                <h2 className="mt-2 font-display text-[1.05rem] font-bold leading-none text-[#FA8500]">
                  Création
                </h2>
                <p className="mt-2 font-display text-[1.3rem] font-bold leading-none text-[#505050]">
                  {resolvedOrganizer?.founded_year ?? fallbackOrganizer?.creationYear ?? '—'}
                </p>
              </article>

              <article className="pointer-events-auto flex min-h-[116px] w-full max-w-[210px] flex-col items-center justify-center rounded-[18px] bg-white px-4 py-3 text-center shadow-[0_18px_44px_-34px_rgba(15,23,42,0.2)] sm:px-4 sm:py-4">
                <Image
                  src="/image/organisateurs/pictos_orga/age.png"
                  alt=""
                  width={82}
                  height={82}
                  className="h-8 w-8 object-contain sm:h-9 sm:w-9"
                />
                <h2 className="mt-2 font-display text-[1.05rem] font-bold leading-none text-[#FA8500]">
                  Public
                </h2>
                <p className="mt-2 font-display text-[1.3rem] font-bold leading-none text-[#505050]">{publicAgeRange}</p>
              </article>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[#ece9e5] pb-12 pt-20 sm:pb-14 sm:pt-24">
        <div className="section-container">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,0.42fr)_minmax(0,0.58fr)] lg:items-start lg:gap-10">
            <div className="max-w-md">
              <p className="text-[0.72rem] font-extrabold uppercase tracking-[0.18em] text-slate-500">
                Hébergements
              </p>
              <h2 className="mt-2 font-display text-[2.45rem] font-bold leading-[1.02] text-[#505050] sm:text-[2.8rem]">
                Coup d&apos;oeil sur
                <span className="mt-2 block text-[#FA8500]">{organizerDisplayName}</span>
              </h2>
              <p className="mt-5 max-w-sm text-sm font-medium leading-6 text-slate-600 sm:text-base">
                Un petit aperçu des lieux de séjours de {organizerDisplayName} :
              </p>
            </div>

            {accommodations.length > 0 ? (
              <HorizontalCardsCarousel>
                <div className="flex min-w-max gap-5 pr-2">
                  {accommodations.map((accommodation) => {
                    const locationLabel =
                      accommodation.locationLabel ?? accommodation.linkedStayLocations.find(Boolean) ?? '';
                    return (
                      <article
                        key={accommodation.id}
                        className="group w-[280px] shrink-0 overflow-hidden rounded-[28px] bg-white shadow-[0_18px_40px_-28px_rgba(15,23,42,0.35)]"
                      >
                        <div className="relative h-[320px] bg-slate-100">
                          {accommodation.coverImage ? (
                            <img
                              src={accommodation.coverImage}
                              alt={accommodation.name}
                              className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                            />
                          ) : (
                            <div className="flex h-full items-center justify-center bg-slate-100 text-slate-400">
                              <MapPin className="h-10 w-10" />
                            </div>
                          )}
                          <div className="absolute inset-x-0 bottom-0 bg-white/92 px-4 py-3 backdrop-blur-sm">
                            <p className="text-sm font-semibold text-[#505050]">
                              {formatAccommodationCarouselLabel(
                                accommodation.accommodation_type,
                                locationLabel
                              )}
                            </p>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </HorizontalCardsCarousel>
            ) : (
              <div className="rounded-[28px] border border-dashed border-slate-200 bg-white p-8 text-sm text-slate-500">
                Aucun hébergement n’est encore présenté pour cet organisateur.
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="section-container pb-20 pt-8 sm:pt-10">
        <div>
          <p className="text-[0.72rem] font-extrabold uppercase tracking-[0.18em] text-slate-500">Séjours</p>
          <h2 className="mt-2 font-display text-3xl font-bold leading-[1.06] text-[#505050]">
            Quelques séjours publiés
          </h2>
        </div>

        {featuredPublishedStays.length > 0 ? (
          <div className="mt-6 grid grid-cols-1 items-stretch justify-items-center gap-8 sm:grid-cols-2 sm:justify-items-stretch lg:grid-cols-3">
            {featuredPublishedStays.map((stay) => {
              const stayRow = stay as {
                seasons?: unknown;
              };
              const seasonNameJoined = pickSeasonNameFromJoin(stayRow.seasons);
              const seasonDisplay = resolveStaySeasonPicto(seasonNameJoined);
              const sessionMeta = buildFeaturedStaySessionMeta(
                featuredSessionsByStayId.get(stay.id) ?? []
              );
              const coverUrl =
                (stay as { coverImage?: string | null }).coverImage ??
                coverImageByStayId.get(stay.id) ??
                null;
              return (
                <div key={stay.id} className="flex h-full min-h-[520px] justify-center">
                  <OrganizerStayPreviewCard
                  title={stay.title}
                  summary={stay.summary ?? null}
                  description={stay.description ?? null}
                  locationLabel={stay.location_text?.trim() || 'Lieu à préciser'}
                  ageRangeLabel={formatPublicAgeRange(stay.age_min, stay.age_max)}
                  seasonIconSrc={seasonDisplay.iconPath}
                  seasonBadge={seasonDisplay.badgeText}
                  durationLabel={sessionMeta.durationLabel}
                  priceFromEuros={sessionMeta.priceFrom}
                  coverUrl={coverUrl}
                  href={formatStayHref(organizerName, stay.title, stay.id)}
                  organizerLogoUrl={logoUrl}
                  organizerName={organizerDisplayName}
                />
                </div>
              );
            })}
          </div>
        ) : (
          <div className="mt-6 rounded-[28px] border border-dashed border-slate-200 bg-white p-8 text-sm text-slate-500">
            Aucun séjour publié n’est encore disponible pour cet organisateur.
          </div>
        )}

        {publishedStays.length > 3 && (
          <div className="mt-8 flex justify-center">
            <Link
              href={organizerCatalogHref}
              className="cta-orange-sweep inline-flex items-center rounded-full px-6 py-3 text-sm font-bold text-white"
            >
              Découvrir les autres séjours
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}
