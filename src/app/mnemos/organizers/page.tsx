import Link from 'next/link';
import { requireRole } from '@/lib/auth/require';
import { isMissingPublicTableError } from '@/lib/mnemos/supabase-table-missing';
import { getServerSupabaseClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function euros(cents: number | null | undefined) {
  const n = Number(cents ?? 0);
  return (n / 100).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });
}

export default async function MnemosOrganizersPage() {
  await requireRole('ADMIN');
  const supabase = getServerSupabaseClient();

  const { data: rows, error } = await supabase
    .from('organizer_admin_overview')
    .select('*')
    .order('name', { ascending: true });

  const viewMissing = error && isMissingPublicTableError(error);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Organismes</h1>
        <p className="mt-1 text-sm text-slate-400">
          Vue consolidée (profil, facturation indicative, séjours publiés, ventes).
        </p>
      </div>

      {error && !viewMissing && (
        <div className="rounded-lg border border-rose-700/50 bg-rose-950/40 px-4 py-3 text-sm text-rose-100">
          {error.message}
        </div>
      )}

      {viewMissing && (
        <div className="rounded-lg border border-amber-700/50 bg-amber-950/30 px-4 py-3 text-sm text-amber-100">
          La vue <code className="rounded bg-black/30 px-1">organizer_admin_overview</code> est introuvable côté
          Supabase. Créez-la en base (agrégation organizers + billing + compteurs) ou régénérez les types depuis le
          projet à jour.
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-700 bg-slate-900/60">
        <div className="overflow-x-auto">
          <table className="min-w-[1100px] w-full text-left text-sm">
            <thead className="border-b border-slate-700 bg-slate-900 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-3">Organisme</th>
                <th className="px-3 py-3">Contact</th>
                <th className="px-3 py-3">Fondateur</th>
                <th className="px-3 py-3">Membre ResaColo</th>
                <th className="px-3 py-3 text-right">Commission %</th>
                <th className="px-3 py-3 text-right">Forfait pub.</th>
                <th className="px-3 py-3 text-right">Séjours publiés</th>
                <th className="px-3 py-3 text-right">Ventes</th>
                <th className="px-3 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {(rows ?? []).map((o) => (
                <tr key={o.id} className="hover:bg-slate-800/40">
                  <td className="px-3 py-2.5 font-medium text-slate-100">{o.name}</td>
                  <td className="px-3 py-2.5 text-slate-400">{o.contact_email ?? '—'}</td>
                  <td className="px-3 py-2.5 text-slate-300">{o.is_founding_member ? 'Oui' : 'Non'}</td>
                  <td className="px-3 py-2.5 text-slate-300">{o.is_resacolo_member ? 'Oui' : 'Non'}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-slate-300">
                    {o.commission_percent != null ? `${Number(o.commission_percent)} %` : '—'}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-slate-300">
                    {o.publication_fee_cents != null ? euros(o.publication_fee_cents) : '—'}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-slate-300">
                    {o.published_stays_count ?? '—'}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-slate-300">{o.sales_count ?? '—'}</td>
                  <td className="px-3 py-2.5">
                    <Link
                      href={`/mnemos/organizers/${o.id}`}
                      className="inline-flex rounded-lg border border-violet-600/60 px-2.5 py-1 text-xs font-semibold text-violet-200 transition hover:border-violet-400 hover:text-white"
                    >
                      Voir la fiche
                    </Link>
                  </td>
                </tr>
              ))}
              {!rows?.length && !error && (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-slate-500">
                    Aucun organisateur.
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
