import Link from 'next/link';
import OrganizerPageHeader from '@/components/organisme/OrganizerPageHeader';
import { requireOrganizerPageAccess } from '@/lib/organizer-backoffice-access.server';
import { withOrganizerQuery } from '@/lib/organizers.server';
import {
  buildOrganizerAmountsByPartnerModel,
  formatOrganizerPartnerAmountMoney
} from '@/lib/organizer-amounts-by-partner.server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata = {
  title: 'Montants partenaires'
};

type PageProps = {
  searchParams?: Promise<{
    organizerId?: string | string[];
    saison?: string;
  }>;
};

export default async function OrganizerPartnerAmountsPage({ searchParams }: PageProps) {
  const sp = searchParams ? await searchParams : {};
  const { selectedOrganizerId } = await requireOrganizerPageAccess({
    requestedOrganizerId: sp.organizerId,
    requiredSection: 'partner-amounts'
  });
  const selectedSeasonId = typeof sp.saison === 'string' ? sp.saison.trim() || null : null;

  const model = await buildOrganizerAmountsByPartnerModel({
    organizerId: selectedOrganizerId,
    seasonId: selectedSeasonId
  });

  const pageHref = withOrganizerQuery('/organisme/montants-partenaires', selectedOrganizerId);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <OrganizerPageHeader
          title="Montants partenaires"
          subtitle={`Total dû par chaque CSE / partenaire pour les réservations de ${model.organizerName}.`}
        />

        <form method="get" className="shrink-0">
          {selectedOrganizerId ? (
            <input type="hidden" name="organizerId" value={selectedOrganizerId} />
          ) : null}
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
              <Link href={pageHref} className="btn btn-ghost btn-sm h-11 shrink-0">
                Réinitialiser
              </Link>
            ) : null}
          </div>
        </form>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Partenaire / CSE</th>
              <th className="px-4 py-3 text-right">Réservations</th>
              <th className="px-4 py-3 text-right">Lignes</th>
              <th className="px-4 py-3 text-right">Total séjours</th>
              <th className="px-4 py-3 text-right">Dû par le partenaire</th>
              <th className="px-4 py-3 text-right">Part famille</th>
            </tr>
          </thead>
          <tbody>
            {model.rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                  Aucune prise en charge partenaire à afficher pour le moment.
                </td>
              </tr>
            ) : (
              model.rows.map((row) => (
                <tr key={row.collectivityId} className="border-t border-slate-100">
                  <td className="px-4 py-3 font-medium text-slate-900">{row.partnerName}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-700">{row.reservationCount}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-700">{row.itemCount}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-700">
                    {formatOrganizerPartnerAmountMoney(row.totalCents)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums font-semibold text-teal-800">
                    {formatOrganizerPartnerAmountMoney(row.partnerContributionCents)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-700">
                    {formatOrganizerPartnerAmountMoney(row.clientContributionCents)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
          {model.rows.length > 0 ? (
            <tfoot className="border-t border-slate-200 bg-slate-50 font-semibold text-slate-900">
              <tr>
                <td className="px-4 py-3">Total</td>
                <td className="px-4 py-3 text-right tabular-nums">{model.totals.reservationCount}</td>
                <td className="px-4 py-3 text-right tabular-nums">{model.totals.itemCount}</td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {formatOrganizerPartnerAmountMoney(model.totals.totalCents)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-teal-800">
                  {formatOrganizerPartnerAmountMoney(model.totals.partnerContributionCents)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {formatOrganizerPartnerAmountMoney(model.totals.clientContributionCents)}
                </td>
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>
    </div>
  );
}
