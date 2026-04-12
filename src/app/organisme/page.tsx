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
import { requireRole } from '@/lib/auth/require';
import { ORGANIZER_ACCESS_LABELS } from '@/lib/organizer-access';
import { getOrganizerAccessRole } from '@/lib/organizer-access.server';
import { buildOrganizerDashboardModel } from '@/lib/organisme/dashboard-metrics';
import { resolveOrganizerSelection, withOrganizerQuery } from '@/lib/organizers.server';
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
  searchParams?: {
    organizerId?: string | string[];
  };
};

function formatPercent(value: number) {
  return `${Math.round(value)}%`;
}

function formatDecimal(value: number) {
  return new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1
  }).format(value);
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
        <div className="mt-5">
          <Link
            href="/organisme/sejours"
            className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:border-slate-300"
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
  const visitsLookbackDate = new Date(
    Date.now() - STAY_VISIT_LOOKBACK_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();
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
      : [{ data: [] }, { data: [] }, { data: [] }];

  const sessions = sessionsRaw ?? [];
  const sessionIds = sessions.map((sessionItem) => sessionItem.id);
  const reservedCounts = await getReservedSessionCounts(supabase, sessionIds);

  const dashboardModel = buildOrganizerDashboardModel({
    stays,
    sessions,
    stayMedia: stayMediaRaw ?? [],
    stayVisits: stayVisitsRaw ?? [],
    members: membersRaw ?? [],
    reservedCounts,
    vigilanceOccupancyThreshold: 25
  });
  const { metrics, stayRows, lists } = dashboardModel;
  const organizerLabel = selectedOrganizer?.name ?? 'Organisateur';
  const teamCount = metrics.ownerCount + metrics.editorCount + metrics.reservationManagerCount;

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>
            <p className="mt-1 text-sm text-slate-600">
              Vue d&apos;ensemble de {organizerLabel}. Mode actuel : {ORGANIZER_ACCESS_LABELS[accessRole]}.
            </p>
            <p className="mt-3 text-sm text-slate-700">
              {metrics.totalStays} séjours suivis, {metrics.totalReservations} réservations,{' '}
              {formatPercent(metrics.occupancyRate)} de remplissage global.
            </p>
            <p className="mt-1 text-xs text-slate-500">Équipe active : {teamCount} membre(s).</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href={withOrganizerQuery('/organisme/sejours', organizerId)}
              className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              Gérer les séjours
            </Link>
            <Link
              href={withOrganizerQuery('/organisme/reservations', organizerId)}
              className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:border-slate-300"
            >
              Gérer les réservations
            </Link>
          </div>
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
              <KpiInfo text="Sessions marquées complètes ou à capacité atteinte." />
            </p>
            <Gauge className="h-4 w-4 text-slate-400" />
          </div>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{metrics.fullSessionsCount}</p>
        </article>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <article className="min-h-[140px] rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Visites des pages séjour ({STAY_VISIT_LOOKBACK_DAYS}j)
            <KpiInfo text="Nombre total d'ouvertures des pages de séjour." />
          </p>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{metrics.totalStayVisits}</p>
        </article>

        <article className="min-h-[140px] rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Pages de séjour visitées ({STAY_VISIT_LOOKBACK_DAYS}j)
            <KpiInfo text="Pages de séjour ayant reçu au moins une visite sur la période." />
          </p>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{metrics.visitedStaysCount}</p>
        </article>

        <article className="min-h-[140px] rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Visites moyennes / page séjour ({STAY_VISIT_LOOKBACK_DAYS}j)
            <KpiInfo text="Moyenne de visites par page de séjour sur la période." />
          </p>
          <p className="mt-3 text-3xl font-semibold text-slate-900">
            {formatDecimal(metrics.avgVisitsPerStay)}
          </p>
        </article>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Pilotage commercial</h2>
            <p className="text-sm text-slate-600">
              Priorisez les actions grâce aux séjours qui performent, stagnent ou nécessitent une intervention rapide.
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
              Top séjours
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
                      {stay.reserved} résa · {formatPercent(stay.occupancy)}
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
              Séjours sans traction
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
                    <span className="shrink-0 text-xs text-slate-500">{stay.sessionCount} sessions</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-slate-500">Aucun séjour sans traction à prioriser.</p>
            )}
          </article>

          <article className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
            <h3 className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900">
              <Gauge className="h-4 w-4 text-rose-600" />
              Points de vigilance
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
                      {formatPercent(stay.occupancy)} · {stay.reserved}/{stay.capacity}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-slate-500">Aucun séjour sous le seuil de fréquentation de 25%.</p>
            )}
          </article>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="text-lg font-semibold text-slate-900">Suivi des séjours</h2>
          <p className="mt-1 text-sm text-slate-600">
            Détail des performances pour repérer rapidement les fiches à optimiser.
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
                      <Link
                        href={withOrganizerQuery(`/organisme/sejours/${stay.id}`, organizerId)}
                        className="font-medium text-slate-900 hover:text-brand-700"
                      >
                        {formatStayDisplayTitle(stay.title)}
                      </Link>
                      <div className="mt-1 text-xs text-slate-500">
                        Mis à jour le {new Date(stay.updatedAt).toLocaleDateString('fr-FR')}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${stayStatusBadgeClassName(stay.status)}`}
                      >
                        {stayStatusLabel(stay.status)}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-slate-600">{stay.sessionCount}</td>
                    <td className="px-5 py-4 text-slate-600">{stay.reserved}</td>
                    <td className="px-5 py-4 text-slate-600">{formatPercent(stay.occupancy)}</td>
                    <td className="px-5 py-4">
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
                className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:border-slate-300"
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
