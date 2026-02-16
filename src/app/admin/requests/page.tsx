import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { requireRole } from '@/lib/auth/require';
import { RequestPipelineService } from '@/lib/domain/services/requestPipelineService';

export default async function AdminRequestsPage() {
  requireRole('ADMIN');
  const requests = await prisma.request.findMany({
    include: { stay: true, session: true, currentStage: true, partnerTenant: true },
    orderBy: { createdAt: 'desc' }
  });

  const stages = await new RequestPipelineService().listStages('GLOBAL');

  async function updateStage(formData: FormData) {
    'use server';
    const requestId = String(formData.get('requestId'));
    const stageId = String(formData.get('stageId'));
    if (!requestId || !stageId) return;
    const pipeline = new RequestPipelineService();
    await pipeline.setStage(requestId, stageId);
    redirect('/admin/requests');
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-slate-900">Toutes les demandes</h1>
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Sejour</th>
              <th className="px-4 py-3">Session</th>
              <th className="px-4 py-3">Partenaire</th>
              <th className="px-4 py-3">Statut</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {requests.map((request) => (
              <tr key={request.id} className="border-t border-slate-100">
                <td className="px-4 py-3 font-medium text-slate-900">{request.stay.title}</td>
                <td className="px-4 py-3 text-slate-600">
                  {request.session.startDate.toLocaleDateString('fr-FR')}
                </td>
                <td className="px-4 py-3 text-slate-600">{request.partnerTenant?.name}</td>
                <td className="px-4 py-3 text-slate-600">{request.currentStage?.label}</td>
                <td className="px-4 py-3 text-right">
                  <form action={updateStage} className="flex items-center justify-end gap-2">
                    <input type="hidden" name="requestId" value={request.id} />
                    <select name="stageId" defaultValue={request.currentStageId} className="rounded border border-slate-200 px-2 py-1 text-xs">
                      {stages.map((stage) => (
                        <option key={stage.id} value={stage.id}>
                          {stage.label}
                        </option>
                      ))}
                    </select>
                    <button className="rounded bg-emerald-600 px-2 py-1 text-xs font-semibold text-white">
                      OK
                    </button>
                  </form>
                </td>
              </tr>
            ))}
            {requests.length === 0 && (
              <tr>
                <td className="px-4 py-6 text-slate-500" colSpan={5}>
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
