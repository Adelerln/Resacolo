import Link from 'next/link';
import { requirePartner } from '@/lib/auth/require';
import { canAccessPartnerSection, getPartnerAccessRoleFromSession } from '@/lib/partner-access';
import { buildPartnerDashboardModel } from '@/lib/partner-dashboard';

function formatCurrencyFromCents(value: number) {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value / 100);
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('fr-FR');
}

export default async function PartnerHome() {
  const session = await requirePartner();
  const collectivityId = session.tenantId;
  const accessRole = getPartnerAccessRoleFromSession(session);

  if (!collectivityId) {
    return (
      <div className="space-y-4">
        <h1 className="admin-page-title">Dashboard partenaire</h1>
        <p className="admin-page-subtitle mt-1">Aucune collectivité liée à ce compte.</p>
      </div>
    );
  }

  const dashboard = await buildPartnerDashboardModel({
    collectivityId,
    userId: session.userId
  });

  const maxDailyCount = Math.max(1, ...dashboard.dailyReservationsSeries.map((point) => point.count));
  const maxStatusCount = Math.max(1, ...dashboard.statusBreakdown.map((item) => item.count));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="admin-page-title">Dashboard partenaire</h1>
      </div>

      {dashboard.emptyState.hasNoBeneficiaries ? (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="font-semibold">Onboarding requis</p>
          <p className="mt-1">{dashboard.emptyState.message}</p>
          <p className="mt-1">
            Code à transmettre: <span className="font-semibold">{dashboard.collectivityCode}</span>
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link href="/partenaire/beneficiaires" className="rounded-lg border border-amber-300 bg-white px-3 py-2 text-xs font-semibold">
              Ouvrir les bénéficiaires
            </Link>
            {canAccessPartnerSection(accessRole, 'partner-profile') ? (
              <Link href="/partenaire/fiche" className="rounded-lg border border-amber-300 bg-white px-3 py-2 text-xs font-semibold">
                Ouvrir la fiche partenaire
              </Link>
            ) : null}
          </div>
        </section>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <article className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="admin-kpi-label">Ayants-droit actifs</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{dashboard.metrics.beneficiariesCount}</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="admin-kpi-label">Réservations (30j)</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{dashboard.metrics.reservations30d}</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="admin-kpi-label">Taux finalisées</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{Math.round(dashboard.metrics.finalizedRate30d)}%</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="admin-kpi-label">Montant total (30j)</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{formatCurrencyFromCents(dashboard.metrics.totalCents30d)}</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="admin-kpi-label">Part partenaire (30j)</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{formatCurrencyFromCents(dashboard.metrics.partnerCents30d)}</p>
          <p className="mt-1 text-xs text-slate-500">Mode: {dashboard.financeModeLabel}</p>
        </article>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <article className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="admin-section-title">Évolution des réservations (30j)</h2>
          <div className="mt-4 flex h-52 items-end gap-1.5 rounded-lg border border-slate-100 bg-slate-50 px-2 py-3">
            {dashboard.dailyReservationsSeries.map((point) => {
              const height = Math.max(4, Math.round((point.count / maxDailyCount) * 100));
              return (
                <div key={point.dayKey} className="group relative flex-1">
                  <div
                    className="w-full rounded-sm bg-emerald-500/85 transition group-hover:bg-emerald-500"
                    style={{ height: `${height}%` }}
                    title={`${point.label}: ${point.count}`}
                    aria-label={`${point.label}: ${point.count} réservations`}
                  />
                </div>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-slate-500">Survoler les barres pour le détail journalier.</p>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="admin-section-title">Répartition des statuts (30j)</h2>
          <div className="mt-4 space-y-3">
            {dashboard.statusBreakdown.map((item) => {
              const width = Math.max(2, Math.round((item.count / maxStatusCount) * 100));
              return (
                <div key={item.status} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-slate-700">{item.label}</span>
                    <span className="font-semibold text-slate-900">{item.count}</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100">
                    <div className="h-2 rounded-full bg-sky-500" style={{ width: `${width}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </article>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="admin-section-title">Dernières réservations</h2>
          </div>
          <div className="overflow-hidden">
            <table className="w-full table-fixed text-left text-sm">
              <colgroup>
                <col className="w-[18%]" />
                <col className="w-[20%]" />
                <col className="w-[28%]" />
                <col className="w-[16%]" />
                <col className="w-[18%]" />
              </colgroup>
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Commande</th>
                  <th className="px-4 py-3">Bénéficiaire</th>
                  <th className="px-4 py-3">Séjour</th>
                  <th className="px-4 py-3">Statut</th>
                  <th className="px-4 py-3">Total</th>
                </tr>
              </thead>
              <tbody>
                {dashboard.recentReservations.map((reservation) => (
                  <tr key={reservation.id} className="border-t border-slate-100">
                    <td className="px-4 py-3 text-slate-600">
                      <p className="font-medium text-slate-900 whitespace-nowrap">#{reservation.id.slice(0, 8).toUpperCase()}</p>
                      <p className="mt-1 text-xs text-slate-500 whitespace-nowrap">{formatDate(reservation.createdAt)}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      <p className="break-words">{reservation.beneficiaryName}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      <p className="break-words">{reservation.stayTitle}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      <p className="whitespace-nowrap">{reservation.statusLabel}</p>
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-900">
                      <p className="whitespace-nowrap">{reservation.totalLabel}</p>
                    </td>
                  </tr>
                ))}
                {dashboard.recentReservations.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-slate-500">
                      Aucune réservation enregistrée pour le moment.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="admin-section-title">Top séjours (30j)</h2>
          <div className="mt-4 space-y-3">
            {dashboard.topStays.map((stay) => (
              <div key={stay.stayTitle} className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
                <p className="font-medium text-slate-900">{stay.stayTitle}</p>
                <p className="mt-1 text-sm text-slate-600">
                  {stay.reservationsCount} réservations · {stay.totalLabel}
                </p>
              </div>
            ))}
            {dashboard.topStays.length === 0 ? (
              <p className="text-sm text-slate-500">Aucun séjour réservé sur la période.</p>
            ) : null}
          </div>
        </article>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="admin-section-title">Actions rapides</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {dashboard.quickActions.map((action) => (
            <Link key={action.href} href={action.href} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 transition hover:border-slate-300 hover:bg-white">
              <p className="text-sm font-semibold text-slate-900">{action.label}</p>
              <p className="mt-1 text-xs text-slate-600">{action.description}</p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
