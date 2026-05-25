import Link from 'next/link';
import { redirect } from 'next/navigation';
import OrganizerPageHeader from '@/components/organisme/OrganizerPageHeader';
import StayDraftReviewForm from '@/components/organisme/StayDraftReviewForm';
import { requireOrganizerPageAccess } from '@/lib/organizer-backoffice-access.server';
import { mapPublishedStayToReviewPayload } from '@/lib/map-published-stay-to-review-payload';
import { withOrganizerQuery } from '@/lib/organizers.server';
import { getReservedSessionCounts } from '@/lib/session-reservations';
import { getServerSupabaseClient } from '@/lib/supabase/server';
import { extractAccommodationLocationMeta } from '@/lib/accommodation-location';
import {
  extractGoogleMapsEmbedSrcFromInput,
  readMapIframeHtmlFromAiExtractedData
} from '@/lib/google-maps-iframe';

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{
    organizerId?: string | string[];
    saved?: string | string[];
    error?: string | string[];
  }>;
};

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const SEASON_ORDER = ['Hiver', 'Printemps', 'Été', 'Automne', 'Toussaint', "Fin d'année"];

type DraftSeasonOption = {
  id: string;
  name: string;
};

export default async function OrganizerStayEditTunnelPage({ params: paramsPromise, searchParams }: PageProps) {
  const params = await paramsPromise;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const { selectedOrganizerId } = await requireOrganizerPageAccess({
    requestedOrganizerId: resolvedSearchParams?.organizerId,
    requiredSection: 'stays'
  });
  const supabase = getServerSupabaseClient();

  if (!selectedOrganizerId) {
    redirect('/organisme/sejours');
  }

  const { data: stay } = await supabase
    .from('stays')
    .select('*')
    .eq('id', params.id)
    .maybeSingle();

  if (!stay || stay.organizer_id !== selectedOrganizerId) {
    redirect(withOrganizerQuery('/organisme/sejours', selectedOrganizerId));
  }

  const [
    { data: seasonsRaw },
    { data: sessionsRaw },
    { data: mediaRaw },
    { data: accommodationsRaw },
    { data: stayAccommodationLinksRaw },
    { data: extraOptionsRaw },
    { data: insuranceOptionsRaw },
    { data: transportOptionsRaw }
  ] = await Promise.all([
    supabase.from('seasons').select('id,name').order('name', { ascending: true }),
    supabase
      .from('sessions')
      .select(
        'id,start_date,end_date,capacity_total,capacity_reserved,status,session_prices(amount_cents,currency)'
      )
      .eq('stay_id', stay.id)
      .order('start_date', { ascending: true }),
    supabase
      .from('stay_media')
      .select('id,url,position,media_type')
      .eq('stay_id', stay.id)
      .order('position', { ascending: true }),
    supabase
      .from('accommodations')
      .select(
        'id,name,accommodation_type,address_text,postal_code,city,department_code,region_text,country,description,bed_info,bathroom_info,catering_info,accessibility_info,status,map_iframe_html,ai_extracted_data'
      )
      .eq('organizer_id', selectedOrganizerId)
      .order('name', { ascending: true }),
    supabase.from('stay_accommodations').select('accommodation_id').eq('stay_id', stay.id),
    supabase
      .from('stay_extra_options')
      .select('id,label,amount_cents,position')
      .eq('stay_id', stay.id)
      .order('position', { ascending: true }),
    supabase
      .from('insurance_options')
      .select('id,label,amount_cents,percent_value,pricing_mode')
      .eq('stay_id', stay.id),
    supabase
      .from('transport_options')
      .select('id,departure_city,return_city,amount_cents,stay_id')
      .eq('stay_id', stay.id)
  ]);

  const seasonOptions: DraftSeasonOption[] = [...(seasonsRaw ?? [])].sort((a, b) => {
    const indexA = SEASON_ORDER.indexOf(a.name);
    const indexB = SEASON_ORDER.indexOf(b.name);
    if (indexA === -1 && indexB === -1) return a.name.localeCompare(b.name, 'fr');
    if (indexA === -1) return 1;
    if (indexB === -1) return -1;
    return indexA - indexB;
  });

  const sessions = sessionsRaw ?? [];
  const reservedSessionCounts = await getReservedSessionCounts(
    supabase,
    sessions.map((s) => s.id)
  );

  const accommodations = (accommodationsRaw ?? []).map((accommodation) => {
    const locationMeta = extractAccommodationLocationMeta(accommodation.description, {
      addressText: accommodation.address_text,
      postalCode: accommodation.postal_code,
      city: accommodation.city,
      departmentCode: accommodation.department_code,
      regionText: accommodation.region_text,
      country: accommodation.country
    });
    return {
      ...accommodation,
      description: locationMeta.description,
      locationLabel: locationMeta.locationLabel,
      city: locationMeta.city,
      postalCode: locationMeta.postalCode,
      departmentCode: locationMeta.departmentCode,
      regionText: locationMeta.regionText,
      country: locationMeta.country,
      locationMode: locationMeta.locationMode,
      locationCity: locationMeta.locationCity,
      locationDepartmentCode: locationMeta.locationDepartmentCode,
      locationCountry: locationMeta.locationCountry,
      itinerantZone: locationMeta.itinerantZone,
      mapEmbedSrc: extractGoogleMapsEmbedSrcFromInput(
        accommodation.map_iframe_html ?? readMapIframeHtmlFromAiExtractedData(accommodation.ai_extracted_data) ?? ''
      )
    };
  });
  const stayAccommodationLinks = stayAccommodationLinksRaw ?? [];
  const linkedAccommodations = stayAccommodationLinks
    .map((link) => accommodations.find((item) => item.id === link.accommodation_id))
    .filter((item): item is NonNullable<typeof item> => Boolean(item));
  const linkedAccommodation = linkedAccommodations[0] ?? null;

  let linkedAccommodationVideoUrls: string[] = [];
  if (linkedAccommodation?.id) {
    const { data: accommodationMediaRows } = await supabase
      .from('accommodation_media')
      .select('url')
      .eq('accommodation_id', linkedAccommodation.id);
    linkedAccommodationVideoUrls = (accommodationMediaRows ?? [])
      .map((row) => row.url)
      .filter((url): url is string => Boolean(url && typeof url === 'string'));
  }

  const initialPayload = mapPublishedStayToReviewPayload({
    stay,
    sessions,
    reservedSessionCounts,
    extraOptions: extraOptionsRaw ?? [],
    insuranceOptions: insuranceOptionsRaw ?? [],
    transportOptions: transportOptionsRaw ?? [],
    media: mediaRaw ?? [],
    linkedAccommodationDestinationFallback: linkedAccommodation
      ? {
          city: linkedAccommodation.city,
          postalCode: linkedAccommodation.postalCode,
          departmentCode: linkedAccommodation.departmentCode,
          regionText: linkedAccommodation.regionText,
          country: linkedAccommodation.country,
          locationMode: linkedAccommodation.locationMode,
          locationCity: linkedAccommodation.locationCity,
          locationDepartmentCode: linkedAccommodation.locationDepartmentCode,
          locationCountry: linkedAccommodation.locationCountry,
          itinerantZone: linkedAccommodation.itinerantZone
        }
      : null,
    linkedAccommodationVideoUrls
  });

  const backHref = withOrganizerQuery(`/organisme/sejours/${stay.id}`, selectedOrganizerId);
  const saveSuccessRedirectHref = withOrganizerQuery('/organisme/sejours', selectedOrganizerId);

  return (
    <div className="space-y-6">
      <OrganizerPageHeader
        title="Modifier le séjour"
        subtitle="Utilisez le tunnel unique pour mettre à jour la fiche publiée."
        actions={(
          <Link href={backHref} className="organizer-btn-secondary">
            Retour aux sessions
          </Link>
        )}
      />

      <StayDraftReviewForm
        draftId={stay.id}
        organizerId={stay.organizer_id}
        seasonOptions={seasonOptions}
        initialPayload={initialPayload}
        initialStatus={stay.status}
        initialValidatedAt={null}
        initialValidatedByUserId={null}
        hideTopStatusCard
        variant="published"
        saveSuccessRedirectHref={saveSuccessRedirectHref}
        linkedAccommodation={
          linkedAccommodation
            ? {
                id: linkedAccommodation.id,
                name: linkedAccommodation.name,
                accommodationType: linkedAccommodation.accommodation_type,
                mapEmbedSrc: linkedAccommodation.mapEmbedSrc
              }
            : null
        }
        organizerAccommodationPickerOptions={accommodations.map((row) => ({
          id: row.id,
          name: row.name,
          accommodationType: row.accommodation_type,
          mapEmbedSrc: row.mapEmbedSrc
        }))}
      />
    </div>
  );
}
