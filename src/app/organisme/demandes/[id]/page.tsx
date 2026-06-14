import Link from 'next/link';
import { notFound } from 'next/navigation';
import OrganizerPageHeader from '@/components/organisme/OrganizerPageHeader';
import { formatInquiryContact } from '@/lib/inquiries';
import {
  canOrganizerMarkInquiryResolved,
  formatInquiryStatusLabel,
  inquiryStatusBadgeClassName,
  INQUIRY_SOURCE_MNEMOS_TRANSFER,
  ORGANIZER_INQUIRY_STATUS_VALUE
} from '@/lib/inquiry-options';
import { requireOrganizerPageAccess } from '@/lib/organizer-backoffice-access.server';
import { formatMnemosInquiryType } from '@/lib/mnemos-display';
import { withOrganizerQuery } from '@/lib/organizers.server';
import { getServerSupabaseClient } from '@/lib/supabase/server';
import { updateOrganizerInquiry } from '../actions';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{
    organizerId?: string | string[];
    saved?: string;
    error?: string;
  }>;
};

export default async function OrganizerInquiryDetailPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const sp = searchParams ? await searchParams : {};
  const { selectedOrganizerId } = await requireOrganizerPageAccess({
    requestedOrganizerId: sp.organizerId,
    requiredSection: 'inquiries'
  });

  const supabase = getServerSupabaseClient();
  const { data: row, error } = await supabase
    .from('inquiries')
    .select('*')
    .eq('id', id)
    .eq('organizer_id', selectedOrganizerId)
    .eq('source', INQUIRY_SOURCE_MNEMOS_TRANSFER)
    .maybeSingle();

  if (error || !row) {
    notFound();
  }

  const contact = formatInquiryContact(row);
  const listHref = withOrganizerQuery('/organisme/demandes', selectedOrganizerId);
  const canMarkResolved = canOrganizerMarkInquiryResolved(row.status);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href={listHref} className="text-sm font-medium text-violet-700 hover:text-violet-900">
        ← Retour aux demandes
      </Link>

      {sp.saved === '1' && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          Demande marquée comme résolue.
        </div>
      )}
      {sp.error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
          {decodeURIComponent(sp.error)}
        </div>
      )}

      <OrganizerPageHeader
        title="Demande transférée"
        subtitle={`Reçue le ${new Date(row.created_at).toLocaleString('fr-FR')} · ${formatMnemosInquiryType(row.inquiry_type)}`}
      />

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Message</h2>
        <dl className="mt-4 space-y-3 text-sm">
          <div>
            <dt className="text-slate-500">Contact</dt>
            <dd className="text-slate-900">
              {contact.name ?? '—'} · {contact.email || '—'}
              {contact.phone ? ` · ${contact.phone}` : ''}
            </dd>
          </div>
          {row.subject ? (
            <div>
              <dt className="text-slate-500">Sujet</dt>
              <dd className="text-slate-900">{row.subject}</dd>
            </div>
          ) : null}
          <div>
            <dt className="text-slate-500">Message</dt>
            <dd className="whitespace-pre-wrap text-slate-800">{row.message}</dd>
          </div>
        </dl>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Traitement</h2>
        <p className="mt-3 text-sm text-slate-700">
          Statut actuel :{' '}
          <span
            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${inquiryStatusBadgeClassName(row.status)}`}
          >
            {formatInquiryStatusLabel(row.status)}
          </span>
        </p>

        {canMarkResolved ? (
          <form action={updateOrganizerInquiry} className="mt-4">
            <input type="hidden" name="id" value={row.id} />
            <input type="hidden" name="organizer_id" value={selectedOrganizerId} />
            <input type="hidden" name="status" value={ORGANIZER_INQUIRY_STATUS_VALUE} />
            <button
              type="submit"
              className="rounded-lg bg-violet-700 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-800"
            >
              Marquer comme résolu
            </button>
          </form>
        ) : row.status === ORGANIZER_INQUIRY_STATUS_VALUE ? (
          <p className="mt-3 text-sm text-slate-500">
            Mnemos pourra clôturer la demande une fois le traitement confirmé.
          </p>
        ) : (
          <p className="mt-3 text-sm text-slate-500">Cette demande est clôturée.</p>
        )}
      </section>
    </div>
  );
}
