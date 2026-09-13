import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireRole } from '@/lib/auth/require';
import {
  ACCOUNT_DELETION_STATUS_LABELS,
  ACCOUNT_DELETION_STATUS_VALUES
} from '@/lib/account-deletion';
import { isMissingPublicTableError } from '@/lib/mnemos/supabase-table-missing';
import { MnemosDt, MnemosFieldLabel } from '@/components/mnemos/MnemosFieldLabel';
import { formatMnemosStatus } from '@/lib/mnemos-display';
import { getServerSupabaseClient } from '@/lib/supabase/server';
import { updateAccountDeletionRequest } from '../actions';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ saved?: string; err?: string }>;
};

export default async function MnemosAccountDeletionDetailPage({ params, searchParams }: PageProps) {
  await requireRole('MNEMOS');
  const { id } = await params;
  const sp = searchParams ? await searchParams : {};
  const supabase = getServerSupabaseClient();

  const { data: row, error } = await supabase
    .from('account_deletion_requests')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error && isMissingPublicTableError(error)) {
    return (
      <div className="rounded-lg border border-amber-800/50 bg-amber-950/30 p-6 text-sm text-amber-100">
        La table des demandes de suppression est absente. Appliquez la migration sur Supabase.
      </div>
    );
  }
  if (error || !row) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link
        href="/mnemos/account-deletions"
        className="text-xs font-medium text-violet-400 hover:text-violet-200"
      >
        ← Liste
      </Link>

      {sp.saved === '1' && (
        <div className="rounded-lg border border-emerald-800/50 bg-emerald-950/30 px-3 py-2 text-sm text-emerald-100">
          Enregistré.
        </div>
      )}
      {sp.err && (
        <div className="rounded-lg border border-rose-800/50 bg-rose-950/30 px-3 py-2 text-sm text-rose-100">
          {decodeURIComponent(sp.err)}
        </div>
      )}

      <div>
        <h1 className="text-2xl font-semibold text-white">Demande de suppression</h1>
        <p className="mt-1 text-sm text-slate-400">{formatMnemosStatus(row.status)}</p>
        <p className="text-xs text-slate-600">{row.id}</p>
      </div>

      <section className="rounded-xl border border-slate-700 bg-slate-900/50 p-5">
        <h2 className="text-sm font-semibold text-slate-400">Compte famille</h2>
        <dl className="mt-3 space-y-2 text-sm">
          <div>
            <MnemosDt className="text-slate-500">Nom</MnemosDt>
            <dd className="text-slate-200">{row.full_name || '—'}</dd>
          </div>
          <div>
            <MnemosDt className="text-slate-500">E-mail</MnemosDt>
            <dd className="text-slate-200">{row.email}</dd>
          </div>
          <div>
            <MnemosDt className="text-slate-500">User ID</MnemosDt>
            <dd className="font-mono text-xs text-slate-400">{row.user_id}</dd>
          </div>
          <div>
            <MnemosDt className="text-slate-500">Demandé le</MnemosDt>
            <dd className="text-slate-200">
              {new Date(row.created_at).toLocaleString('fr-FR')}
            </dd>
          </div>
          <div>
            <MnemosDt className="text-slate-500">Motif</MnemosDt>
            <dd className="whitespace-pre-wrap text-slate-300">
              {row.reason?.trim() || 'Aucun motif précisé.'}
            </dd>
          </div>
          {row.processed_at ? (
            <div>
              <MnemosDt className="text-slate-500">Traité le</MnemosDt>
              <dd className="text-slate-200">
                {new Date(row.processed_at).toLocaleString('fr-FR')}
                {row.processed_by ? (
                  <span className="ml-2 font-mono text-xs text-slate-500">
                    par {row.processed_by}
                  </span>
                ) : null}
              </dd>
            </div>
          ) : null}
        </dl>
      </section>

      <section className="rounded-xl border border-amber-800/40 bg-amber-950/20 p-5 text-sm text-amber-100">
        <p className="font-semibold">Avant de marquer comme traité</p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-amber-100/90">
          <li>Vérifier qu’il n’y a pas de réservation en cours.</li>
          <li>Supprimer / anonymiser le compte Auth et le profil famille côté Supabase.</li>
          <li>Conserver les pièces comptables si obligation légale.</li>
        </ul>
      </section>

      <section className="rounded-xl border border-slate-700 bg-slate-900/50 p-5">
        <h2 className="text-sm font-semibold text-slate-400">Traitement</h2>
        <form action={updateAccountDeletionRequest} className="mt-4 space-y-4">
          <input type="hidden" name="id" value={row.id} />
          <label className="block text-sm text-slate-300">
            <MnemosFieldLabel>Statut</MnemosFieldLabel>
            <select
              name="status"
              defaultValue={row.status}
              className="mt-1 block w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-white"
            >
              {ACCOUNT_DELETION_STATUS_VALUES.map((value) => (
                <option key={value} value={value}>
                  {ACCOUNT_DELETION_STATUS_LABELS[value]}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm text-slate-300">
            <MnemosFieldLabel>Notes internes</MnemosFieldLabel>
            <textarea
              name="notes"
              rows={4}
              defaultValue={row.notes ?? ''}
              className="mt-1 block w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-white"
              placeholder="Ex. réservations vérifiées, compte Auth supprimé le…"
            />
          </label>
          <button
            type="submit"
            className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500"
          >
            Enregistrer
          </button>
        </form>
      </section>
    </div>
  );
}
