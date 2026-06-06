import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requirePartner } from '@/lib/auth/require';
import { canAccessPartnerSection, getPartnerAccessRoleFromSession } from '@/lib/partner-access';
import {
  buildPartnerAmountsByOrganizerModel,
  formatPartnerOrganizerAmountMoney
} from '@/lib/partner-amounts-by-organizer.server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata = {
  title: 'Commandes Organisateurs'
};

type PageProps = {
  searchParams?: Promise<{ saison?: string }>;
};

export default async function PartnerOrganizerAmountsPage({ searchParams }: PageProps) {
  const session = await requirePartner();
  const collectivityId = session.tenantId;
  const accessRole = getPartnerAccessRoleFromSession(session);
  const params = searchParams ? await searchParams : undefined;
  const selectedSeasonId = params?.saison?.trim() || null;

  if (!canAccessPartnerSection(accessRole, 'organizer-amounts')) {
    redirect('/partenaire');
  }

  if (!collectivityId) {
    return (
      <div className="space-y-4">
        <h1 className="admin-page-title">Commandes Organisateurs</h1>
        <p className="admin-page-subtitle mt-1">Aucune collectivité liée à ce compte.</p>
      </div>
    );
  }

  const model = await buildPartnerAmountsByOrganizerModel({
    collectivityId,
    seasonId: selectedSeasonId
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="admin-page-title">Commandes Organisateurs</h1>
          <p className="admin-page-subtitle mt-1">
            Synthèse des montants de prise en charge {model.partnerName} par organisateur, calculés à partir des
            réservations de vos ayants-droit.
          </p>
          <p className="mt-2 text-sm text-slate-500">
            Mode de financement actuel : <span className="font-medium text-slate-700">{model.financeModeLabel}</span>
          </p>
        </div>

        <form method="get" className="shrink-0">
          <p className="mb-1 text-sm font-medium text-slate-700">Saison</p>
          <div className="flex flex-nowrap items-center gap-2">
            <select
              name="saison"
              defaultValue={selectedSeasonId ?? ''}
              className="h-11 min-w-[220px] rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900"
            >
              <option value="">Toutes les saisons</option>
              {model.seasonOptions.map((season) => (
                <option key={season.id} value={season.id}>
                  {season.name}
                </option>
              ))}
            </select>
            <button type="submit" className="btn btn-secondary btn-sm h-11 shrink-0">
              Filtrer
            </button>
            {selectedSeasonId ? (
              <Link href="/partenaire/montants-organisateurs" className="btn btn-ghost btn-sm h-11 shrink-0">
                Réinitialiser
              </Link>
            ) : null}
          </div>
        </form>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="admin-kpi-label">Organismes</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{model.rows.length}</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="admin-kpi-label">Réservations</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{model.totals.reservationCount}</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="admin-kpi-label">Volume total</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">
            {formatPartnerOrganizerAmountMoney(model.totals.totalCents)}
          </p>
        </article>
        <article className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
          <p className="admin-kpi-label text-emerald-800">Part partenaire (due)</p>
          <p className="mt-2 text-2xl font-semibold text-emerald-900">
            {formatPartnerOrganizerAmountMoney(model.totals.partnerContributionCents)}
          </p>
        </article>
      </section>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="admin-section-title">Détail par organisateur</h2>
          <p className="mt-1 text-sm text-slate-500">
            La part partenaire correspond au montant de prise en charge CSE sur les réservations concernées.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-[960px] w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-5 py-3">Organisme</th>
                <th className="px-5 py-3 text-right">Réservations</th>
                <th className="px-5 py-3 text-right">Participants</th>
                <th className="px-5 py-3 text-right">Volume total</th>
                <th className="px-5 py-3 text-right">Part partenaire</th>
                <th className="px-5 py-3 text-right">Part famille</th>
              </tr>
            </thead>
            <tbody>
              {model.rows.map((row) => (
                <tr key={row.organizerId} className="border-t border-slate-100">
                  <td className="px-5 py-4">
                    <p className="font-semibold text-slate-900">{row.organizerName}</p>
                    {row.pendingManualCount > 0 ? (
                      <p className="mt-1 text-xs text-amber-700">
                        {row.pendingManualCount} ligne{row.pendingManualCount > 1 ? 's' : ''} sans montant confirmé
                      </p>
                    ) : null}
                  </td>
                  <td className="px-5 py-4 text-right text-slate-700">{row.reservationCount}</td>
                  <td className="px-5 py-4 text-right text-slate-700">{row.itemCount}</td>
                  <td className="px-5 py-4 text-right font-medium text-slate-900">
                    {formatPartnerOrganizerAmountMoney(row.totalCents)}
                  </td>
                  <td className="px-5 py-4 text-right font-semibold text-emerald-800">
                    {formatPartnerOrganizerAmountMoney(row.partnerContributionCents)}
                  </td>
                  <td className="px-5 py-4 text-right text-slate-700">
                    {formatPartnerOrganizerAmountMoney(row.clientContributionCents)}
                  </td>
                </tr>
              ))}
              {model.rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-slate-500">
                    {selectedSeasonId
                      ? 'Aucune réservation pour cette saison.'
                      : 'Aucune réservation enregistrée pour le moment.'}
                  </td>
                </tr>
              ) : null}
            </tbody>
            {model.rows.length > 0 ? (
              <tfoot className="border-t border-slate-200 bg-slate-50 text-sm font-semibold text-slate-900">
                <tr>
                  <td className="px-5 py-4">Total</td>
                  <td className="px-5 py-4 text-right">{model.totals.reservationCount}</td>
                  <td className="px-5 py-4 text-right">{model.totals.itemCount}</td>
                  <td className="px-5 py-4 text-right">
                    {formatPartnerOrganizerAmountMoney(model.totals.totalCents)}
                  </td>
                  <td className="px-5 py-4 text-right text-emerald-800">
                    {formatPartnerOrganizerAmountMoney(model.totals.partnerContributionCents)}
                  </td>
                  <td className="px-5 py-4 text-right">
                    {formatPartnerOrganizerAmountMoney(model.totals.clientContributionCents)}
                  </td>
                </tr>
              </tfoot>
            ) : null}
          </table>
        </div>
      </div>

      <p className="text-sm text-slate-500">
        Les commandes annulées ou transférées sont exclues. Pour le détail ligne par ligne, consultez la page{' '}
        <Link href="/partenaire/reservations" className="font-medium text-sky-700 hover:text-sky-800">
          Réservations
        </Link>
        .
      </p>
    </div>
  );
}
