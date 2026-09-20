import Link from 'next/link';
import { requireRole } from '@/lib/auth/require';
import { isMissingPublicTableError } from '@/lib/mnemos/supabase-table-missing';
import { MnemosFieldLabel } from '@/components/mnemos/MnemosFieldLabel';
import { getServerSupabaseClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type Sp = { status?: string };

const STATUS_LABELS: Record<string, string> = {
  PENDING_MNEMOS: 'En attente Mnemos',
  APPROVED: 'Approuvée',
  REJECTED: 'Refusée',
  CANCELLED_DIRECT: 'Annulation directe'
};

export default async function MnemosCancellationsPage({
  searchParams
}: {
  searchParams?: Promise<Sp>;
}) {
  await requireRole('MNEMOS');
  const sp = searchParams ? await searchParams : {};
  const supabase = getServerSupabaseClient();

  let q = supabase
    .from('order_cancellation_requests')
    .select('id, created_at, order_id, organizer_id, kind, status, reason, amount_cents')
    .order('created_at', { ascending: false });

  if (sp.status?.trim()) {
    q = q.eq('status', sp.status.trim());
  }

  const { data: rows, error } = await q.limit(200);
  const tableMissing = error && isMissingPublicTableError(error);
  const pendingCount = (rows ?? []).filter((row) => row.status === 'PENDING_MNEMOS').length;

  const organizerIds = Array.from(new Set((rows ?? []).map((row) => row.organizer_id)));
  const { data: organizers } = organizerIds.length
    ? await supabase.from('organizers').select('id, name').in('id', organizerIds)
    : { data: [] as Array<{ id: string; name: string }> };
  const organizerNameById = new Map((organizers ?? []).map((row) => [row.id, row.name]));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Annulations & remboursements</h1>
        <p className="mt-1 text-sm text-slate-400">
          Demandes organisateurs : annulation sans paiement (info) ou remboursement à valider.
        </p>
        {!tableMissing && !error ? (
          <p className="mt-2 text-sm text-violet-300">
            {pendingCount} demande{pendingCount === 1 ? '' : 's'} en attente.
          </p>
        ) : null}
      </div>

      {tableMissing ? (
        <div className="rounded-lg border border-amber-800/50 bg-amber-950/30 px-4 py-3 text-sm text-amber-100">
          Table absente. Appliquez{' '}
          <code className="text-amber-50">20260920_payment_reminders_and_cancellations.sql</code>.
        </div>
      ) : null}

      {error && !tableMissing ? (
        <div className="rounded-lg border border-rose-800/50 bg-rose-950/30 px-4 py-3 text-sm text-rose-100">
          {error.message}
        </div>
      ) : null}

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
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <button className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white">
          Filtrer
        </button>
      </form>

      <div className="overflow-x-auto rounded-xl border border-slate-700">
        <table className="min-w-full text-left text-sm text-slate-200">
          <thead className="bg-slate-900 text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Organisme</th>
              <th className="px-4 py-3">Commande</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Statut</th>
              <th className="px-4 py-3">Montant</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {(rows ?? []).map((row) => (
              <tr key={row.id} className="border-t border-slate-800">
                <td className="px-4 py-3">{new Date(row.created_at).toLocaleString('fr-FR')}</td>
                <td className="px-4 py-3">{organizerNameById.get(row.organizer_id) ?? row.organizer_id}</td>
                <td className="px-4 py-3 font-mono text-xs">{row.order_id}</td>
                <td className="px-4 py-3">{row.kind === 'REFUND' ? 'Remboursement' : 'Annulation'}</td>
                <td className="px-4 py-3">{STATUS_LABELS[row.status] ?? row.status}</td>
                <td className="px-4 py-3">
                  {row.amount_cents != null
                    ? `${(row.amount_cents / 100).toFixed(2)} €`
                    : '—'}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/mnemos/cancellations/${row.id}`}
                    className="font-semibold text-violet-300 hover:text-violet-200"
                  >
                    Ouvrir
                  </Link>
                </td>
              </tr>
            ))}
            {!tableMissing && !error && (rows ?? []).length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-slate-500">
                  Aucune demande.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
