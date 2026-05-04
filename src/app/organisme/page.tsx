import Link from 'next/link';
import {
  CalendarCheck2,
  Eye,
  Gauge,
  Info,
  ListChecks,
  Megaphone,
  TrendingUp
} from 'lucide-react';
import OrganizerPageHeader from '@/components/organisme/OrganizerPageHeader';
import { requireOrganizerPageAccess } from '@/lib/organizer-backoffice-access.server';
import { buildOrganizerDashboardModel } from '@/lib/organisme/dashboard-metrics';
import { withOrganizerQuery } from '@/lib/organizers.server';
import { getReservedSessionCounts } from '@/lib/session-reservations';
import {
  STAY_VISIT_AUDIT_ACTION,
  STAY_VISIT_ENTITY_TYPE,
  STAY_VISIT_LOOKBACK_DAYS
} from '@/lib/stay-visits';
import { normalizeStayTitle } from '@/lib/stay-title';
import { getServerSupabaseClient } from '@/lib/supabase/server';
import { stayStatusLabel } from '@/lib/ui/labels';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

type PageProps = {
  searchParams?: Promise<{
    organizerId?: string | string[];
  }>;
};

function formatPercent(value: number) {
  return `${Math.round(value)}%`;
}

function formatVisibilityLabel(isPublished: boolean, mediaCount: number) {
  if (!isPublished) return 'Hors catalogue';
  if (mediaCount > 0) return 'Publié';
  return 'Publié (sans média)';
}

function stayStatusBadgeClassName(status?: string | null) {
  switch (status) {
    case 'PUBLISHED':
      return 'bg-emerald-100 text-emerald-700';
    case 'DRAFT':
      return 'bg-amber-100 text-amber-700';
    case 'HIDDEN':
      return 'bg-slate-100 text-slate-700';
    case 'ARCHIVED':
      return 'bg-slate-100 text-slate-700';
    default:
      return 'bg-slate-100 text-slate-700';
  }
}

function visibilityBadgeClassName(isPublished: boolean, mediaCount: number) {
  if (!isPublished) return 'bg-slate-100 text-slate-700';
  if (mediaCount > 0) return 'bg-emerald-100 text-emerald-700';
  return 'bg-amber-100 text-amber-700';
}

function KpiInfo({ text }: { text: string }) {
  return (
    <span className="group relative inline-flex align-middle">
      <button
        type="button"
        className="inline-flex items-center rounded text-slate-400 hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
        aria-label={text}
      >
        <Info className="h-3.5 w-3.5" />
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute left-1/2 top-full z-30 mt-1.5 w-64 -translate-x-1/2 rounded-md border border-slate-200 bg-white px-2.5 py-2 text-left text-[11px] font-medium normal-case tracking-normal text-slate-700 opacity-0 shadow-lg transition-opacity duration-100 group-hover:opacity-100 group-focus-within:opacity-100"
      >
        {text}
      </span>
    </span>
  );
}

function formatStayDisplayTitle(title: string) {
  const trimmed = title.trim();
  if (!trimmed) return '';

  const lettersOnly = trimmed.replace(/[^A-Za-zÀ-ÖØ-öø-ÿ]/g, '');
  const isAllUppercase =
    lettersOnly.length > 0 && lettersOnly === lettersOnly.toLocaleUpperCase('fr-FR');

  if (!isAllUppercase) return trimmed;

  const normalized = normalizeStayTitle(trimmed);
  return normalized || trimmed;
}

