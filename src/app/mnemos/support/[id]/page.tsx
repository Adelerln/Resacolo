import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireRole } from '@/lib/auth/require';
import { isMissingPublicTableError } from '@/lib/mnemos/supabase-table-missing';
import { getServerSupabaseClient } from '@/lib/supabase/server';
import { addSupportMessage, updateSupportTicket } from '../actions';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ saved?: string; err?: string }>;
};

export default async function MnemosSupportDetailPage({ params, searchParams }: PageProps) {
  await requireRole('ADMIN');
  const { id } = await params;
  const sp = searchParams ? await searchParams : {};
  const supabase = getServerSupabaseClient();

  const { data: ticket, error } = await supabase
    .from('organizer_support_requests')
    .select(
      `
      *,
      organizers ( id, name )
    `
    )
    .eq('id', id)
    .maybeSingle();

  if (error && isMissingPublicTableError(error)) {
    return (
      <div className="rounded-lg border border-amber-800/50 bg-amber-950/30 p-6 text-sm text-amber-100">
        Tables support absentes. Appliquez{' '}
        <code className="rounded bg-black/30 px-1">sql/20260416_mnemos_internal_tables.sql</code>.
      </div>
    );
  }
  if (error || !ticket) {
    notFound();
  }

  const { data: messages } = await supabase
    .from('support_request_messages')
    .select('*')
    .eq('support_request_id', id)
    .order('created_at', { ascending: true });

  const { data: staff } = await supabase.from('staff_users').select('user_id, role').order('role');

  const org = ticket.organizers as { id: string; name: string } | null;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href="/mnemos/support" className="text-xs font-medium text-violet-400 hover:text-violet-200">
        ← Tickets
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
        <h1 className="text-2xl font-semibold text-white">{ticket.subject ?? 'Ticket support'}</h1>
        <p className="mt-1 text-sm text-slate-400">{org?.name ?? ticket.organizer_id}</p>
        <p className="text-xs text-slate-600">{ticket.id}</p>
      </div>

      {ticket.body ? (
        <section className="rounded-xl border border-slate-700 bg-slate-900/50 p-5">
          <h2 className="text-sm font-semibold text-slate-400">Description initiale</h2>
          <p className="mt-2 whitespace-pre-wrap text-sm text-slate-300">{ticket.body}</p>
        </section>
      ) : null}

      <section className="rounded-xl border border-slate-700 bg-slate-900/50 p-5">
        <h2 className="text-sm font-semibold text-slate-400">Paramètres ticket</h2>
        <form action={updateSupportTicket} className="mt-4 grid gap-3 sm:grid-cols-2">
          <input type="hidden" name="id" value={ticket.id} />
          <label className="block text-sm text-slate-300 sm:col-span-2">
            Sujet
            <input
              name="subject"
              defaultValue={ticket.subject ?? ''}
              className="mt-1 block w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-white"
            />
          </label>
          <label className="block text-sm text-slate-300">
            Statut
            <input
              name="status"
              defaultValue={ticket.status}
              className="mt-1 block w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-white"
            />
          </label>
          <label className="block text-sm text-slate-300">
            Priorité
            <input
              name="priority"
              defaultValue={ticket.priority}
              className="mt-1 block w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-white"
            />
          </label>
          <label className="block text-sm text-slate-300 sm:col-span-2">
            Catégorie
            <input
              name="category"
              defaultValue={ticket.category ?? ''}
              className="mt-1 block w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-white"
            />
          </label>
          <label className="block text-sm text-slate-300 sm:col-span-2">
            Assigné à (user_id)
            <select
              name="assigned_to_user_id"
              defaultValue={ticket.assigned_to_user_id ?? ''}
              className="mt-1 block w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-white"
            >
              <option value="">— Non assigné —</option>
              {(staff ?? []).map((s) => (
                <option key={s.user_id} value={s.user_id}>
                  {s.user_id} ({s.role})
                </option>
              ))}
            </select>
          </label>
          <div className="sm:col-span-2">
            <button
              type="submit"
              className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500"
            >
              Mettre à jour le ticket
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-xl border border-slate-700 bg-slate-900/50 p-5">
        <h2 className="text-sm font-semibold text-slate-400">Fil de discussion</h2>
        <ul className="mt-4 space-y-3">
          {(messages ?? []).map((m) => (
            <li
              key={m.id}
              className={`rounded-lg border px-3 py-2 text-sm ${
                m.is_internal ? 'border-amber-800/50 bg-amber-950/20 text-amber-100' : 'border-slate-700 bg-slate-950/50 text-slate-300'
              }`}
            >
              <div className="flex flex-wrap justify-between gap-1 text-xs text-slate-500">
                <span>{m.author_user_id}</span>
                <span>{new Date(m.created_at).toLocaleString('fr-FR')}</span>
                {m.is_internal ? <span className="text-amber-400">Interne</span> : null}
              </div>
              <p className="mt-1 whitespace-pre-wrap">{m.body}</p>
            </li>
          ))}
          {!(messages ?? []).length && (
            <li className="text-sm text-slate-500">Aucun message pour l’instant.</li>
          )}
        </ul>

        <form action={addSupportMessage} className="mt-6 space-y-3 border-t border-slate-800 pt-4">
          <input type="hidden" name="id" value={ticket.id} />
          <label className="block text-sm text-slate-300">
            Réponse / note
            <textarea
              name="body"
              rows={4}
              required
              className="mt-1 block w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-white"
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-400">
            <input type="checkbox" name="is_internal" value="1" className="rounded border-slate-600" />
            Note interne uniquement (Mnemos)
          </label>
          <button
            type="submit"
            className="rounded-lg border border-violet-500/60 px-4 py-2 text-sm font-semibold text-violet-100 hover:bg-violet-950/50"
          >
            Ajouter le message
          </button>
        </form>
      </section>
    </div>
  );
}
