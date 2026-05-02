import Link from 'next/link';
import OrganizerPageHeader from '@/components/organisme/OrganizerPageHeader';
import { requireOrganizerPageAccess } from '@/lib/organizer-backoffice-access.server';
import { mockRequests, mockSessions, mockStages, mockStays } from '@/lib/mocks';
import { withOrganizerQuery } from '@/lib/organizers.server';

type PageProps = {
  searchParams?: Promise<{
    organizerId?: string | string[];
  }>;
};

export default async function OrganizerRequestsPage({ searchParams }: PageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const { selectedOrganizerId } = await requireOrganizerPageAccess({
    requestedOrganizerId: resolvedSearchParams?.organizerId,
    requiredSection: 'reservations'
  });
  const useMock = process.env.MOCK_UI === '1';
  const requests = useMock
    ? mockRequests.map((request) => ({
        ...request,
        stay: mockStays.find((s) => s.id === request.stayId),
        session: mockSessions.find((s) => s.id === request.sessionId),
        currentStage: mockStages.find((s) => s.id === request.currentStageId),
        partnerTenant: { name: 'CSE Horizon' }
      }))
    : [];

  return (
    <div className="space-y-6">
      <OrganizerPageHeader
        title="Réservations"
        subtitle="Suivez les demandes et priorisez les sessions à traiter."
      />
      <div className="organizer-table-shell">
        <div className="overflow-x-auto">
          <table className="organizer-table min-w-[680px]">
            <thead>
              <tr>
                <th className="px-4 py-3">Séjour</th>
                <th className="px-4 py-3">Session</th>
                <th className="px-4 py-3">Partenaire</th>
                <th className="px-4 py-3">Statut</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((request) => (
                <tr key={request.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 font-medium text-slate-900">{request.stay?.title ?? '-'}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {request.session?.startDate.toLocaleDateString('fr-FR')}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{request.partnerTenant?.name}</td>
                  <td className="px-4 py-3 text-slate-600">{request.currentStage?.label}</td>
                </tr>
              ))}
              {requests.length === 0 && (
                <tr>
                  <td className="px-4 py-8 text-slate-500" colSpan={4}>
                    <p>Aucune demande pour le moment.</p>
                    <p className="mt-2 text-sm">
                      <Link
                        href={withOrganizerQuery('/organisme/sejours', selectedOrganizerId)}
                        className="font-semibold text-emerald-700 underline"
                      >
                        Vérifier les séjours publiés
                      </Link>
                    </p>
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
