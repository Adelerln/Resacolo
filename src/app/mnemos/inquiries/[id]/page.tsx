import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireRole } from '@/lib/auth/require';
import { isMissingPublicTableError } from '@/lib/mnemos/supabase-table-missing';
import { MnemosDt, MnemosFieldLabel } from '@/components/mnemos/MnemosFieldLabel';
import { formatInquiryContact } from '@/lib/inquiries';
import {
  INQUIRY_STATUS_LABELS,
  INQUIRY_STATUS_VALUES,
  INQUIRY_TYPE_LABELS,
  INQUIRY_TYPE_VALUES,
  isMnemosTransferredInquiry,
  normalizeInquiryTypeValue
} from '@/lib/inquiry-options';
import { loadMnemosInternalAssignees } from '@/lib/mnemos/inquiry-assignees.server';
import { formatMnemosInquirySource } from '@/lib/mnemos-display';
import { getServerSupabaseClient } from '@/lib/supabase/server';
import { updateInquiry } from '../actions';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ saved?: string; err?: string }>;
};

export default async function MnemosInquiryDetailPage({ params, searchParams }: PageProps) {
  await requireRole('MNEMOS');
  const { id } = await params;
  const sp = searchParams ? await searchParams : {};
  const supabase = getServerSupabaseClient();

  const { data: row, error } = await supabase.from('inquiries').select('*').eq('id', id).maybeSingle();
  if (error && isMissingPublicTableError(error)) {
    return (
      <div className="rounded-lg border border-amber-800/50 bg-amber-950/30 p-6 text-sm text-amber-100">
        La table des demandes est absente. Appliquez la migration Mnemos sur Supabase.
      </div>
    );
  }
  if (error || !row) {
    notFound();
  }

  const [{ data: organizers }, internalAssignees] = await Promise.all([
    supabase.from('organizers').select('id, name').order('name'),
    loadMnemosInternalAssignees(supabase)
  ]);
  const contact = formatInquiryContact(row);
  const transferredOrganizerId =
    isMnemosTransferredInquiry(row.source) && row.organizer_id ? row.organizer_id : '';
  const inquiryType = normalizeInquiryTypeValue(row.inquiry_type);

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
            <MnemosDt className="text-slate-500">Contact</MnemosDt>
            <dd className="text-slate-200">
              {contact.name ?? '—'} · {contact.email || '—'}
              {contact.phone ? ` · ${contact.phone}` : ''}
            </dd>
          </div>
          {row.subject ? (
            <div>
              <MnemosDt className="text-slate-500">Sujet</MnemosDt>
              <dd className="text-slate-200">{row.subject}</dd>
            </div>
          ) : null}
          <div>
            <MnemosDt className="text-slate-500">Message</MnemosDt>
            <dd className="whitespace-pre-wrap text-slate-300">{row.message}</dd>
          </div>
        </dl>
      </section>

      <section className="rounded-xl border border-slate-700 bg-slate-900/50 p-5">
        <h2 className="text-sm font-semibold text-slate-400">Traitement interne</h2>
        <p className="mt-1 text-xs text-slate-500">
          Assignez un membre Mnemos ou transférez la demande à un organisateur. Un transfert la rend visible
          pour tous les comptes de l&apos;organisme concerné.
        </p>
        <p className="mt-2 text-sm text-slate-400">
          Origine : <span className="text-slate-200">{formatMnemosInquirySource(row.source)}</span>
        </p>
        <form action={updateInquiry} className="mt-4 space-y-4">
          <input type="hidden" name="id" value={row.id} />
          <label className="block text-sm text-slate-300">
            <MnemosFieldLabel>Statut</MnemosFieldLabel>
            <select
              name="status"
              defaultValue={row.status}
              className="mt-1 block w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-white"
            >
              {INQUIRY_STATUS_VALUES.map((value) => (
                <option key={value} value={value}>
                  {INQUIRY_STATUS_LABELS[value]}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm text-slate-300">
            <MnemosFieldLabel>Type</MnemosFieldLabel>
            <select
              name="inquiry_type"
              defaultValue={inquiryType}
              className="mt-1 block w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-white"
            >
              {INQUIRY_TYPE_VALUES.map((value) => (
                <option key={value} value={value}>
                  {INQUIRY_TYPE_LABELS[value]}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm text-slate-300">
            <MnemosFieldLabel>Assigné à (équipe interne)</MnemosFieldLabel>
            <select
              name="assigned_to_user_id"
              defaultValue={row.assigned_to_user_id ?? ''}
              className="mt-1 block w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-white"
            >
              <option value="">— Non assigné —</option>
              {internalAssignees.map((assignee) => (
                <option key={assignee.userId} value={assignee.userId}>
                  {assignee.displayLabel}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm text-slate-300">
            <MnemosFieldLabel>Transférer à l&apos;organisme</MnemosFieldLabel>
            <select
              name="transfer_organizer_id"
              defaultValue={transferredOrganizerId}
              className="mt-1 block w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-white"
            >
              <option value="">— Ne pas transférer —</option>
              {(organizers ?? []).map((organizer) => (
                <option key={organizer.id} value={organizer.id}>
                  {organizer.name}
                </option>
              ))}
            </select>
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
