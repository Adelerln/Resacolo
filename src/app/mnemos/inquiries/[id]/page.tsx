import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireRole } from '@/lib/auth/require';
import { isMissingPublicTableError } from '@/lib/mnemos/supabase-table-missing';
import { getServerSupabaseClient } from '@/lib/supabase/server';
import { updateInquiry } from '../actions';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ saved?: string; err?: string }>;
};

export default async function MnemosInquiryDetailPage({ params, searchParams }: PageProps) {
  await requireRole('ADMIN');
  const { id } = await params;
  const sp = searchParams ? await searchParams : {};
  const supabase = getServerSupabaseClient();

  const { data: row, error } = await supabase.from('inquiries').select('*').eq('id', id).maybeSingle();
  if (error && isMissingPublicTableError(error)) {
    return (
      <div className="rounded-lg border border-amber-800/50 bg-amber-950/30 p-6 text-sm text-amber-100">
        Table <code className="rounded bg-black/30 px-1">inquiries</code> absente. Appliquez{' '}
        <code className="rounded bg-black/30 px-1">sql/20260416_mnemos_internal_tables.sql</code>.
      </div>
    );
  }
  if (error || !row) {
    notFound();
  }

  const { data: staff } = await supabase.from('staff_users').select('user_id, role').order('role');

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href="/mnemos/inquiries" className="text-xs font-medium text-violet-400 hover:text-violet-200">
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
        <h1 className="text-2xl font-semibold text-white">Demande</h1>
        <p className="text-xs text-slate-500">{row.id}</p>
      </div>

      <section className="rounded-xl border border-slate-700 bg-slate-900/50 p-5">
        <h2 className="text-sm font-semibold text-slate-400">Message initial</h2>
        <dl className="mt-3 space-y-2 text-sm">
          <div>
            <dt className="text-slate-500">Contact</dt>
            <dd className="text-slate-200">
              {row.contact_name ?? '—'} · {row.contact_email}
              {row.contact_phone ? ` · ${row.contact_phone}` : ''}
            </dd>
          </div>
          {row.subject ? (
            <div>
              <dt className="text-slate-500">Sujet</dt>
              <dd className="text-slate-200">{row.subject}</dd>
            </div>
          ) : null}
          <div>
            <dt className="text-slate-500">Message</dt>
            <dd className="whitespace-pre-wrap text-slate-300">{row.message}</dd>
          </div>
        </dl>
      </section>

      <section className="rounded-xl border border-slate-700 bg-slate-900/50 p-5">
        <h2 className="text-sm font-semibold text-slate-400">Traitement interne</h2>
        <form action={updateInquiry} className="mt-4 space-y-4">
          <input type="hidden" name="id" value={row.id} />
          <label className="block text-sm text-slate-300">
            Statut
            <input
              name="status"
              defaultValue={row.status}
              className="mt-1 block w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-white"
            />
          </label>
          <label className="block text-sm text-slate-300">
            Type
            <input
              name="inquiry_type"
              defaultValue={row.inquiry_type}
              className="mt-1 block w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-white"
            />
          </label>
          <label className="block text-sm text-slate-300">
            Assigné à (user_id staff)
            <select
              name="assigned_to_user_id"
              defaultValue={row.assigned_to_user_id ?? ''}
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
          <label className="block text-sm text-slate-300">
            Notes internes
            <textarea
              name="internal_notes"
              rows={5}
              defaultValue={row.internal_notes ?? ''}
              className="mt-1 block w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-white"
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