export default async function OrganizerDashboardPage({ searchParams }: PageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const { selectedOrganizerId } = await requireOrganizerPageAccess({
    requestedOrganizerId: resolvedSearchParams?.organizerId,
    requiredSection: 'dashboard'
  });
  const supabase = getServerSupabaseClient();
  const organizerId = selectedOrganizerId;

  if (!organizerId) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <h1 className="organizer-page-title">Dashboard</h1>
        <p className="mt-2 text-sm text-slate-600">
          Aucun organisateur n&apos;est disponible pour afficher les statistiques.
        </p>
        <div className="mt-5">
          <Link
            href="/organisme/sejours"
            className="organizer-btn-secondary"
          >
            Gérer les séjours
          </Link>
        </div>
      </div>
    );
  }

  const [{ data: staysRaw }, { data: membersRaw }] = await Promise.all([
    supabase
      .from('stays')
      .select('id,title,status,updated_at')
      .eq('organizer_id', organizerId)
      .order('updated_at', { ascending: false }),
    supabase.from('organizer_members').select('id,role').eq('organizer_id', organizerId)
  ]);

  const stays = staysRaw ?? [];
  const stayIds = stays.map((stay) => stay.id);
  const visitsLookbackDate = (() => {
    const referenceDate = new Date();
    referenceDate.setUTCDate(referenceDate.getUTCDate() - STAY_VISIT_LOOKBACK_DAYS);
    return referenceDate.toISOString();
  })();
  const [{ data: sessionsRaw }, { data: stayMediaRaw }, { data: stayVisitsRaw }] =
    stayIds.length > 0
      ? await Promise.all([
          supabase
            .from('sessions')
            .select('id,stay_id,start_date,end_date,capacity_total,status')
            .in('stay_id', stayIds)
            .order('start_date', { ascending: true }),
          supabase.from('stay_media').select('id,stay_id').in('stay_id', stayIds),
          supabase
            .from('audit_logs')
            .select('entity_id')
            .eq('entity_type', STAY_VISIT_ENTITY_TYPE)
            .eq('action', STAY_VISIT_AUDIT_ACTION)
            .in('entity_id', stayIds)
            .gte('created_at', visitsLookbackDate)
        ])
      : [{ data: [] }, { data: [] }, { data: [] }, { data: [] }];

  const sessions = sessionsRaw ?? [];
  const sessionIds = sessions.map((sessionItem) => sessionItem.id);
  const reservedCounts = await getReservedSessionCounts(supabase, sessionIds);

  const dashboardModel = buildOrganizerDashboardModel({
    stays,
    sessions,
    stayMedia: stayMediaRaw ?? [],
    stayVisits: stayVisitsRaw ?? [],
    members: membersRaw ?? [],
    reservedCounts
  });
  const { metrics, stayRows, lists } = dashboardModel;
  const teamCount = metrics.ownerCount + metrics.editorCount + metrics.reservationManagerCount;

  return (
    <div className="space-y-6">
      <OrganizerPageHeader
        title="Dashboard"
        subtitle={`${metrics.totalStays} séjours suivis · ${metrics.totalReservations} réservations · ${formatPercent(metrics.occupancyRate)} de remplissage`}
        actions={(
          <>
            <Link href={withOrganizerQuery('/organisme/sejours', organizerId)} className="organizer-btn-primary">
              Gérer les séjours
            </Link>
            <Link href={withOrganizerQuery('/organisme/reservations', organizerId)} className="organizer-btn-secondary">
              Gérer les réservations
            </Link>
          </>
        )}
      />

      <section className="organizer-card p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-700">
            Équipe active : {teamCount} membre(s)
          </span>
          <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-700">
            {metrics.totalStayVisits} visites des pages séjour ({STAY_VISIT_LOOKBACK_DAYS}j)
          </span>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <article className="min-h-[150px] rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <p className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Séjours proposés
              <KpiInfo text="Tous statuts confondus (publié, brouillon, archivé)." />
            </p>
            <ListChecks className="h-4 w-4 text-slate-400" />
          </div>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{metrics.totalStays}</p>
        </article>

        <article className="min-h-[150px] rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <p className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Réservations
              <KpiInfo text="Total cumulé des réservations confirmées." />
            </p>
            <CalendarCheck2 className="h-4 w-4 text-slate-400" />
          </div>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{metrics.totalReservations}</p>
        </article>

        <article className="min-h-[150px] rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <p className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Taux de remplissage
              <KpiInfo
                text={`Calcul : ${metrics.totalReservations} réservations / ${metrics.totalCapacity} places ouvertes.`}
              />
            </p>
            <Gauge className="h-4 w-4 text-slate-400" />
          </div>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{formatPercent(metrics.occupancyRate)}</p>
        </article>

        <article className="min-h-[150px] rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <p className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Sessions complètes
              <KpiInfo text="Sessions ouvertes marquées complètes ou à capacité atteinte." />
            </p>
            <Gauge className="h-4 w-4 text-slate-400" />
          </div>
          <p className="mt-3 text-3xl font-semibold text-slate-900">
            {metrics.fullSessionsCount} / {metrics.openSessionsCount}
          </p>
        </article>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="organizer-section-title">Actions prioritaires</h2>
            <p className="text-sm text-slate-600">
              Passez rapidement des indicateurs aux séjours qui nécessitent une action.
            </p>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
            <Eye className="h-3.5 w-3.5" />
            {metrics.totalStayVisits} visites des pages séjour sur les {STAY_VISIT_LOOKBACK_DAYS} derniers jours
          </span>
        </div>

        <div className="mt-5 grid gap-4 xl:grid-cols-3">
          <article className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
            <h3 className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900">
              <TrendingUp className="h-4 w-4 text-emerald-600" />
              Top séjours réservés
            </h3>
            {lists.topStays.length > 0 ? (
              <ul className="mt-3 space-y-2 text-sm text-slate-700">
                {lists.topStays.map((stay) => (
                  <li key={stay.id} className="flex items-start justify-between gap-3">
                    <Link
                      href={withOrganizerQuery(`/organisme/sejours/${stay.id}`, organizerId)}
                      className="min-w-0 truncate font-medium text-slate-800 hover:text-brand-700"
                    >
                      {formatStayDisplayTitle(stay.title)}
                    </Link>
                    <span className="shrink-0 text-xs text-slate-500">
                      {stay.reserved} résa · {stay.reserved}/{stay.capacity}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-slate-500">Aucun séjour avec réservation pour le moment.</p>
            )}
          </article>

          <article className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
            <h3 className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900">
              <Megaphone className="h-4 w-4 text-amber-600" />
              Séjours les plus consultés
            </h3>
            {lists.noTractionPublishedStays.length > 0 ? (
              <ul className="mt-3 space-y-2 text-sm text-slate-700">
                {lists.noTractionPublishedStays.map((stay) => (
                  <li key={stay.id} className="flex items-start justify-between gap-3">
                    <Link
                      href={withOrganizerQuery(`/organisme/sejours/${stay.id}`, organizerId)}
                      className="min-w-0 truncate font-medium text-slate-800 hover:text-brand-700"
                    >
                      {formatStayDisplayTitle(stay.title)}
                    </Link>
                    <span className="shrink-0 text-xs text-slate-500">
                      {stay.visitCount} {stay.visitCount > 1 ? 'visites' : 'visite'}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-slate-500">Aucune consultation enregistrée pour le moment.</p>
            )}
          </article>

          <article className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
            <h3 className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900">
              <Gauge className="h-4 w-4 text-rose-600" />
              Séjours complets
            </h3>
            {lists.vigilanceStays.length > 0 ? (
              <ul className="mt-3 space-y-2 text-sm text-slate-700">
                {lists.vigilanceStays.map((stay) => (
                  <li key={stay.id} className="flex items-start justify-between gap-3">
                    <Link
                      href={withOrganizerQuery(`/organisme/sejours/${stay.id}`, organizerId)}
                      className="min-w-0 truncate font-medium text-slate-800 hover:text-brand-700"
                    >
                      {formatStayDisplayTitle(stay.title)}
                    </Link>
                    <span className="shrink-0 text-xs text-slate-500">
                      {stay.reserved}/{stay.capacity}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-slate-500">Aucun séjour complet pour le moment.</p>
            )}
          </article>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="organizer-section-title">Suivi des séjours</h2>
        </div>

        {stayRows.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="organizer-table min-w-[980px] w-full table-fixed">
              <colgroup>
                <col className="w-[16.6667%]" />
                <col className="w-[16.6667%]" />
                <col className="w-[16.6667%]" />
                <col className="w-[16.6667%]" />
                <col className="w-[16.6667%]" />
                <col className="w-[16.6667%]" />
              </colgroup>
              <thead>
                <tr>
                  <th className="px-5 py-2.5">Séjour</th>
                  <th className="px-5 py-2.5">Statut</th>
                  <th className="px-5 py-2.5">Sessions</th>
                  <th className="px-5 py-2.5">Réservations</th>
                  <th className="px-5 py-2.5">Fréquentation</th>
                  <th className="px-5 py-2.5">Visibilité</th>
                </tr>
              </thead>
              <tbody>
                {stayRows.map((stay) => (
                  <tr key={stay.id} className="border-t border-slate-100 align-top">
                    <td className="px-5 py-3">
                      <Link
                        href={withOrganizerQuery(`/organisme/sejours/${stay.id}`, organizerId)}
                        className="font-medium text-slate-900 hover:text-brand-700"
                      >
                        {formatStayDisplayTitle(stay.title)}
                      </Link>
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${stayStatusBadgeClassName(stay.status)}`}
                      >
                        {stayStatusLabel(stay.status)}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-slate-600">{stay.sessionCount}</td>
                    <td className="px-5 py-3 text-slate-600">{stay.reserved}</td>
                    <td className="px-5 py-3 text-slate-600">{stay.reserved}/{stay.capacity}</td>
                    <td className="px-5 py-3">
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${visibilityBadgeClassName(stay.isPublished, stay.mediaCount)}`}
                      >
                        {formatVisibilityLabel(stay.isPublished, stay.mediaCount)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="px-5 py-10 text-center">
            <p className="text-sm text-slate-500">
              Aucun séjour n&apos;est encore rattaché à cet organisateur.
            </p>
            <div className="mt-4">
              <Link
                href={withOrganizerQuery('/organisme/sejours', organizerId)}
                className="organizer-btn-secondary"
              >
                Gérer les séjours
              </Link>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
