import { revalidatePath } from 'next/cache';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import ErrorToast from '@/components/common/ErrorToast';
import SavedToast from '@/components/common/SavedToast';
import OrganizerStaysTable from '@/components/organisme/OrganizerStaysTable';
import { requireRole } from '@/lib/auth/require';
import { resolveOrganizerSelection, withOrganizerQuery } from '@/lib/organizers.server';
import { getReservedSessionCounts } from '@/lib/session-reservations';
import { getServerSupabaseClient } from '@/lib/supabase/server';

type PageProps = {
  searchParams?: Promise<{
    organizerId?: string | string[];
    saved?: string | string[];
    error?: string | string[];
    openStay?: string | string[];
    editSession?: string | string[];
  }>;
};

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type StayAvailability = 'AVAILABLE' | 'PARTIALLY_AVAILABLE' | 'FULL';

function formatRedirectValue(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

function formatRedirectValues(value?: string | string[]) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

export default async function OrganizerStaysPage({ searchParams }: PageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const session = await requireRole('ORGANISATEUR');
  const supabase = getServerSupabaseClient();
  const { selectedOrganizer, selectedOrganizerId } = await resolveOrganizerSelection(
    resolvedSearchParams?.organizerId,
    session.tenantId ?? null
  );
  const organizerId = selectedOrganizerId;
  const savedParam = formatRedirectValue(resolvedSearchParams?.saved);
  const errorParam = formatRedirectValue(resolvedSearchParams?.error);
  const openStayParams = formatRedirectValues(resolvedSearchParams?.openStay);
  const editSessionParam = formatRedirectValue(resolvedSearchParams?.editSession);

  const { data: stays, error: staysError } = organizerId
    ? await supabase
        .from('stays')
        .select('id,title,status,season_id,created_at,location_text')
        .eq('organizer_id', organizerId)
        .order('created_at', { ascending: false })
    : { data: [], error: null };
  const safeStays = stays ?? [];
  const stayIds = safeStays.map((stay) => stay.id);

  const { data: seasons } = await supabase
    .from('seasons')
    .select('id,name');
  const seasonsById = new Map((seasons ?? []).map((season) => [season.id, season]));
  const loadError = staysError?.message ?? null;
  const { data: sessions } = stayIds.length
    ? await supabase
        .from('sessions')
        .select('id,stay_id,start_date,end_date,capacity_total,capacity_reserved,status')
        .in('stay_id', stayIds)
        .order('start_date', { ascending: true })
    : { data: [] };
  const reservedSessionCounts = await getReservedSessionCounts(
    supabase,
    (sessions ?? []).map((sessionItem) => sessionItem.id)
  );
  const allSessionsByStayId = new Map<string, NonNullable<typeof sessions>[number][]>();
  const sessionsByStayId = new Map<string, NonNullable<typeof sessions>[number][]>();

  for (const sessionItem of sessions ?? []) {
    const allGroup = allSessionsByStayId.get(sessionItem.stay_id) ?? [];
    allGroup.push(sessionItem);
    allSessionsByStayId.set(sessionItem.stay_id, allGroup);

    if (sessionItem.status === 'COMPLETED' || sessionItem.status === 'ARCHIVED') continue;
    const group = sessionsByStayId.get(sessionItem.stay_id) ?? [];
    group.push(sessionItem);
    sessionsByStayId.set(sessionItem.stay_id, group);
  }

  function getStayAvailability(stayId: string): StayAvailability {
    const staySessions = allSessionsByStayId.get(stayId) ?? [];
    if (staySessions.length === 0) return 'FULL';

    let openCount = 0;
    let closedCount = 0;

    for (const sessionItem of staySessions) {
      const reserved = reservedSessionCounts.get(sessionItem.id) ?? 0;
      const isClosed =
        sessionItem.status === 'COMPLETED' ||
        sessionItem.status === 'ARCHIVED' ||
        reserved >= sessionItem.capacity_total;

      if (isClosed) {
        closedCount += 1;
      } else {
        openCount += 1;
      }
    }

    if (openCount === 0) return 'FULL';
    if (closedCount === 0) return 'AVAILABLE';
    return 'PARTIALLY_AVAILABLE';
  }

  async function updateSessionRemainingPlaces(formData: FormData) {
    'use server';
    const supabase = getServerSupabaseClient();
    const sessionId = String(formData.get('session_id') ?? '').trim();
    const stayId = String(formData.get('stay_id') ?? '').trim();
    const remainingPlaces = Number(formData.get('remaining_places') ?? NaN);
    const nextEditSessionId = String(formData.get('next_edit_session_id') ?? '').trim();

    if (!sessionId || !stayId || Number.isNaN(remainingPlaces) || remainingPlaces < 0) {
      redirect(
        withOrganizerQuery(
          `/organisme/sejours?error=invalid-session-capacity&openStay=${encodeURIComponent(stayId)}`,
          organizerId
        )
      );
    }

    const { data: stay } = await supabase
      .from('stays')
      .select('id')
      .eq('id', stayId)
      .eq('organizer_id', organizerId)
      .maybeSingle();

    if (!stay) {
      redirect(withOrganizerQuery('/organisme/sejours?error=invalid-session-capacity', organizerId));
    }

    const { data: sessionItem } = await supabase
      .from('sessions')
      .select('id,stay_id,capacity_total,status')
      .eq('id', sessionId)
      .eq('stay_id', stayId)
      .maybeSingle();

    if (!sessionItem) {
      redirect(
        withOrganizerQuery(
          `/organisme/sejours?error=invalid-session-capacity&openStay=${encodeURIComponent(stayId)}`,
          organizerId
        )
      );
    }

    const reservedCount = (await getReservedSessionCounts(supabase, [sessionId])).get(sessionId) ?? 0;
    const capacityTotal = reservedCount + remainingPlaces;
    const nextStatus =
      sessionItem.status === 'COMPLETED' || sessionItem.status === 'ARCHIVED'
        ? sessionItem.status
        : reservedCount >= capacityTotal
          ? 'FULL'
          : 'OPEN';

    const { error } = await supabase
      .from('sessions')
      .update({
        capacity_total: capacityTotal,
        capacity_reserved: reservedCount,
        status: nextStatus
      })
      .eq('id', sessionId)
      .eq('stay_id', stayId);

    if (error) {
      redirect(
        withOrganizerQuery(
          `/organisme/sejours?error=${encodeURIComponent(error.message)}&openStay=${encodeURIComponent(stayId)}`,
          organizerId
        )
      );
    }

    revalidatePath('/organisme/sejours');
    revalidatePath('/organisme/stays');
    revalidatePath(`/organisme/sejours/${stayId}`);
    revalidatePath(`/organisme/stays/${stayId}`);
    revalidatePath('/sejours');
    redirect(
      withOrganizerQuery(
        `/organisme/sejours?saved=1&openStay=${encodeURIComponent(stayId)}${nextEditSessionId ? `&editSession=${encodeURIComponent(nextEditSessionId)}` : ''}`,
        organizerId
      )
    );
  }

  const stayRows = safeStays.map((stay) => ({
    id: stay.id,
    title: stay.title,
    status: stay.status,
    seasonName: seasonsById.get(stay.season_id)?.name ?? '-',
    locationText: stay.location_text ?? '',
    availability: getStayAvailability(stay.id),
    sessions: sessionsByStayId.get(stay.id)?.map((sessionItem) => ({
      id: sessionItem.id,
      startDate: sessionItem.start_date,
      endDate: sessionItem.end_date,
      capacityTotal: sessionItem.capacity_total,
      capacityReserved: reservedSessionCounts.get(sessionItem.id) ?? 0,
      status: sessionItem.status
    })) ?? []
  }));

  return (
    <div className="space-y-6">
      {savedParam === '1' && <SavedToast message="Le stock de la session a bien été mis à jour." />}
      {errorParam && <ErrorToast message={decodeURIComponent(errorParam)} />}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Séjours</h1>
          <p className="text-sm text-slate-600">
            {selectedOrganizer
              ? `Liste des séjours déclarés pour ${selectedOrganizer.name}.`
              : 'Liste des séjours déclarés.'}
          </p>
        </div>
        <Link
          href={withOrganizerQuery('/organisme/sejours/new', organizerId)}
          className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white"
        >
          Nouveau séjour
        </Link>
      </div>

      {stayRows.length > 0 ? (
        <OrganizerStaysTable
          stays={stayRows}
          organizerId={organizerId}
          updateSessionRemainingPlacesAction={updateSessionRemainingPlaces}
          defaultOpenStayIds={openStayParams}
          defaultEditingSessionId={editSessionParam ?? null}
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white px-4 py-6 text-sm text-slate-500">
          {loadError ? `Erreur: ${loadError}` : 'Aucun séjour pour le moment.'}
        </div>
      )}
    </div>
  );
}
