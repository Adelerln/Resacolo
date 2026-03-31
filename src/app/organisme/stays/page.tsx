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
  searchParams?: {
    organizerId?: string | string[];
    saved?: string | string[];
    error?: string | string[];
    openStay?: string | string[];
    prefill?: string | string[];
    draftId?: string | string[];
    ai?: string | string[];
    aiDraftId?: string | string[];
  };
};

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function formatRedirectValue(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

function formatRedirectValues(value?: string | string[]) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

export default async function OrganizerStaysPage({ searchParams }: PageProps) {
  const session = requireRole('ORGANISATEUR');
  const supabase = getServerSupabaseClient();
  const { selectedOrganizer, selectedOrganizerId } = await resolveOrganizerSelection(
    searchParams?.organizerId,
    session.tenantId ?? null
  );
  const organizerId = selectedOrganizerId;
  const savedParam = formatRedirectValue(searchParams?.saved);
  const errorParam = formatRedirectValue(searchParams?.error);
  const openStayParams = formatRedirectValues(searchParams?.openStay);
  const prefillParam = formatRedirectValue(searchParams?.prefill);
  const draftIdParam = formatRedirectValue(searchParams?.draftId);
  const aiParam = formatRedirectValue(searchParams?.ai);
  const aiDraftIdParam = formatRedirectValue(searchParams?.aiDraftId);

  const { data: stays, error: staysError } = organizerId
    ? await supabase
        .from('stays')
        .select('id,title,status,season_id,created_at')
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
  const sessionsByStayId = new Map<string, NonNullable<typeof sessions>[number][]>();

  for (const sessionItem of sessions ?? []) {
    if (sessionItem.status === 'COMPLETED' || sessionItem.status === 'ARCHIVED') continue;
    const group = sessionsByStayId.get(sessionItem.stay_id) ?? [];
    group.push(sessionItem);
    sessionsByStayId.set(sessionItem.stay_id, group);
  }

  async function updateSessionRemainingPlaces(formData: FormData) {
    'use server';
    const supabase = getServerSupabaseClient();
    const sessionId = String(formData.get('session_id') ?? '').trim();
    const stayId = String(formData.get('stay_id') ?? '').trim();
    const remainingPlaces = Number(formData.get('remaining_places') ?? NaN);

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
        `/organisme/sejours?saved=1&openStay=${encodeURIComponent(stayId)}`,
        organizerId
      )
    );
  }

  const stayRows = safeStays.map((stay) => ({
    id: stay.id,
    title: stay.title,
    status: stay.status,
    seasonName: seasonsById.get(stay.season_id)?.name ?? '-',
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
      <div className="flex items-center justify-between">
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
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white"
        >
          Nouveau séjour
        </Link>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-slate-900">Pré-remplissage depuis une URL</h2>
        <p className="mt-1 text-sm text-slate-600">
          Collez l&apos;URL d&apos;une fiche séjour existante pour préparer un brouillon automatiquement
          à l&apos;étape suivante.
        </p>
        <form
          action="/api/import-stay"
          method="post"
          className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end"
        >
          <label className="block flex-1 text-sm font-medium text-slate-700">
            URL de la fiche séjour
            <input
              name="sourceUrl"
              type="url"
              placeholder="https://exemple.com/fiche-sejour"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              required
            />
          </label>
          <input type="hidden" name="organizerId" value={organizerId ?? ''} />
          <button
            type="submit"
            className="h-10 rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white"
          >
            Pré-remplir
          </button>
        </form>
        {prefillParam === 'created' && draftIdParam && (
          <p className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            Brouillon créé et pré-rempli avec succès. ID du draft :{' '}
            <span className="font-semibold">{draftIdParam}</span>.{' '}
            <Link
              href={withOrganizerQuery(`/organisme/sejours/drafts/${draftIdParam}`, organizerId)}
              className="font-semibold underline"
            >
              Ouvrir la review
            </Link>
          </p>
        )}

        <div className="mt-6 border-t border-slate-200 pt-4">
          <h3 className="text-base font-semibold text-slate-900">Enrichissement IA d&apos;un draft</h3>
          <p className="mt-1 text-sm text-slate-600">
            Lancez une étape complémentaire d&apos;extraction IA sur un draft existant. Cette étape
            enrichit uniquement <code>stay_drafts</code> et ne publie rien dans les tables live.
          </p>
          <form
            action="/api/stay-drafts/enrich"
            method="post"
            className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end"
          >
            <label className="block flex-1 text-sm font-medium text-slate-700">
              ID du draft
              <input
                name="draftId"
                type="text"
                placeholder="UUID du stay_draft"
                defaultValue={draftIdParam ?? aiDraftIdParam ?? ''}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                required
              />
            </label>
            <input type="hidden" name="organizerId" value={organizerId ?? ''} />
            <label className="inline-flex items-center gap-2 text-sm text-slate-700 sm:pb-2">
              <input
                type="checkbox"
                name="force"
                value="true"
                className="h-4 w-4 rounded border-slate-300"
              />
              Forcer l&apos;écrasement (test)
            </label>
            <button
              type="submit"
              className="h-10 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white"
            >
              Enrichir avec IA
            </button>
          </form>
          {aiParam === 'success' && aiDraftIdParam && (
            <p className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              Enrichissement IA terminé avec succès. ID du draft :{' '}
              <span className="font-semibold">{aiDraftIdParam}</span>.{' '}
              <Link
                href={withOrganizerQuery(`/organisme/sejours/drafts/${aiDraftIdParam}`, organizerId)}
                className="font-semibold underline"
              >
                Ouvrir la review
              </Link>
            </p>
          )}
        </div>
      </div>

      {stayRows.length > 0 ? (
        <OrganizerStaysTable
          stays={stayRows}
          organizerId={organizerId}
          updateSessionRemainingPlacesAction={updateSessionRemainingPlaces}
          defaultOpenStayIds={openStayParams}
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white px-4 py-6 text-sm text-slate-500">
          {loadError ? `Erreur: ${loadError}` : 'Aucun séjour pour le moment.'}
        </div>
      )}
    </div>
  );
}
