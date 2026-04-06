import { requireRole } from '@/lib/auth/require';
import { ORGANIZER_ACCESS_LABELS } from '@/lib/organizer-access';
import { getOrganizerAccessRole } from '@/lib/organizer-access.server';
import { resolveOrganizerSelection } from '@/lib/organizers.server';
import { getReservedSessionCounts } from '@/lib/session-reservations';
import { getServerSupabaseClient } from '@/lib/supabase/server';
import { stayStatusLabel } from '@/lib/ui/labels';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

type PageProps = {
  searchParams?: {
    organizerId?: string | string[];
  };
};

function formatPercent(value: number) {
  return `${Math.round(value)}%`;
}

function formatVisibilityLabel(isPublished: boolean, mediaCount: number) {
  if (!isPublished) return 'Hors catalogue';
  if (mediaCount > 0) return 'Visible';
  return 'Publié, à enrichir';
}

export default async function OrganizerDashboardPage({ searchParams }: PageProps) {
  const session = requireRole('ORGANISATEUR');
  const accessRole = getOrganizerAccessRole();
  const supabase = getServerSupabaseClient();
  const { selectedOrganizer, selectedOrganizerId } = await resolveOrganizerSelection(
    searchParams?.organizerId,
    session.tenantId ?? null
  );
  const organizerId = selectedOrganizerId;

  if (!organizerId) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>
        <p className="mt-2 text-sm text-slate-600">
          Aucun organisateur n&apos;est disponible pour afficher les statistiques.
        </p>
      </div>
    );
  }

  const [{ data: staysRaw }, { data: accommodationsRaw }, { data: membersRaw }] = await Promise.all([
    supabase
      .from('stays')
      .select('id,title,status,updated_at')
      .eq('organizer_id', organizerId)
      .order('updated_at', { ascending: false }),
    supabase
      .from('accommodations')
      .select('id,name,status')
      .eq('organizer_id', organizerId)
      .order('name', { ascending: true }),
    supabase.from('organizer_members').select('id,role').eq('organizer_id', organizerId)
  ]);

  const stays = staysRaw ?? [];
  const stayIds = stays.map((stay) => stay.id);

  const [{ data: sessionsRaw }, { data: stayMediaRaw }, { data: stayAccommodationLinksRaw }] =
    stayIds.length > 0
      ? await Promise.all([
          supabase
            .from('sessions')
            .select('id,stay_id,start_date,end_date,capacity_total,status')
            .in('stay_id', stayIds)
            .order('start_date', { ascending: true }),
          supabase.from('stay_media').select('id,stay_id').in('stay_id', stayIds),
          supabase.from('stay_accommodations').select('stay_id,accommodation_id').in('stay_id', stayIds)
        ])
      : [{ data: [] }, { data: [] }, { data: [] }];

  const sessions = sessionsRaw ?? [];
  const sessionIds = sessions.map((sessionItem) => sessionItem.id);
  const reservedCounts = await getReservedSessionCounts(supabase, sessionIds);

  const mediaCountByStayId = new Map<string, number>();
  for (const media of stayMediaRaw ?? []) {
    mediaCountByStayId.set(media.stay_id, (mediaCountByStayId.get(media.stay_id) ?? 0) + 1);
  }

  const linkedAccommodationIds = new Set(
    (stayAccommodationLinksRaw ?? []).map((link) => link.accommodation_id)
  );
  const sessionCountByStayId = new Map<string, number>();
  const reservedCountByStayId = new Map<string, number>();
  const capacityByStayId = new Map<string, number>();

  for (const sessionItem of sessions) {
    sessionCountByStayId.set(
      sessionItem.stay_id,
      (sessionCountByStayId.get(sessionItem.stay_id) ?? 0) + 1
    );
    const reservedCount = reservedCounts.get(sessionItem.id) ?? 0;
    reservedCountByStayId.set(
      sessionItem.stay_id,
      (reservedCountByStayId.get(sessionItem.stay_id) ?? 0) + reservedCount
    );
    if (sessionItem.status === 'ARCHIVED' || sessionItem.status === 'COMPLETED') continue;
    capacityByStayId.set(
      sessionItem.stay_id,
      (capacityByStayId.get(sessionItem.stay_id) ?? 0) + sessionItem.capacity_total
    );
  }

  const totalPublishedStays = stays.filter((stay) => stay.status === 'PUBLISHED').length;
  const totalDraftOrHiddenStays = stays.filter((stay) => stay.status !== 'PUBLISHED').length;
  const totalReservations = Array.from(reservedCounts.values()).reduce((sum, count) => sum + count, 0);
  const totalCapacity = Array.from(capacityByStayId.values()).reduce((sum, count) => sum + count, 0);
  const occupancyRate = totalCapacity > 0 ? (totalReservations / totalCapacity) * 100 : 0;
  const visibilityRate = stays.length > 0 ? (totalPublishedStays / stays.length) * 100 : 0;
  const mediaCoverageRate =
    stays.length > 0
      ? (stays.filter((stay) => (mediaCountByStayId.get(stay.id) ?? 0) > 0).length / stays.length) * 100
      : 0;
  const ownerCount = (membersRaw ?? []).filter((member) => member.role === 'OWNER').length;
  const editorCount = (membersRaw ?? []).filter((member) => member.role === 'EDITOR').length;
  const reservationManagerCount = (membersRaw ?? []).filter(
    (member) => member.role === 'RESERVATION_MANAGER'
  ).length;

  const stayRows = stays
    .map((stay) => {
      const reserved = reservedCountByStayId.get(stay.id) ?? 0;
      const capacity = capacityByStayId.get(stay.id) ?? 0;
      const occupancy = capacity > 0 ? (reserved / capacity) * 100 : 0;
      const mediaCount = mediaCountByStayId.get(stay.id) ?? 0;
      return {
        ...stay,
        sessionCount: sessionCountByStayId.get(stay.id) ?? 0,
        reserved,
        capacity,
        occupancy,
        mediaCount
      };
    })
    .sort((a, b) => b.reserved - a.reserved || b.sessionCount - a.sessionCount || a.title.localeCompare(b.title, 'fr'));

  const organizerLabel = selectedOrganizer?.name ?? 'Organisateur';

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>
          <p className="text-sm text-slate-600">
            Vue d&apos;ensemble de {organizerLabel}. Mode actuel : {ORGANIZER_ACCESS_LABELS[accessRole]}.
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="text-xs uppercase tracking-wide text-slate-500">Séjours proposés</div>
          <div className="mt-2 text-3xl font-semibold text-slate-900">{stays.length}</div>
          <p className="mt-2 text-sm text-slate-600">
            {totalPublishedStays} publiés, {totalDraftOrHiddenStays} à compléter ou hors catalogue.
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="text-xs uppercase tracking-wide text-slate-500">Hébergements</div>
          <div className="mt-2 text-3xl font-semibold text-slate-900">{accommodationsRaw?.length ?? 0}</div>
          <p className="mt-2 text-sm text-slate-600">
            {linkedAccommodationIds.size} déjà reliés à au moins un séjour.
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="text-xs uppercase tracking-wide text-slate-500">Réservations actives</div>
          <div className="mt-2 text-3xl font-semibold text-slate-900">{totalReservations}</div>
          <p className="mt-2 text-sm text-slate-600">
            Réservations déduites des sessions encore actives.
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="text-xs uppercase tracking-wide text-slate-500">Taux de fréquentation</div>
          <div className="mt-2 text-3xl font-semibold text-slate-900">{formatPercent(occupancyRate)}</div>
          <p className="mt-2 text-sm text-slate-600">
            {totalReservations} places réservées pour {totalCapacity} places ouvertes.
          </p>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(320px,1fr)]">
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Visibilité et diffusion</h2>
              <p className="mt-1 text-sm text-slate-600">
                Le taux de visibilité repose sur les séjours publiés. La couverture média mesure les
                fiches disposant déjà de photos.
              </p>
            </div>
            <div className="rounded-full bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-700">
              {formatPercent(visibilityRate)} visibles
            </div>
          </div>
          <div className="mt-6 space-y-4">
            <div>
              <div className="mb-2 flex items-center justify-between text-sm text-slate-600">
                <span>Séjours publiés</span>
                <span>{totalPublishedStays}/{stays.length || 0}</span>
              </div>
              <div className="h-2 rounded-full bg-slate-100">
                <div
                  className="h-2 rounded-full bg-emerald-500"
                  style={{ width: `${Math.max(visibilityRate, stays.length > 0 ? 4 : 0)}%` }}
                />
              </div>
            </div>
            <div>
              <div className="mb-2 flex items-center justify-between text-sm text-slate-600">
                <span>Fiches avec médias</span>
                <span>{formatPercent(mediaCoverageRate)}</span>
              </div>
              <div className="h-2 rounded-full bg-slate-100">
                <div
                  className="h-2 rounded-full bg-sky-500"
                  style={{ width: `${Math.max(mediaCoverageRate, stays.length > 0 ? 4 : 0)}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-semibold text-slate-900">Équipe organisateur</h2>
          <p className="mt-1 text-sm text-slate-600">Répartition des accès configurés pour cet organisateur.</p>
          <div className="mt-5 grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
            <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
              <div className="text-xs uppercase tracking-wide text-slate-500">Propriétaires</div>
              <div className="mt-2 text-2xl font-semibold text-slate-900">{ownerCount}</div>
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
              <div className="text-xs uppercase tracking-wide text-slate-500">Éditeurs</div>
              <div className="mt-2 text-2xl font-semibold text-slate-900">{editorCount}</div>
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
              <div className="text-xs uppercase tracking-wide text-slate-500">Gestionnaires</div>
              <div className="mt-2 text-2xl font-semibold text-slate-900">{reservationManagerCount}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="text-lg font-semibold text-slate-900">Suivi des séjours</h2>
          <p className="mt-1 text-sm text-slate-600">
            Fréquentation et visibilité par séjour, pour repérer rapidement les fiches à retravailler.
          </p>
        </div>
        {stayRows.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-[860px] w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-5 py-3">Séjour</th>
                  <th className="px-5 py-3">Statut</th>
                  <th className="px-5 py-3">Sessions</th>
                  <th className="px-5 py-3">Réservations</th>
                  <th className="px-5 py-3">Fréquentation</th>
                  <th className="px-5 py-3">Visibilité</th>
                </tr>
              </thead>
              <tbody>
                {stayRows.map((stay) => (
                  <tr key={stay.id} className="border-t border-slate-100 align-top">
                    <td className="px-5 py-4">
                      <div className="font-medium text-slate-900">{stay.title}</div>
                      <div className="mt-1 text-xs text-slate-500">
                        Mis à jour le {new Date(stay.updated_at).toLocaleDateString('fr-FR')}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-slate-600">{stayStatusLabel(stay.status)}</td>
                    <td className="px-5 py-4 text-slate-600">{stay.sessionCount}</td>
                    <td className="px-5 py-4 text-slate-600">
                      {stay.reserved}
                      {stay.capacity > 0 ? ` / ${stay.capacity} places` : ''}
                    </td>
                    <td className="px-5 py-4 text-slate-600">{formatPercent(stay.occupancy)}</td>
                    <td className="px-5 py-4 text-slate-600">
                      {formatVisibilityLabel(stay.status === 'PUBLISHED', stay.mediaCount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="px-5 py-10 text-sm text-slate-500">
            Aucun séjour n&apos;est encore rattaché à cet organisateur.
          </div>
        )}
      </div>
    </div>
  );
}
