import Link from 'next/link';
import { requireRole } from '@/lib/auth/require';
import {
  ACCOUNT_DELETION_STATUS_LABELS,
  ACCOUNT_DELETION_STATUS_VALUES,
  isAccountDeletionStatus
} from '@/lib/account-deletion';
import { isMissingPublicTableError } from '@/lib/mnemos/supabase-table-missing';
import { MnemosFieldLabel } from '@/components/mnemos/MnemosFieldLabel';
import { formatMnemosStatus } from '@/lib/mnemos-display';
import { getServerSupabaseClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type Sp = {
  status?: string;
};

export default async function MnemosAccountDeletionsPage({
  searchParams
}: {
  searchParams?: Promise<Sp>;
}) {
  await requireRole('MNEMOS');
  const sp = searchParams ? await searchParams : {};
  const supabase = getServerSupabaseClient();

  let q = supabase
    .from('account_deletion_requests')
    .select('id, created_at, email, full_name, status, reason, processed_at')
    .order('created_at', { ascending: false });

  if (sp.status?.trim() && isAccountDeletionStatus(sp.status.trim())) {
    q = q.eq('status', sp.status.trim());
  }

  const { data: rows, error } = await q.limit(200);
  const tableMissing = error && isMissingPublicTableError(error);
  const pendingCount = (rows ?? []).filter((row) => row.status === 'pending').length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Suppressions de compte</h1>
        <p className="mt-1 text-sm text-slate-400">
          Demandes RGPD envoyées depuis l&apos;espace Mon compte des familles. Traitement manuel
          (vérifier réservations en cours avant suppression).
        </p>
        {!tableMissing && !error ? (
          <p className="mt-2 text-sm text-violet-300">
            {pendingCount} demande{pendingCount === 1 ? '' : 's'} en attente sur cette page.
          </p>
        ) : null}
      </div>

      {tableMissing && (
        <div className="rounded-lg border border-amber-800/50 bg-amber-950/30 px-4 py-3 text-sm text-amber-100">
          La table des demandes de suppression est absente. Appliquez la migration{' '}
          <code className="text-amber-50">20260910_create_account_deletion_requests.sql</code> sur
          Supabase.
        </div>
      )}

      {error && !tableMissing && (
        <div className="rounded-lg border border-rose-800/50 bg-rose-950/30 px-4 py-3 text-sm text-rose-100">
          {error.message}
        </div>
      )}

      <form
        method="get"
        className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-700 bg-slate-900/50 p-4"
      >
        <label className="text-sm text-slate-300">
          <MnemosFieldLabel>Statut</MnemosFieldLabel>
          <select
            name="status"
            defaultValue={sp.status ?? ''}
            className="mt-1 block rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-white"
          >
            <option value="">Tous</option>
            {ACCOUNT_DELETION_STATUS_VALUES.map((value) => (
              <option key={value} value={value}>
                {ACCOUNT_DELETION_STATUS_LABELS[value]}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500"
        >
          Filtrer
        </button>
      </form>

      <div className="overflow-x-auto rounded-xl border border-slate-700">
        <table className="min-w-full divide-y divide-slate-800 text-left text-sm">
          <thead className="bg-slate-900/80 text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Compte</th>
              <th className="px-4 py-3 font-medium">Statut</th>
              <th className="px-4 py-3 font-medium">Motif</th>
              <th className="px-4 py-3 font-medium" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800 bg-slate-950/40">
            {(rows ?? []).map((row) => (
              <tr key={row.id} className="hover:bg-slate-900/60">
                <td className="whitespace-nowrap px-4 py-3 text-slate-300">
                  {new Date(row.created_at).toLocaleString('fr-FR')}
                </td>
                <td className="px-4 py-3">
                  <div className="font-medium text-slate-100">{row.full_name || '—'}</div>
                  <div className="text-xs text-slate-500">{row.email}</div>
                </td>
                <td className="px-4 py-3 text-slate-200">{formatMnemosStatus(row.status)}</td>
                <td className="max-w-xs truncate px-4 py-3 text-slate-400">
                  {row.reason?.trim() || '—'}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/mnemos/account-deletions/${row.id}`}
                    className="text-sm font-semibold text-violet-300 hover:text-violet-200"
                  >
                    Ouvrir
                  </Link>
                </td>
              </tr>
            ))}
            {!tableMissing && !(rows ?? []).length ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                  Aucune demande pour ce filtre.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
