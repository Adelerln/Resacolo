import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireRole } from '@/lib/auth/require';
import { getServerSupabaseClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function euros(cents: number | null | undefined) {
  const n = Number(cents ?? 0);
  return (n / 100).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });
}

type PageProps = { params: Promise<{ id: string }> };

export default async function MnemosOrganizerDetailPage({ params }: PageProps) {
  await requireRole('ADMIN');
  const { id } = await params;
  const supabase = getServerSupabaseClient();

  const [{ data: org }, { data: overview }, { data: billing }, { data: invoices }, { data: events }] =
    await Promise.all([
      supabase.from('organizers').select('*').eq('id', id).maybeSingle(),
      supabase.from('organizer_admin_overview').select('*').eq('id', id).maybeSingle(),
      supabase.from('organizer_billing_settings').select('*').eq('organizer_id', id).maybeSingle(),
      supabase
        .from('invoices')
        .select('id, number, year, invoice_type, status, total_cents, issued_at, created_at')
        .eq('organizer_id', id)
        .order('created_at', { ascending: false })
        .limit(40),
      supabase
        .from('organizer_billing_events')
        .select('id, created_at, event_type, invoice_id, metadata')
        .eq('organizer_id', id)
        .order('created_at', { ascending: false })
        .limit(50)
    ]);

  if (!org) {
    notFound();
  }

  const invoiceIds = (invoices ?? []).map((i) => i.id);
  const { data: lines } = invoiceIds.length
    ? await supabase.from('invoice_lines').select('*').in('invoice_id', invoiceIds)
    : { data: [] as { id: string; invoice_id: string; label: string; amount_cents: number }[] };

  const linesByInvoice = new Map<string, typeof lines>();
  for (const line of lines ?? []) {
    const list = linesByInvoice.get(line.invoice_id) ?? [];
    list.push(line);
    linesByInvoice.set(line.invoice_id, list);
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link
            href="/mnemos/organizers"
            className="text-xs font-medium text-violet-400 hover:text-violet-200"
          >
            ← Organismes
          </Link>
          <h1 className="mt-2 text-2xl font-semibold text-white">{org.name}</h1>
          <p className="mt-1 text-sm text-slate-400">{org.slug ?? org.id}</p>
        </div>
        <Link
          href={`/mnemos/billing?organizer_id=${encodeURIComponent(id)}`}
          className="inline-flex shrink-0 items-center justify-center rounded-lg border border-violet-500/70 bg-violet-950/50 px-4 py-2 text-sm font-semibold text-violet-100 hover:border-violet-400"
        >
          Facturation période
        </Link>
      </div>

      <section className="rounded-xl border border-slate-700 bg-slate-900/50 p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Informations organisme</h2>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-slate-500">Email contact</dt>
            <dd className="text-slate-200">{org.contact_email ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Site web</dt>
            <dd className="text-slate-200">{org.website_url ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Membre fondateur</dt>
            <dd className="text-slate-200">{org.is_founding_member ? 'Oui' : 'Non'}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Membre ResaColo</dt>
            <dd className="text-slate-200">{org.is_resacolo_member ? 'Oui' : 'Non'}</dd>
          </div>
        </dl>
      </section>

      <section className="rounded-xl border border-slate-700 bg-slate-900/50 p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Paramètres de facturation</h2>
        {billing ? (
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-slate-500">Commission</dt>
              <dd className="text-slate-200">{Number(billing.commission_percent)} %</dd>
            </div>
            <div>
              <dt className="text-slate-500">Forfait publication</dt>
              <dd className="text-slate-200">{euros(billing.publication_fee_cents)}</dd>
            </div>
            {billing.notes ? (
              <div className="sm:col-span-2">
                <dt className="text-slate-500">Notes</dt>
                <dd className="whitespace-pre-wrap text-slate-300">{billing.notes}</dd>
              </div>
            ) : null}
          </dl>
        ) : (
          <p className="mt-3 text-sm text-slate-500">Aucune ligne dans organizer_billing_settings.</p>
        )}
      </section>

      <section className="rounded-xl border border-slate-700 bg-slate-900/50 p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Indicateurs</h2>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-slate-500">Séjours publiés</dt>
            <dd className="text-xl font-semibold text-white">{overview?.published_stays_count ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Ventes (lignes)</dt>
            <dd className="text-xl font-semibold text-white">{overview?.sales_count ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Séjours (tous statuts)</dt>
            <dd className="text-xl font-semibold text-white">{overview?.stays_count ?? '—'}</dd>
          </div>
        </dl>
      </section>

      <section className="rounded-xl border border-slate-700 bg-slate-900/50 p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Historique de facturation</h2>
        <p className="mt-1 text-xs text-slate-500">Factures émises et événements liés (V1).</p>

        <h3 className="mt-6 text-xs font-semibold text-slate-400">Factures</h3>
        <div className="mt-2 overflow-x-auto rounded-lg border border-slate-800">
          <table className="min-w-[640px] w-full text-left text-sm">
            <thead className="bg-slate-900 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2">N°</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Statut</th>
                <th className="px-3 py-2 text-right">Total</th>
                <th className="px-3 py-2">Émission</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {(invoices ?? []).map((inv) => (
                <tr key={inv.id}>
                  <td className="px-3 py-2 tabular-nums text-slate-200">
                    {inv.year}-{String(inv.number).padStart(4, '0')}
                  </td>
                  <td className="px-3 py-2 text-slate-300">{inv.invoice_type}</td>
                  <td className="px-3 py-2">
                    <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs text-slate-300">
                      {inv.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-slate-200">{euros(inv.total_cents)}</td>
                  <td className="px-3 py-2 text-xs text-slate-500">
                    {inv.issued_at ? new Date(inv.issued_at).toLocaleString('fr-FR') : '—'}
                  </td>
                </tr>
              ))}
              {!(invoices ?? []).length && (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-slate-500">
                    Aucune facture.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {(invoices ?? []).map((inv) => {
          const invLines = linesByInvoice.get(inv.id) ?? [];
          if (!invLines.length) return null;
          return (
            <div key={`lines-${inv.id}`} className="mt-4">
              <p className="text-xs font-medium text-slate-500">
                Lignes — {inv.year}-{String(inv.number).padStart(4, '0')}
              </p>
              <ul className="mt-1 space-y-1 text-xs text-slate-400">
                {invLines.map((l) => (
                  <li key={l.id} className="flex justify-between gap-2 border-b border-slate-800/80 py-1">
                    <span className="min-w-0 flex-1 truncate">{l.label}</span>
                    <span className="shrink-0 tabular-nums">{euros(l.amount_cents)}</span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}

        <h3 className="mt-8 text-xs font-semibold text-slate-400">Événements billing</h3>
        <ul className="mt-2 space-y-2 text-sm">
          {(events ?? []).map((ev) => (
            <li
              key={ev.id}
              className="flex flex-wrap items-baseline justify-between gap-2 rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2"
            >
              <span className="font-medium text-violet-200">{ev.event_type}</span>
              <span className="text-xs text-slate-500">{new Date(ev.created_at).toLocaleString('fr-FR')}</span>
              {ev.invoice_id ? (
                <span className="w-full text-xs text-slate-500">Facture : {ev.invoice_id}</span>
              ) : null}
            </li>
          ))}
          {!(events ?? []).length && (
            <li className="text-slate-500">Aucun événement (table organizer_billing_events ou vide).</li>
          )}
        </ul>
      </section>
    </div>
  );
}
