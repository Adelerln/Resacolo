import OrganizerPageHeader from '@/components/organisme/OrganizerPageHeader';
import { formatMnemosStatus } from '@/lib/mnemos-display';
import { requireOrganizerPageAccess } from '@/lib/organizer-backoffice-access.server';
import { withOrganizerQuery } from '@/lib/organizers.server';
import { getServerSupabaseClient } from '@/lib/supabase/server';
import { createOrganizerSupportRequest } from './actions';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type PageProps = {
  searchParams?: Promise<{
    organizerId?: string | string[];
    saved?: string;
    error?: string;
  }>;
};

const CATEGORY_LABELS: Record<string, string> = {
  technique: 'Technique / bug',
  catalogue: 'Catalogue / séjours',
  reservations: 'Réservations / paiements',
  facturation: 'Facturation',
  autre: 'Autre'
};

export default async function OrganizerAssistancePage({ searchParams }: PageProps) {
  const sp = searchParams ? await searchParams : {};
  const { selectedOrganizerId } = await requireOrganizerPageAccess({
    requestedOrganizerId: sp.organizerId,
    requiredSection: 'support'
  });

  const supabase = getServerSupabaseClient();
  const { data: rows, error } = await supabase
    .from('organizer_support_requests')
    .select('id, created_at, updated_at, status, priority, category, subject')
    .eq('organizer_id', selectedOrganizerId)
    .order('updated_at', { ascending: false })
    .limit(50);

  const listHref = withOrganizerQuery('/organisme/assistance', selectedOrganizerId);

  return (
    <div className="space-y-6">
      <OrganizerPageHeader
        title="Assistance technique"
        subtitle="Contactez l’équipe Resacolo pour un problème technique, catalogue, réservation ou facturation. Les demandes apparaissent aussi côté Mnemos."
      />

      {sp.saved === '1' ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          Demande envoyée. L’équipe Resacolo a été notifiée.
        </div>
      ) : null}
      {sp.error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
          {decodeURIComponent(sp.error)}
        </div>
      ) : null}
      {error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
          {error.message}
        </div>
      ) : null}

      <form
        action={createOrganizerSupportRequest}
        className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
      >
        <input type="hidden" name="organizer_id" value={selectedOrganizerId} />
        <h2 className="text-base font-semibold text-slate-900">Nouvelle demande</h2>
        <label className="block text-sm font-medium text-slate-700">
          Catégorie
          <select
            name="category"
            defaultValue="technique"
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900"
          >
            {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-medium text-slate-700">
          Sujet
          <input
            name="subject"
            required
            maxLength={200}
            placeholder="Ex. Impossible de publier un séjour"
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900"
          />
        </label>
        <label className="block text-sm font-medium text-slate-700">
          Description
          <textarea
            name="body"
            required
            rows={6}
            maxLength={8000}
            placeholder="Décrivez le problème, les étapes pour le reproduire, et le séjour ou la réservation concernée si besoin."
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900"
          />
        </label>
        <button
          type="submit"
          className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600"
        >
          Envoyer la demande
        </button>
      </form>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-3">
          <h2 className="text-base font-semibold text-slate-900">Vos demandes</h2>
          <p className="text-sm text-slate-500">
            <a href={listHref} className="sr-only">
              Actualiser
            </a>
            Historique pour cet organisme.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-2">Date</th>
                <th className="px-4 py-2">Statut</th>
                <th className="px-4 py-2">Catégorie</th>
                <th className="px-4 py-2">Sujet</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(rows ?? []).map((row) => (
                <tr key={row.id}>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-500">
                    {new Date(row.created_at).toLocaleString('fr-FR')}
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                      {formatMnemosStatus(row.status)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {CATEGORY_LABELS[row.category ?? ''] ?? row.category ?? '—'}
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-900">{row.subject ?? '—'}</td>
                </tr>
              ))}
              {!rows?.length && !error ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                    Aucune demande pour le moment.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
