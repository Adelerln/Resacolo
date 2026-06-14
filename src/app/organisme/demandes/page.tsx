import Link from 'next/link';
import OrganizerPageHeader from '@/components/organisme/OrganizerPageHeader';
import { formatInquiryContact } from '@/lib/inquiries';
import { INQUIRY_SOURCE_MNEMOS_TRANSFER, formatInquiryStatusLabel, inquiryStatusBadgeClassName } from '@/lib/inquiry-options';
import { requireOrganizerPageAccess } from '@/lib/organizer-backoffice-access.server';
import { formatMnemosInquiryType } from '@/lib/mnemos-display';
import { withOrganizerQuery } from '@/lib/organizers.server';
import { getServerSupabaseClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type PageProps = {
  searchParams?: Promise<{
    organizerId?: string | string[];
    saved?: string;
    error?: string;
  }>;
};

export default async function OrganizerInquiriesPage({ searchParams }: PageProps) {
  const sp = searchParams ? await searchParams : {};
  const { selectedOrganizerId } = await requireOrganizerPageAccess({
    requestedOrganizerId: sp.organizerId,
    requiredSection: 'inquiries'
  });

  const supabase = getServerSupabaseClient();
  const { data: rows, error } = await supabase
    .from('inquiries')
    .select('*')
    .eq('organizer_id', selectedOrganizerId)
    .eq('source', INQUIRY_SOURCE_MNEMOS_TRANSFER)
    .order('updated_at', { ascending: false })
    .limit(200);

  const listHref = withOrganizerQuery('/organisme/demandes', selectedOrganizerId);

  return (
    <div className="space-y-6">
      <OrganizerPageHeader
        title="Demandes transférées"
        subtitle="Demandes de renseignements redirigées par Mnemos vers votre organisme. Visibles pour tous les comptes de l'équipe."
      />

      {sp.saved === '1' && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          Demande enregistrée.
        </div>
      )}
      {sp.error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
          {decodeURIComponent(sp.error)}
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
          {error.message}
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-[800px] w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Reçue le</th>
                <th className="px-4 py-3">Statut</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Contact</th>
                <th className="px-4 py-3">Sujet</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(rows ?? []).map((row) => {
                const contact = formatInquiryContact(row);
                const detailHref = withOrganizerQuery(`/organisme/demandes/${row.id}`, selectedOrganizerId);
                const statusLabel = formatInquiryStatusLabel(row.status);

                return (
                  <tr key={row.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-600">
                      {new Date(row.created_at).toLocaleString('fr-FR')}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${inquiryStatusBadgeClassName(row.status)}`}
                      >
                        {statusLabel}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {formatMnemosInquiryType(row.inquiry_type)}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {contact.name ? `${contact.name} · ` : ''}
                      {contact.email || '—'}
                    </td>
                    <td className="max-w-[220px] truncate px-4 py-3 text-slate-600">
                      {row.subject ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      <Link href={detailHref} className="text-sm font-semibold text-violet-700 hover:text-violet-900">
                        Traiter
                      </Link>
                    </td>
                  </tr>
                );
              })}
              {!rows?.length && !error && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-slate-500">
                    Aucune demande transférée par Mnemos pour le moment.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-slate-500">
        <Link href={listHref} className="text-violet-700 hover:text-violet-900">
          Actualiser la liste
        </Link>
      </p>
    </div>
  );
}
