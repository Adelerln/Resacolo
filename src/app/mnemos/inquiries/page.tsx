import Link from 'next/link';
import { requireRole } from '@/lib/auth/require';
import { isMissingPublicTableError } from '@/lib/mnemos/supabase-table-missing';
import { MnemosFieldLabel } from '@/components/mnemos/MnemosFieldLabel';
import { formatInquiryContact } from '@/lib/inquiries';
import { formatMnemosInquiryType, formatMnemosStatus } from '@/lib/mnemos-display';
import { getServerSupabaseClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type Sp = {
  status?: string;
  inquiry_type?: string;
  from?: string;
  to?: string;
};

export default async function MnemosInquiriesPage({ searchParams }: { searchParams?: Promise<Sp> }) {
  await requireRole('MNEMOS');
  const sp = searchParams ? await searchParams : {};
  const supabase = getServerSupabaseClient();

  let q = supabase.from('inquiries').select('*').order('created_at', { ascending: false });
  if (sp.status?.trim()) {
    q = q.eq('status', sp.status.trim());
  }
  if (sp.inquiry_type?.trim()) {
    q = q.eq('inquiry_type', sp.inquiry_type.trim());
  }
  if (sp.from?.trim()) {
    q = q.gte('created_at', new Date(`${sp.from}T00:00:00.000Z`).toISOString());
  }
  if (sp.to?.trim()) {
    q = q.lt('created_at', new Date(`${sp.to}T23:59:59.999Z`).toISOString());
  }

  const { data: rows, error } = await q.limit(200);
  const tableMissing = error && isMissingPublicTableError(error);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Demandes de renseignements</h1>
        <p className="mt-1 text-sm text-slate-400">
          Messages reçus via le formulaire de contact public et les transferts depuis l&apos;assistant en ligne.
        </p>
      </div>

      {tableMissing && (
        <div className="rounded-lg border border-amber-800/50 bg-amber-950/30 px-4 py-3 text-sm text-amber-100">
          La table des demandes est absente. Appliquez la migration Mnemos sur Supabase.
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
          <input
            name="status"
            defaultValue={sp.status ?? ''}
            placeholder="Filtrer…"
            className="mt-1 block rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-white"
          />
        </label>
        <label className="text-sm text-slate-300">
          <MnemosFieldLabel>Type</MnemosFieldLabel>
          <input
            name="inquiry_type"
            defaultValue={sp.inquiry_type ?? ''}
            className="mt-1 block rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-white"
          />
        </label>
        <label className="text-sm text-slate-300">
          <MnemosFieldLabel>Du</MnemosFieldLabel>
          <input
            type="date"
            name="from"
            defaultValue={sp.from ?? ''}
            className="mt-1 block rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-white"
          />
        </label>
        <label className="text-sm text-slate-300">
          <MnemosFieldLabel>Au</MnemosFieldLabel>
          <input
            type="date"
            name="to"
            defaultValue={sp.to ?? ''}
            className="mt-1 block rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-white"
          />
        </label>
        <button
          type="submit"
          className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500"
        >
          Filtrer
        </button>
      </form>

      <div className="overflow-hidden rounded-xl border border-slate-700 bg-slate-900/50">
        <div className="overflow-x-auto">
          <table className="min-w-[900px] w-full text-left text-sm">
            <thead className="border-b border-slate-700 bg-slate-900 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Statut</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Contact</th>
                <th className="px-3 py-2">Sujet</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {(rows ?? []).map((r) => {
                const contact = formatInquiryContact(r);
                return (
                <tr key={r.id} className="hover:bg-slate-800/30">
                  <td className="px-3 py-2 text-xs text-slate-400">
                    {new Date(r.created_at).toLocaleString('fr-FR')}
                  </td>
                  <td className="px-3 py-2">
                    <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs text-violet-200">
                      {formatMnemosStatus(r.status)}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-slate-300">{formatMnemosInquiryType(r.inquiry_type)}</td>
                  <td className="px-3 py-2 text-slate-300">
                    {contact.name ? `${contact.name} · ` : ''}
                    {contact.email || '—'}
                  </td>
                  <td className="max-w-[220px] truncate px-3 py-2 text-slate-400">{r.subject ?? '—'}</td>
                  <td className="px-3 py-2">
                    <Link
                      href={`/mnemos/inquiries/${r.id}`}
                      className="text-xs font-semibold text-violet-300 hover:text-white"
                    >
                      Ouvrir
                    </Link>
                  </td>
                </tr>
              );
              })}
              {!rows?.length && !error && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-slate-500">
                    Aucune demande pour le moment.
                    <span className="mt-2 block text-xs text-slate-600">
                      Les tickets des organismes sont dans{' '}
                      <Link href="/mnemos/support" className="text-violet-400 underline hover:text-violet-200">
                        Assistance organismes
                      </Link>
                      .
                    </span>
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
