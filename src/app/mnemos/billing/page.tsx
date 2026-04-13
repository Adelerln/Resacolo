import { requireRole } from '@/lib/auth/require';
import {
  loadLedgerCommissionLines,
  loadLedgerPublicationLines,
  sumCents
} from '@/lib/mnemos/ledger-period-preview.server';
import { periodEndExclusive, periodStartIso } from '@/lib/mnemos/period-bounds';
import { isMissingPublicTableError } from '@/lib/mnemos/supabase-table-missing';
import { getServerSupabaseClient } from '@/lib/supabase/server';
import { createCommissionPeriodInvoice, createPublicationPeriodInvoice } from './actions';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function euros(cents: number) {
  return (cents / 100).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });
}

type Search = {
  organizer_id?: string;
  start_date?: string;
  end_date?: string;
  flash?: string;
  flash_err?: string;
};

export default async function MnemosBillingPage({
  searchParams
}: {
  searchParams?: Promise<Search>;
}) {
  await requireRole('ADMIN');
  const sp = searchParams ? await searchParams : {};
  const supabase = getServerSupabaseClient();

  const { data: organizers } = await supabase.from('organizers').select('id, name').order('name', { ascending: true });

  const organizerId = sp.organizer_id?.trim() ?? '';
  const startDate = sp.start_date?.trim() ?? '';
  const endDate = sp.end_date?.trim() ?? '';

  let pubLines: Awaited<ReturnType<typeof loadLedgerPublicationLines>>['lines'] = [];
  let comLines: Awaited<ReturnType<typeof loadLedgerCommissionLines>>['lines'] = [];
  let ledgerError: string | null = null;

  if (organizerId && startDate && endDate) {
    const startIso = periodStartIso(startDate);
    const endIso = periodEndExclusive(endDate);
    const [pub, com] = await Promise.all([
      loadLedgerPublicationLines(supabase, organizerId, startIso, endIso),
      loadLedgerCommissionLines(supabase, organizerId, startIso, endIso)
    ]);
    pubLines = pub.lines;
    comLines = com.lines;
    ledgerError = pub.error ?? com.error ?? null;
    if (ledgerError && isMissingPublicTableError({ message: ledgerError })) {
      ledgerError =
        'Table resacolo_fee_ledger absente : appliquez sql/20260414_resacolo_fee_ledger.sql pour activer la facturation sur journal.';
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-white">Facturation par période</h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-400">
          Les montants sont issus du journal <code className="text-violet-300">resacolo_fee_ledger</code> sur la
          période choisie. La création enregistre une facture + lignes + un événement dans{' '}
          <code className="text-violet-300">organizer_billing_events</code>.
        </p>
      </div>

      {sp.flash && (
        <div className="rounded-lg border border-emerald-800/60 bg-emerald-950/40 px-4 py-3 text-sm text-emerald-100">
          {sp.flash.includes('%') ? decodeURIComponent(sp.flash) : sp.flash}
        </div>
      )}
      {sp.flash_err && (
        <div className="rounded-lg border border-rose-800/60 bg-rose-950/40 px-4 py-3 text-sm text-rose-100">
          {sp.flash_err.includes('%') ? decodeURIComponent(sp.flash_err) : sp.flash_err}
        </div>
      )}

      <form
        method="get"
        className="flex flex-wrap items-end gap-4 rounded-xl border border-slate-700 bg-slate-900/50 p-5"
      >
        <label className="block min-w-[14rem] text-sm text-slate-300">
          Organisateur
          <select
            name="organizer_id"
            defaultValue={organizerId}
            className="mt-1 block w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-white"
          >
            <option value="">— Choisir —</option>
            {(organizers ?? []).map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm text-slate-300">
          Début
          <input
            type="date"
            name="start_date"
            defaultValue={startDate}
            className="mt-1 block rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-white"
          />
        </label>
        <label className="block text-sm text-slate-300">
          Fin
          <input
            type="date"
            name="end_date"
            defaultValue={endDate}
            className="mt-1 block rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-white"
          />
        </label>
        <button
          type="submit"
          className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500"
        >
          Prévisualiser
        </button>
      </form>

      {organizerId && startDate && endDate && (
        <div className="grid gap-8 lg:grid-cols-2">
          <section className="rounded-xl border border-slate-700 bg-slate-900/50 p-5">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="text-lg font-semibold text-white">A. Publications</h2>
                <p className="text-sm text-slate-500">
                  Total : <span className="font-mono text-violet-200">{euros(sumCents(pubLines))}</span>
                </p>
              </div>
              <form action={createPublicationPeriodInvoice}>
                <input type="hidden" name="organizer_id" value={organizerId} />
                <input type="hidden" name="start_date" value={startDate} />
                <input type="hidden" name="end_date" value={endDate} />
                <button
                  type="submit"
                  disabled={!pubLines.length || sumCents(pubLines) <= 0}
                  className="rounded-lg border border-violet-500/60 px-3 py-1.5 text-sm font-semibold text-violet-100 disabled:opacity-40"
                >
                  Créer facture
                </button>
              </form>
            </div>
            {ledgerError && <p className="mt-2 text-sm text-rose-300">{ledgerError}</p>}
            <div className="mt-4 max-h-72 overflow-auto rounded-lg border border-slate-800">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-slate-900 text-slate-500">
                  <tr>
                    <th className="px-2 py-2">Date</th>
                    <th className="px-2 py-2 text-right">Montant</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-slate-300">
                  {pubLines.map((l) => (
                    <tr key={l.id}>
                      <td className="px-2 py-1.5">{new Date(l.occurred_at).toLocaleString('fr-FR')}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{euros(l.amount_cents)}</td>
                    </tr>
                  ))}
                  {!pubLines.length && (
                    <tr>
                      <td colSpan={2} className="px-2 py-6 text-center text-slate-500">
                        Aucune ligne publication.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-xl border border-slate-700 bg-slate-900/50 p-5">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="text-lg font-semibold text-white">B. Commissions</h2>
                <p className="text-sm text-slate-500">
                  Total : <span className="font-mono text-violet-200">{euros(sumCents(comLines))}</span>
                </p>
              </div>
              <form action={createCommissionPeriodInvoice}>
                <input type="hidden" name="organizer_id" value={organizerId} />
                <input type="hidden" name="start_date" value={startDate} />
                <input type="hidden" name="end_date" value={endDate} />
                <button
                  type="submit"
                  disabled={!comLines.length || sumCents(comLines) <= 0}
                  className="rounded-lg border border-violet-500/60 px-3 py-1.5 text-sm font-semibold text-violet-100 disabled:opacity-40"
                >
                  Créer facture
                </button>
              </form>
            </div>
            <div className="mt-4 max-h-72 overflow-auto rounded-lg border border-slate-800">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-slate-900 text-slate-500">
                  <tr>
                    <th className="px-2 py-2">Date</th>
                    <th className="px-2 py-2">Canal</th>
                    <th className="px-2 py-2 text-right">Montant</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-slate-300">
                  {comLines.map((l) => (
                    <tr key={l.id}>
                      <td className="px-2 py-1.5">{new Date(l.occurred_at).toLocaleString('fr-FR')}</td>
                      <td className="px-2 py-1.5">{l.channel}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{euros(l.amount_cents)}</td>
                    </tr>
                  ))}
                  {!comLines.length && (
                    <tr>
                      <td colSpan={3} className="px-2 py-6 text-center text-slate-500">
                        Aucune ligne commission.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

    </div>
  );
}
