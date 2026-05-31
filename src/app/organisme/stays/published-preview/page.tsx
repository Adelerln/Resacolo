import Link from 'next/link';
import { redirect } from 'next/navigation';
import { OrganizerStayPreviewCard } from '@/components/organisateurs/OrganizerStayPreviewCard';
import { StayDetailView } from '@/components/sejours/StayDetailView';
import { FavoritesProvider } from '@/components/favorites/FavoritesProvider';
import PublishDraftNowButton from '@/components/organisme/PublishDraftNowButton';
import OrganizerPageHeader from '@/components/organisme/OrganizerPageHeader';
import { requireOrganizerPageAccess } from '@/lib/organizer-backoffice-access.server';
import { withOrganizerQuery } from '@/lib/organizers.server';
import { resolveStaySeasonPicto } from '@/lib/organizer-profile-options';
import { staySessionsAppearFullyBooked } from '@/lib/stay-catalog-availability';
import { getStayCanonicalPath, getStays } from '@/lib/stays';
import { readDraftDestinationFields } from '@/lib/stay-draft-destination';
import { getServerSupabaseClient } from '@/lib/supabase/server';
import type { Stay, StaySessionOption } from '@/types/stay';
import { slugify } from '@/lib/utils';

type PageProps = {
  searchParams?: Promise<{
    organizerId?: string | string[];
    stayId?: string | string[];
    draftId?: string | string[];
  }>;
};

