import Link from 'next/link';
import { redirect } from 'next/navigation';
import PublishedStaySessionsStep from '@/components/organisme/PublishedStaySessionsStep';
import StayDraftReviewForm from '@/components/organisme/StayDraftReviewForm';
import { requireRole } from '@/lib/auth/require';
import { mapPublishedStayToReviewPayload } from '@/lib/map-published-stay-to-review-payload';
import { resolveOrganizerSelection, withOrganizerQuery } from '@/lib/organizers.server';
import { getReservedSessionCounts } from '@/lib/session-reservations';
import { getServerSupabaseClient } from '@/lib/supabase/server';
import { extractAccommodationLocationMeta } from '@/lib/accommodation-location';

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

export default async function OrganizerStayEditTunnelPage({ params: paramsPromise, searchParams }: PageProps) {
  const params = await paramsPromise;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const session = await requireRole('ORGANISATEUR');
  const supabase = getServerSupabaseClient();
  const { selectedOrganizerId } = await resolveOrganizerSelection(
    resolvedSearchParams?.organizerId,
    session.tenantId ?? null
  );

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
    { data: sessionsRaw },
    { data: mediaRaw },
    { data: accommodationsRaw },
    { data: stayAccommodationLinksRaw },
    { data: extraOptionsRaw },
    { data: insuranceOptionsRaw },
    { data: transportOptionsRaw }
  ] = await Promise.all([
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
        'id,name,accommodation_type,description,bed_info,bathroom_info,catering_info,accessibility_info,status'
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

  const sessions = sessionsRaw ?? [];
  const reservedSessionCounts = await getReservedSessionCounts(
    supabase,
    sessions.map((s) => s.id)
  );

  const accommodations = (accommodationsRaw ?? []).map((accommodation) => {
    const locationMeta = extractAccommodationLocationMeta(accommodation.description);
    return {
      ...accommodation,
      description: locationMeta.description,
      locationLabel: locationMeta.locationLabel
    };
  });
  const stayAccommodationLinks = stayAccommodationLinksRaw ?? [];
  const linkedAccommodations = stayAccommodationLinks
    .map((link) => accommodations.find((item) => item.id === link.accommodation_id))
    .filter((item): item is NonNullable<typeof item> => Boolean(item));
  const linkedAccommodation = linkedAccommodations[0] ?? null;

  const initialPayload = mapPublishedStayToReviewPayload({
    stay,
    sessions,
    reservedSessionCounts,
    extraOptions: extraOptionsRaw ?? [],
    insuranceOptions: insuranceOptionsRaw ?? [],
    transportOptions: transportOptionsRaw ?? [],
    media: mediaRaw ?? []
  });

  const backHref = withOrganizerQuery(`/organisme/sejours/${stay.id}`, selectedOrganizerId);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Modifier le séjour</h1>
          <p className="text-sm text-slate-600">
            Tunnel d&apos;édition — mêmes étapes que la relecture d&apos;un brouillon.
          </p>
        </div>
        <Link
          href={backHref}
          className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"
        >
          Retour à la fiche
        </Link>
      </div>

      <StayDraftReviewForm
        draftId={stay.id}
        organizerId={stay.organizer_id}
        backHref={backHref}
        initialPayload={initialPayload}
        initialStatus={stay.status}
        initialValidatedAt={null}
        initialValidatedByUserId={null}
        hideTopStatusCard
        variant="published"
        linkedAccommodation={
          linkedAccommodation
            ? {
                id: linkedAccommodation.id,
                name: linkedAccommodation.name,
                accommodationType: linkedAccommodation.accommodation_type
              }
            : null
        }
        publishedSessionsStep={
          <PublishedStaySessionsStep
            stayId={stay.id}
            organizerId={selectedOrganizerId}
            returnTo="edit"
            sessions={sessions}
            reservedSessionCounts={reservedSessionCounts}
          />
        }
      />
    </div>
  );
}
