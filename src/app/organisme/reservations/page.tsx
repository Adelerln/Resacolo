import { requireRole } from '@/lib/auth/require';
import { resolveOrganizerSelection } from '@/lib/organizers.server';
import { mockRequests, mockSessions, mockStages, mockStays } from '@/lib/mocks';

type PageProps = {
  searchParams?: {
    organizerId?: string | string[];
  };
};

export default async function OrganizerRequestsPage({ searchParams }: PageProps) {
  const session = requireRole('ORGANISATEUR');
  const { selectedOrganizer } = await resolveOrganizerSelection(
    searchParams?.organizerId,
    session.tenantId ?? null
  );
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
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Réservations</h1>
        <p className="text-sm text-slate-600">
          {selectedOrganizer
            ? `Affichage du contexte ${selectedOrganizer.name}.`
            : 'Affichage des réservations.'}
        </p>
      </div>
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
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
                <td className="px-4 py-6 text-slate-500" colSpan={4}>
                  Aucune demande.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
