import Link from 'next/link';
import { requireRole } from '@/lib/auth/require';
import { reviewCancellationAction } from '@/app/mnemos/cancellations/actions';
import { isMissingPublicTableError } from '@/lib/mnemos/supabase-table-missing';
import { getServerSupabaseClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ error?: string; done?: string }>;
};

export default async function MnemosCancellationDetailPage({ params, searchParams }: PageProps) {
  await requireRole('MNEMOS');
  const { id } = await params;
  const sp = searchParams ? await searchParams : {};
  const supabase = getServerSupabaseClient();

  const { data: request, error } = await supabase
    .from('order_cancellation_requests')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error && isMissingPublicTableError(error)) {
    return (
      <div className="rounded-lg border border-amber-800/50 bg-amber-950/30 px-4 py-3 text-sm text-amber-100">
        Table absente. Appliquez la migration 20260920_payment_reminders_and_cancellations.sql.
      </div>
    );
  }

  if (!request) {
    return (
      <div className="space-y-4">
        <p className="text-rose-300">Demande introuvable.</p>
        <Link href="/mnemos/cancellations" className="text-violet-300 underline">
          Retour
        </Link>
      </div>
    );
  }

  const { data: organizer } = await supabase
    .from('organizers')
    .select('id, name')
    .eq('id', request.organizer_id)
    .maybeSingle();

  return (
    <div className="space-y-6">
      <div>
        <Link href="/mnemos/cancellations" className="text-sm text-violet-300 hover:underline">
          ← Retour à la liste
        </Link>
        <h1 className="mt-3 text-2xl font-semibold text-white">Demande {request.id}</h1>
        <p className="mt-1 text-sm text-slate-400">
          {request.kind === 'REFUND' ? 'Remboursement' : 'Annulation'} · {request.status}
        </p>
      </div>

      {sp.error ? (
        <div className="rounded-lg border border-rose-800/50 bg-rose-950/30 px-4 py-3 text-sm text-rose-100">
          {sp.error}
        </div>
      ) : null}
      {sp.done === '1' ? (
        <div className="rounded-lg border border-emerald-800/50 bg-emerald-950/30 px-4 py-3 text-sm text-emerald-100">
          Décision enregistrée.
        </div>
      ) : null}

      <section className="rounded-xl border border-slate-700 bg-slate-900/50 p-5 text-sm text-slate-200">
        <p>
          <strong>Organisme :</strong> {organizer?.name ?? request.organizer_id}
        </p>
        <p className="mt-2">
          <strong>Commande :</strong> <span className="font-mono text-xs">{request.order_id}</span>
        </p>
        <p className="mt-2">
          <strong>Montant :</strong>{' '}
          {request.amount_cents != null ? `${(request.amount_cents / 100).toFixed(2)} €` : '—'}
        </p>
        <p className="mt-2">
          <strong>Pièce jointe :</strong> {request.attachment_path || '—'}
        </p>
        <p className="mt-4 whitespace-pre-wrap">
          <strong>Motif :</strong>
          <br />
          {request.reason}
        </p>
        {request.review_note ? (
          <p className="mt-4 whitespace-pre-wrap text-slate-400">
            <strong>Note de revue :</strong>
            <br />
            {request.review_note}
          </p>
        ) : null}
      </section>

      {request.status === 'PENDING_MNEMOS' ? (
        <form action={reviewCancellationAction} className="space-y-3 rounded-xl border border-slate-700 bg-slate-900/50 p-5">
          <input type="hidden" name="request_id" value={request.id} />
          <label className="block text-sm text-slate-300">
            Note (optionnelle)
            <textarea
              name="review_note"
              rows={3}
              className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-white"
              placeholder="Ex. remboursement Monetico à traiter manuellement"
            />
          </label>
          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              name="decision"
              value="APPROVED"
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white"
            >
              Approuver (annule la commande)
            </button>
            <button
              type="submit"
              name="decision"
              value="REJECTED"
              className="rounded-lg bg-rose-700 px-4 py-2 text-sm font-semibold text-white"
            >
              Refuser
            </button>
          </div>
          <p className="text-xs text-slate-500">
            V1 : l’approbation trace la décision et annule la commande ; le remboursement Monetico reste un runbook
            opérationnel.
          </p>
        </form>
      ) : null}
    </div>
  );
}
