import Link from 'next/link';
import { requireRole } from '@/lib/auth/require';
import {
  loadAdminFinancesReport,
  type FinancesGranularity
} from '@/lib/admin-finances-report.server';
import { getServerSupabaseClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function eurosFromCents(cents: number) {
  return (cents / 100).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });
}

const GRANULARITIES: { value: FinancesGranularity; label: string }[] = [
  { value: 'mois', label: 'Par mois' },
  { value: 'annee', label: "Par an (total sur l'année)" },
  { value: 'saison', label: 'Par saison' },
  { value: 'organisateur', label: 'Par organisateur' }
];

type PageProps = {
  searchParams?: Promise<{ annee?: string; granularite?: string }>;
};

export default async function AdminFinancesPage({ searchParams }: PageProps) {
  await requireRole('ADMIN');
  const sp = searchParams ? await searchParams : undefined;
  const yearRaw = sp?.annee;
  const year = yearRaw ? Number(yearRaw) : new Date().getFullYear();
  const safeYear = Number.isFinite(year) && year >= 2000 && year <= 2100 ? year : new Date().getFullYear();
  const granRaw = sp?.granularite;
  const granularity = (GRANULARITIES.some((g) => g.value === granRaw) ? granRaw : 'mois') as FinancesGranularity;

  const supabase = getServerSupabaseClient();
  const { rows, totals, warnings, ledgerTableMissing } = await loadAdminFinancesReport(
    supabase,
    safeYear,
    granularity
  );

  const yearOptions = Array.from({ length: 8 }, (_, i) => new Date().getFullYear() - 4 + i);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Recettes ResaColo</h1>
          <p className="text-sm text-slate-600">
            Frais constatés dans le journal : commissions au paiement des commandes, forfaits publication à la mise en
            ligne.
          </p>
        </div>
        <Link
          href="/admin/organizers"
          className="text-sm font-medium text-emerald-700 hover:text-emerald-800"
        >
          Paramètres de facturation par organisme →
        </Link>
      </div>

      {ledgerTableMissing && (
        <div className="rounded-xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-950">
          <p className="font-semibold">Journal des frais non disponible</p>
          <p className="mt-2">
            La base Supabase ne contient pas encore la table <code className="rounded bg-rose-100/80 px-1">resacolo_fee_ledger</code>{' '}
            (ou le cache API ne l’a pas encore rechargée). Appliquez la migration : fichier{' '}
            <code className="rounded bg-rose-100/80 px-1">sql/20260414_resacolo_fee_ledger.sql</code> dans le SQL Editor
            du dashboard Supabase, puis rechargez cette page.
          </p>
        </div>
      )}

      {!ledgerTableMissing && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="font-semibold">Méthode (journal des frais)</p>
          <ul className="mt-2 list-inside list-disc space-y-1">
            {warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      <form
        method="get"
        className="flex flex-wrap items-end gap-4 rounded-2xl border border-slate-200 bg-white p-4"
      >
        <label className="block text-sm font-medium text-slate-700">
          Année
          <select
            name="annee"
            defaultValue={String(safeYear)}
            className="mt-1 block rounded-lg border border-slate-200 px-3 py-2"
          >
            {yearOptions.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </label>
        <label className="block min-w-[12rem] text-sm font-medium text-slate-700">
          Regroupement
          <select
            name="granularite"
            defaultValue={granularity}
            className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2"
          >
            {GRANULARITIES.map((g) => (
              <option key={g.value} value={g.value}>
                {g.label}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
        >
          Actualiser
        </button>
      </form>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="min-w-[960px] w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">
                  {granularity === 'organisateur'
                    ? 'Organisme'
                    : granularity === 'mois'
                      ? 'Mois'
                      : granularity === 'saison'
                        ? 'Saison'
                        : 'Année'}
                </th>
                <th className="px-4 py-3 text-right">CA lignes commande (TTC)</th>
                <th className="px-4 py-3 text-right">Commission clients</th>
                <th className="px-4 py-3 text-right">Forfaits publication (net)</th>
                <th className="px-4 py-3 text-right tabular-nums">Mises en ligne facturées</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.key} className="border-t border-slate-100">
                  <td className="px-4 py-3 font-medium text-slate-900">{row.label}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-700">
                    {eurosFromCents(row.orderVolumeCents)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-700">
                    {eurosFromCents(row.commissionClientCents)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-700">
                    {eurosFromCents(row.publicationFeeCents)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-600">
                    {row.publicationPositiveCount}
                  </td>
                </tr>
              ))}
              {rows.length > 0 && (
                <tr className="border-t-2 border-slate-200 bg-slate-50/80 font-semibold">
                  <td className="px-4 py-3 text-slate-900">Total</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {eurosFromCents(totals.orderVolumeCents)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {eurosFromCents(totals.commissionClientCents)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {eurosFromCents(totals.publicationFeeCents)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-600">
                    {rows.reduce((s, r) => s + r.publicationPositiveCount, 0)}
                  </td>
                </tr>
              )}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                    Aucune donnée pour cette année et ce regroupement.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