function readSearchParam(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

function normalizeString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function withFrenchAccents(value: string): string {
  return value
    .replace(/\bEgypte\b/g, 'Égypte')
    .replace(/\begypte\b/g, 'égypte');
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function formatAgeRange(ages: unknown): string {
  if (!Array.isArray(ages)) return 'Tous âges';
  const numericAges = ages
    .map((age) => Number(age))
    .filter((age) => Number.isFinite(age))
    .sort((a, b) => a - b);
  if (numericAges.length === 0) return 'Tous âges';
  if (numericAges.length === 1) return `${numericAges[0]} ans`;
  return `${numericAges[0]}-${numericAges[numericAges.length - 1]} ans`;
}

function formatDurationFromSessions(sessions: unknown): string {
  if (!Array.isArray(sessions) || sessions.length === 0) return 'Durée à venir';
  const first = sessions[0] as Record<string, unknown>;
  const duration = first?.duration_days;
  const days = typeof duration === 'number' ? duration : Number(duration);
  if (!Number.isFinite(days) || days <= 0) return 'Durée à venir';
  return `${Math.round(days)} jours`;
}

function toNumberOrNull(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function buildPreviewSessions(sessions: unknown): StaySessionOption[] {
  if (!Array.isArray(sessions)) return [];
  return sessions
    .map<StaySessionOption | null>((row, index) => {
      if (!row || typeof row !== 'object' || Array.isArray(row)) return null;
      const item = row as Record<string, unknown>;
      const start = normalizeString(item.start_date);
      const end = normalizeString(item.end_date);
      if (!start || !end) return null;
      return {
        id: `draft-session-${index + 1}`,
        startDate: start,
        endDate: end,
        price: toNumberOrNull(item.price),
        status: normalizeString(item.availability).toLowerCase() === 'full' ? 'FULL' : 'OPEN',
        transportOptions: [] as StaySessionOption['transportOptions']
      } satisfies StaySessionOption;
    })
    .filter((row): row is StaySessionOption => row !== null);
}

function buildPreviewStayFromDraft(input: {
  draftId: string;
  organizerId: string;
  title: string;
  summary: string;
  description: string;
  locationLabel: string;
  regionText: string;
  ageRangeLabel: string;
  durationLabel: string;
  coverUrl: string | null;
  sessions: unknown;
  destination: ReturnType<typeof readDraftDestinationFields>;
}): Stay {
  const slug = slugify(input.title) || `draft-${input.draftId}`;
  const previewSessions = buildPreviewSessions(input.sessions);
  const ageRangeMatch = input.ageRangeLabel.match(/(\d+)(?:-(\d+))?/);
  const ageMin = ageRangeMatch?.[1] ? Number(ageRangeMatch[1]) : null;
  const ageMax = ageRangeMatch?.[2] ? Number(ageRangeMatch[2]) : ageMin;

  return {
    id: input.draftId,
    title: input.title,
    slug,
    canonicalSlug: slug,
    legacySlugs: [],
    summary: input.summary,
    description: input.description,
    seasonId: 'draft',
    seasonName: '',
    organizerId: input.organizerId,
    organizer: {
      name: 'Organisateur',
      website: '',
      slug: undefined,
      logoUrl: undefined
    },
    location: input.locationLabel,
    displayLocation: input.locationLabel,
    region: input.regionText || '',
    country: input.destination.destinationCountry ?? '',
    destinationType: input.destination.destinationType ?? null,
    destinationCity: input.destination.destinationCity,
    destinationPostalCode: input.destination.destinationPostalCode,
    destinationDepartmentCode: input.destination.destinationDepartmentCode,
    destinationRegion: input.destination.destinationRegion,
    destinationCountry: input.destination.destinationCountry,
    destinationItineraryLabel: input.destination.destinationItineraryLabel,
    destinationCountries: input.destination.destinationCountries,
    ageMin,
    ageMax,
    ageRange: input.ageRangeLabel,
    duration: input.durationLabel,
    priceFrom: null,
    period: [],
    categories: [],
    highlights: [],
    activitiesText: '',
    programText: '',
    transportText: '',
    coverImage: input.coverUrl ?? undefined,
    galleryImages: input.coverUrl ? [input.coverUrl] : [],
    videoUrls: [],
    filters: {
      categories: [],
      audiences: [],
      durations: [],
      periods: [],
      priceRange: null,
      transport: []
    },
    bookingOptions: {
      transportMode: '',
      sessions: previewSessions,
      insuranceOptions: [],
      extraOptions: []
    },
    centerLocations: [],
    accommodations: [],
    updatedAt: new Date().toISOString()
  };
}

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function OrganizerPublishedPreviewPage({ searchParams }: PageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const requestedOrganizerId = readSearchParam(resolvedSearchParams?.organizerId);
  const stayId = readSearchParam(resolvedSearchParams?.stayId)?.trim() ?? '';
  const draftId = readSearchParam(resolvedSearchParams?.draftId)?.trim() ?? '';

  const { selectedOrganizerId } = await requireOrganizerPageAccess({
    requestedOrganizerId,
    requiredSection: 'stays'
  });

  if (!selectedOrganizerId || (!stayId && !draftId)) {
    redirect(
      withOrganizerQuery(
        '/organisme/sejours?error=Aper%C3%A7u%20indisponible%20(identifiant%20manquant).',
        selectedOrganizerId
      )
    );
  }

  if (stayId) {
    const stays = await getStays();
    const stay = stays.find((row) => row.id === stayId && row.organizerId === selectedOrganizerId);

    if (!stay) {
      redirect(
        withOrganizerQuery(
          '/organisme/sejours?error=Le%20s%C3%A9jour%20publi%C3%A9%20est%20introuvable%20dans%20le%20catalogue.',
          selectedOrganizerId
        )
      );
    }

    const season = resolveStaySeasonPicto(stay.seasonName || stay.period[0] || null);
    const isFullyBooked = staySessionsAppearFullyBooked(stay.bookingOptions?.sessions);
    const stayPath = getStayCanonicalPath(stay);
    const cardSearchHref = `/sejours?q=${encodeURIComponent(stay.title)}`;

    return (
      <div className="space-y-6">
        <OrganizerPageHeader
          title="Séjour publié avec succès"
          subtitle="Le séjour est en ligne. Vérifie le rendu public avant de revenir à ta liste."
        />

        <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 sm:p-6">
          <h2 className="text-lg font-semibold text-emerald-900">Aperçu fiche séjour</h2>
          <p className="mt-2 text-sm text-emerald-800">
            Titre : <strong>{stay.title}</strong>
            <br />
            Localisation : {stay.displayLocation || stay.location || stay.region || 'Lieu à préciser'}
            <br />
            Âges : {stay.ageRange || 'Tous âges'} · Durée : {stay.duration || 'Durée à venir'}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href={stayPath} target="_blank" rel="noreferrer" className="organizer-btn-primary">
              Voir la fiche publique
            </Link>
            <Link href={cardSearchHref} target="_blank" rel="noreferrer" className="organizer-btn-secondary">
              Voir la card dans /sejours
            </Link>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
          <h2 className="text-lg font-semibold text-slate-900">Aperçu fiche séjour (sans clic)</h2>
          <p className="mt-2 text-sm text-slate-600">
            Prévisualisation directe de la page publique telle qu’elle sera vue côté familles.
          </p>
          <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
            <iframe
              title={`Aperçu fiche séjour ${stay.title}`}
              src={stayPath}
              className="h-[860px] w-full bg-white"
              loading="lazy"
            />
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
          <h2 className="text-lg font-semibold text-slate-900">Aperçu card catalogue</h2>
          <div className="mt-4 flex justify-center">
            <OrganizerStayPreviewCard
              title={stay.title}
              summary={stay.summary}
              description={stay.description}
              locationLabel={stay.displayLocation || stay.location || stay.region || 'Lieu à préciser'}
              ageRangeLabel={stay.ageRange || 'Tous âges'}
              seasonIconSrc={season.iconPath}
              seasonBadge={season.badgeText}
              durationLabel={stay.duration || 'Durée à venir'}
              priceFromEuros={stay.priceFrom}
              partnerPriceFromEuros={stay.partnerPriceFrom ?? null}
              partnerDiscountPercent={stay.partnerDiscountPercent ?? null}
              partnerFinanceMode={stay.partnerFinanceMode ?? null}
              partnerFinancePercentValue={stay.partnerFinancePercentValue ?? null}
              partnerFinanceFixedCents={stay.partnerFinanceFixedCents ?? null}
              csePriceFromEuros={stay.csePriceFrom ?? null}
              cseAidFromEuros={stay.cseAidFrom ?? null}
              cseLabel={stay.cseLabel ?? null}
              coverUrl={stay.coverImage ?? null}
              href={stayPath}
              organizerLogoUrl={stay.organizer.logoUrl ?? null}
              organizerName={stay.organizer.name}
              disableBlueHoverEffect
              compact
              liftOnHover
              isFullyBooked={isFullyBooked}
            />
          </div>
        </section>
      </div>
    );
  }

  const supabase = getServerSupabaseClient();
  const { data: draft } = await supabase
    .from('stay_drafts')
    .select('id,title,summary,location_text,region_text,ages,sessions_json,images,status,raw_payload,description')
    .eq('id', draftId)
    .eq('organizer_id', selectedOrganizerId)
    .maybeSingle();

  if (!draft) {
    redirect(
      withOrganizerQuery(
        '/organisme/sejours?error=Brouillon%20introuvable%20pour%20l%E2%80%99aper%C3%A7u.',
        selectedOrganizerId
      )
    );
  }

  const rawPayload = toRecord(draft.raw_payload);
  const destination = readDraftDestinationFields(rawPayload);
  const title = withFrenchAccents(normalizeString(draft.title) || 'Séjour sans titre');
  const summary = withFrenchAccents(normalizeString(draft.summary));
  const description = withFrenchAccents(normalizeString(draft.description));
  const locationLabel =
    withFrenchAccents(destination.destinationCity || '') ||
    withFrenchAccents(destination.destinationCountry || '') ||
    withFrenchAccents(normalizeString(draft.location_text)) ||
    withFrenchAccents(normalizeString(draft.region_text)) ||
    'Lieu à préciser';
  const ageRangeLabel = formatAgeRange(draft.ages);
  const durationLabel = formatDurationFromSessions(draft.sessions_json);
  const images = Array.isArray(draft.images) ? draft.images.filter((v): v is string => typeof v === 'string') : [];
  const coverUrl = images[0] ?? null;
  const seasonNames = Array.isArray(rawPayload.draft_season_names)
    ? rawPayload.draft_season_names.filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
    : [];
  const season = resolveStaySeasonPicto(seasonNames[0] ?? null);
  const previewStay = buildPreviewStayFromDraft({
    draftId,
    organizerId: selectedOrganizerId,
    title,
    summary,
    description,
    locationLabel,
    regionText: normalizeString(draft.region_text),
    ageRangeLabel,
    durationLabel,
    coverUrl,
    sessions: draft.sessions_json,
    destination
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
          Validation visuelle avant publication
        </h1>
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
        <h2 className="text-lg font-semibold text-slate-900">Aperçu card catalogue</h2>
        <div className="mt-4 flex justify-center">
          <OrganizerStayPreviewCard
            title={title}
            summary={summary}
            description={description}
            locationLabel={locationLabel}
            ageRangeLabel={ageRangeLabel}
            seasonIconSrc={season.iconPath}
            seasonBadge={season.badgeText}
            durationLabel={durationLabel}
            priceFromEuros={null}
            partnerPriceFromEuros={null}
            partnerDiscountPercent={null}
            partnerFinanceMode={null}
            partnerFinancePercentValue={null}
            partnerFinanceFixedCents={null}
            csePriceFromEuros={null}
            cseAidFromEuros={null}
            cseLabel={null}
            coverUrl={coverUrl}
            href="#"
            organizerLogoUrl={null}
            organizerName="Organisateur"
            disableBlueHoverEffect
            compact
            liftOnHover
            isFullyBooked={false}
          />
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
        <h2 className="text-lg font-semibold text-slate-900">Aperçu fiche séjour</h2>
        <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white">
          <FavoritesProvider>
            <StayDetailView stay={previewStay} />
          </FavoritesProvider>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
        <div className="flex flex-wrap items-start gap-3">
          <PublishDraftNowButton draftId={draftId} organizerId={selectedOrganizerId} />
          <Link
            href={withOrganizerQuery(`/organisme/sejours/drafts/${draftId}`, selectedOrganizerId)}
            className="organizer-btn-secondary px-6 py-3 text-base font-semibold"
          >
            Modifier le séjour
          </Link>
        </div>
      </section>
    </div>
  );
}
