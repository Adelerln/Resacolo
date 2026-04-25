import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import ErrorToast from '@/components/common/ErrorToast';
import NewStayChoiceModalTrigger from '@/components/organisme/NewStayChoiceModalTrigger';
import SavedToast from '@/components/common/SavedToast';
import OrganizerStaysTable from '@/components/organisme/OrganizerStaysTable';
import { requireOrganizerPageAccess } from '@/lib/organizer-backoffice-access.server';
import { withOrganizerQuery } from '@/lib/organizers.server';
import { getReservedSessionCounts } from '@/lib/session-reservations';
import { isPublishedStayStatus, stayDraftShouldAppearInImportList } from '@/lib/stay-draft-published';
import { tryCanonicalizeStaySourceUrl } from '@/lib/stay-source-url-canonical';
import { removeStayMediaStorageFiles } from '@/lib/stay-media-storage';
import { getServerSupabaseClient } from '@/lib/supabase/server';

type PageProps = {
  searchParams?: Promise<{
    organizerId?: string | string[];
    saved?: string | string[];
    deleted?: string | string[];
    draftDeleted?: string | string[];
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
  const { selectedOrganizerId: organizerId } = await requireOrganizerPageAccess({
    requestedOrganizerId: resolvedSearchParams?.organizerId,
    requiredSection: 'stays'
  });
  const supabase = getServerSupabaseClient();
  const savedParam = formatRedirectValue(resolvedSearchParams?.saved);
  const deletedParam = formatRedirectValue(resolvedSearchParams?.deleted);
  const draftDeletedParam = formatRedirectValue(resolvedSearchParams?.draftDeleted);
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
  const { data: organizerStayDrafts } = organizerId
    ? await supabase
        .from('stay_drafts')
        .select('id,title,status,updated_at,raw_payload,source_url,validated_at')
        .eq('organizer_id', organizerId)
        .order('updated_at', { ascending: false })
        .limit(100)
    : { data: [] };
  const safeStays = stays ?? [];

  const publishedStaySourceUrls = new Set<string>();
  if (organizerId) {
    const { data: stayUrlRows, error: stayUrlError } = await supabase
      .from('stays')
      .select('source_url,status')
      .eq('organizer_id', organizerId);
    if (!stayUrlError) {
      for (const row of stayUrlRows ?? []) {
        const u = row.source_url?.trim();
        if (u && isPublishedStayStatus(row.status)) {
          publishedStaySourceUrls.add(u);
          const canonical = tryCanonicalizeStaySourceUrl(u);
          if (canonical) {
            publishedStaySourceUrls.add(canonical);
          }
        }
      }
    } else if (!/source_url|column|42703|does not exist/i.test(stayUrlError.message)) {
      console.warn('[organisme/stays] Lecture source_url pour filtre brouillons:', stayUrlError.message);
    }
  }
  const importDraftRows =
    (organizerStayDrafts ?? [])
      .filter((draft) =>
        stayDraftShouldAppearInImportList(
          {
            raw_payload: draft.raw_payload,
            source_url: draft.source_url,
            status: draft.status,
            validated_at: draft.validated_at
          },
          publishedStaySourceUrls
        )
      )
      .map((draft) => ({
        id: draft.id,
        title: draft.title?.trim() || 'Sans titre',
        status: draft.status,
        updatedAt: draft.updated_at
      }));
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

  async function deleteStay(formData: FormData) {
    'use server';
    const supabase = getServerSupabaseClient();
    const stayId = String(formData.get('stay_id') ?? '').trim();

    if (!stayId || !organizerId) {
      redirect(withOrganizerQuery('/organisme/sejours?error=Suppression%20impossible.', organizerId));
    }

    const { data: stay } = await supabase
      .from('stays')
      .select('id,title')
      .eq('id', stayId)
      .eq('organizer_id', organizerId)
      .maybeSingle();

    if (!stay) {
      redirect(withOrganizerQuery('/organisme/sejours?error=Séjour%20introuvable.', organizerId));
    }

    const { data: sessions, error: sessionsError } = await supabase
      .from('sessions')
      .select('id')
      .eq('stay_id', stayId);

    if (sessionsError) {
      redirect(
        withOrganizerQuery(
          `/organisme/sejours?error=${encodeURIComponent(sessionsError.message)}`,
          organizerId
        )
      );
    }

    const { data: stayMediaRows, error: stayMediaRowsError } = await supabase
      .from('stay_media')
      .select('url')
      .eq('stay_id', stayId);

    if (stayMediaRowsError) {
      redirect(
        withOrganizerQuery(
          `/organisme/sejours?error=${encodeURIComponent(stayMediaRowsError.message)}`,
          organizerId
        )
      );
    }

    const sessionIds = (sessions ?? []).map((sessionItem) => sessionItem.id);
    const stayMediaUrls = (stayMediaRows ?? []).map((row) => row.url).filter(Boolean);
    const [orderItemsResult, ledgerResult] = await Promise.all([
      sessionIds.length > 0
        ? supabase.from('order_items').select('id', { count: 'exact', head: true }).in('session_id', sessionIds)
        : Promise.resolve({ count: 0, error: null }),
      supabase.from('resacolo_fee_ledger').select('id', { count: 'exact', head: true }).eq('stay_id', stayId)
    ]);

    if (orderItemsResult.error) {
      redirect(
        withOrganizerQuery(
          `/organisme/sejours?error=${encodeURIComponent(orderItemsResult.error.message)}`,
          organizerId
        )
      );
    }

    if (ledgerResult.error) {
      redirect(
        withOrganizerQuery(
          `/organisme/sejours?error=${encodeURIComponent(ledgerResult.error.message)}`,
          organizerId
        )
      );
    }

    if ((orderItemsResult.count ?? 0) > 0 || (ledgerResult.count ?? 0) > 0) {
      redirect(
        withOrganizerQuery(
          `/organisme/sejours?error=${encodeURIComponent(
            'Ce séjour ne peut pas être supprimé car il est déjà lié à des réservations ou à des écritures de facturation.'
          )}`,
          organizerId
        )
      );
    }

    if (sessionIds.length > 0) {
      const { error: deleteSessionHoldsError } = await supabase
        .from('session_holds')
        .delete()
        .in('session_id', sessionIds);

      if (deleteSessionHoldsError) {
        redirect(
          withOrganizerQuery(
            `/organisme/sejours?error=${encodeURIComponent(deleteSessionHoldsError.message)}`,
            organizerId
          )
        );
      }

      const { error: deleteSessionPricesError } = await supabase
        .from('session_prices')
        .delete()
        .in('session_id', sessionIds);

      if (deleteSessionPricesError) {
        redirect(
          withOrganizerQuery(
            `/organisme/sejours?error=${encodeURIComponent(deleteSessionPricesError.message)}`,
            organizerId
          )
        );
      }
    }

    const cleanupSteps = [
      () => supabase.from('favorites').delete().eq('stay_id', stayId),
      () => supabase.from('collectivity_stay_exclusions').delete().eq('stay_id', stayId),
      () => supabase.from('stay_media').delete().eq('stay_id', stayId),
      () => supabase.from('stay_accommodations').delete().eq('stay_id', stayId),
      () => supabase.from('stay_extra_options').delete().eq('stay_id', stayId),
      () => supabase.from('insurance_options').delete().eq('stay_id', stayId),
      () => supabase.from('transport_options').delete().eq('stay_id', stayId),
      () => supabase.from('sessions').delete().eq('stay_id', stayId),
      () => supabase.from('stays').delete().eq('id', stayId).eq('organizer_id', organizerId)
    ];

    for (const cleanupStep of cleanupSteps) {
      const { error } = await cleanupStep();
      if (error) {
        redirect(
          withOrganizerQuery(
            `/organisme/sejours?error=${encodeURIComponent(error.message)}`,
            organizerId
          )
        );
      }
    }

    if (stayMediaUrls.length > 0) {
      try {
        await removeStayMediaStorageFiles(supabase, stayMediaUrls);
      } catch (error) {
        console.warn('[organisme/sejours] stay media bucket cleanup failed', {
          stayId,
          error: error instanceof Error ? error.message : 'unknown-error'
        });
      }
    }

    revalidatePath('/organisme/sejours');
    revalidatePath('/organisme/stays');
    revalidatePath(`/organisme/sejours/${stayId}`);
    revalidatePath(`/organisme/stays/${stayId}`);
    revalidatePath('/sejours');
    redirect(withOrganizerQuery('/organisme/sejours?deleted=1', organizerId));
  }

  async function deleteStayDraft(formData: FormData) {
    'use server';
    const supabase = getServerSupabaseClient();
    const draftId = String(formData.get('draft_id') ?? '').trim();
    const requestedOrganizerId = String(formData.get('organizer_id') ?? '').trim() || undefined;
    const { selectedOrganizerId } = await requireOrganizerPageAccess({
      requestedOrganizerId,
      requiredSection: 'stays'
    });

    if (!draftId || !selectedOrganizerId) {
      redirect(
        withOrganizerQuery(
          '/organisme/sejours?error=Suppression%20du%20brouillon%20impossible.',
          selectedOrganizerId
        )
      );
    }

    const { data: draftRow } = await supabase
      .from('stay_drafts')
      .select('id')
      .eq('id', draftId)
      .eq('organizer_id', selectedOrganizerId)
      .maybeSingle();

    if (!draftRow) {
      redirect(withOrganizerQuery('/organisme/sejours?error=Brouillon%20introuvable.', selectedOrganizerId));
    }

    const { error } = await supabase
      .from('stay_drafts')
      .delete()
      .eq('id', draftId)
      .eq('organizer_id', selectedOrganizerId);

    if (error) {
      redirect(
        withOrganizerQuery(`/organisme/sejours?error=${encodeURIComponent(error.message)}`, selectedOrganizerId)
      );
    }

    revalidatePath('/organisme/sejours');
    revalidatePath('/organisme/stays');
    redirect(withOrganizerQuery('/organisme/sejours?draftDeleted=1', selectedOrganizerId));
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
      {deletedParam === '1' && <SavedToast message="Le séjour a bien été supprimé." />}
      {draftDeletedParam === '1' && <SavedToast message="Le brouillon d'import a bien été supprimé." />}
      {savedParam === '1' && <SavedToast message="Le stock de la session a bien été mis à jour." />}
      {errorParam && <ErrorToast message={decodeURIComponent(errorParam)} />}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Séjours</h1>
        </div>
        <NewStayChoiceModalTrigger organizerId={organizerId} />
      </div>

      {stayRows.length > 0 || importDraftRows.length > 0 ? (
        <OrganizerStaysTable
          stays={stayRows}
          organizerId={organizerId}
          importDrafts={importDraftRows}
          updateSessionRemainingPlacesAction={updateSessionRemainingPlaces}
          deleteStayAction={deleteStay}
          deleteImportDraftAction={deleteStayDraft}
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
