import { prisma } from '@/lib/db';
import { requireRole } from '@/lib/auth/require';

export default async function PartnerRequestsPage() {
  const session = requireRole('PARTENAIRE');
  const partnerTenantId = session.tenantId;

  const requests = partnerTenantId
    ? await prisma.request.findMany({
        where: { partnerTenantId },
        include: { stay: true, session: true, currentStage: true },
        orderBy: { createdAt: 'desc' }
      })
    : [];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-slate-900">Mes demandes</h1>
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Sejour</th>
              <th className="px-4 py-3">Session</th>
              <th className="px-4 py-3">Statut</th>
            </tr>
          </thead>
          <tbody>
            {requests.map((request) => (
              <tr key={request.id} className="border-t border-slate-100">
                <td className="px-4 py-3 font-medium text-slate-900">{request.stay.title}</td>
                <td className="px-4 py-3 text-slate-600">
                  {request.session.startDate.toLocaleDateString('fr-FR')}
                </td>
                <td className="px-4 py-3 text-slate-600">{request.currentStage?.label}</td>
              </tr>
            ))}
            {requests.length === 0 && (
              <tr>
                <td className="px-4 py-6 text-slate-500" colSpan={3}>
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
