import Link from 'next/link';
import { requireRole } from '@/lib/auth/require';
import { isMissingPublicTableError } from '@/lib/mnemos/supabase-table-missing';
import { getServerSupabaseClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type Sp = {
  organizer_id?: string;
  status?: string;
  priority?: string;
  category?: string;
};

export default async function MnemosSupportPage({ searchParams }: { searchParams?: Promise<Sp> }) {
  await requireRole('ADMIN');
  const sp = searchParams ? await searchParams : {};
  const supabase = getServerSupabaseClient();

  let q = supabase
    .from('organizer_support_requests')
    .select(
      `
      id,
      created_at,
      updated_at,
      status,
      priority,
      category,
      subject,
      organizer_id,
      assigned_to_user_id,
      organizers ( name )
    `
    )
    .order('updated_at', { ascending: false });

  if (sp.organizer_id?.trim()) {
    q = q.eq('organizer_id', sp.organizer_id.trim());
  }
  if (sp.status?.trim()) {
    q = q.eq('status', sp.status.trim());
  }
  if (sp.priority?.trim()) {
    q = q.eq('priority', sp.priority.trim());
  }
  if (sp.category?.trim()) {
    q = q.eq('category', sp.category.trim());
  }

  const { data: rows, error } = await q.limit(200);
  const tableMissing = error && isMissingPublicTableError(error);

  const { data: organizers } = await supabase.from('organizers').select('id, name').order('name');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Support organismes</h1>
        <p className="mt-1 text-sm text-slate-400">Tickets, filtres et suivi.</p>
      </div>

      {tableMissing && (
        <div className="rounded-lg border border-amber-800/50 bg-amber-950/30 px-4 py-3 text-sm text-amber-100">
          Tables support absentes. Exécutez{' '}
          <code className="rounded bg-black/30 px-1">sql/20260416_mnemos_internal_tables.sql</code>.
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
          Organisme
          <select
            name="organizer_id"
            defaultValue={sp.organizer_id ?? ''}
            className="mt-1 block min-w-[12rem] rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-white"
          >
            <option value="">Tous</option>
            {(organizers ?? []).map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm text-slate-300">
          Statut
          <input
            name="status"
            defaultValue={sp.status ?? ''}
            className="mt-1 block rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-white"
          />
        </label>
        <label className="text-sm text-slate-300">
          Priorité
          <input
            name="priority"
            defaultValue={sp.priority ?? ''}
            className="mt-1 block rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-white"
          />
        </label>
        <label className="text-sm text-slate-300">
          Catégorie
          <input
            name="category"
            defaultValue={sp.category ?? ''}
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
          <table className="min-w-[960px] w-full text-left text-sm">
            <thead className="border-b border-slate-700 bg-slate-900 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2">Màj</th>
                <th className="px-3 py-2">Organisme</th>
                <th className="px-3 py-2">Statut</th>
                <th className="px-3 py-2">Priorité</th>
                <th className="px-3 py-2">Sujet</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {(rows ?? []).map((r) => {
                const org = r.organizers as { name: string } | { name: string }[] | null;
                const orgName = Array.isArray(org) ? org[0]?.name : org?.name;
                return (
                  <tr key={r.id} className="hover:bg-slate-800/30">
                    <td className="px-3 py-2 text-xs text-slate-400">
                      {new Date(r.updated_at).toLocaleString('fr-FR')}
                    </td>
                    <td className="px-3 py-2 text-slate-200">{orgName ?? r.organizer_id}</td>
                    <td className="px-3 py-2">
                      <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs text-violet-200">
                        {r.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-slate-400">{r.priority}</td>
                    <td className="max-w-[240px] truncate px-3 py-2 text-slate-400">{r.subject ?? '—'}</td>
                    <td className="px-3 py-2">
                      <Link
                        href={`/mnemos/support/${r.id}`}
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
                    Aucun ticket.
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
