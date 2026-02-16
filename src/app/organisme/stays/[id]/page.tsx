import { redirect } from 'next/navigation';
import { requireRole } from '@/lib/auth/require';
import { mockRequests, mockSeasons, mockSessions, mockStages, mockStays } from '@/lib/mocks';
import { sessionStatusLabel, stayStatusLabel } from '@/lib/ui/labels';

type PageProps = { params: { id: string } };

export default async function OrganizerStayDetailPage({ params }: PageProps) {
  const session = requireRole('ORGANISATEUR');
  const useMock = process.env.MOCK_UI === '1';
  const stay = useMock ? mockStays.find((item) => item.id === params.id) : null;

  if (!stay || stay.organizerTenantId !== session.tenantId) {
    redirect('/organisme/stays');
  }

  const stages = useMock ? mockStages : [];
  const staySessions = useMock ? mockSessions.filter((s) => s.stayId === stay.id) : [];
  const stayRequests = useMock
    ? mockRequests
        .filter((r) => r.stayId === stay.id)
        .map((r) => ({
          ...r,
          currentStage: stages.find((s) => s.id === r.currentStageId),
          session: staySessions.find((s) => s.id === r.sessionId),
          partnerTenant: { name: 'CSE Horizon' }
        }))
    : [];

  async function updateStay(formData: FormData) {
    'use server';
    redirect(`/organisme/stays/${params.id}`);
  }

  async function addSession(formData: FormData) {
    'use server';
    const startDate = String(formData.get('startDate') ?? '');
    const endDate = String(formData.get('endDate') ?? '');
    const capacityTotal = Number(formData.get('capacityTotal') ?? 0);
    if (!startDate || !endDate || !capacityTotal) return;
    redirect(`/organisme/stays/${params.id}`);
  }

  async function updateRequestStage(formData: FormData) {
    'use server';
    const requestId = String(formData.get('requestId'));
    const stageId = String(formData.get('stageId'));
    if (!requestId || !stageId) return;
    redirect(`/organisme/stays/${params.id}`);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">{stay.title}</h1>
          <p className="text-sm text-slate-600">
            Saison: {useMock ? mockSeasons.find((s) => s.id === stay.seasonId)?.name : '-'}
          </p>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
          {stayStatusLabel(stay.status)}
        </span>
      </div>

      <form action={updateStay} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-slate-900">Infos séjour</h2>
        <label className="block text-sm font-medium text-slate-700">
          Titre
          <input
            name="title"
            defaultValue={stay.title}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
          />
        </label>
        <label className="block text-sm font-medium text-slate-700">
          Description
          <textarea
            name="description"
            defaultValue={stay.description ?? ''}
            rows={4}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
          />
        </label>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block text-sm font-medium text-slate-700">
            Âge min
            <input
              name="ageMin"
              type="number"
              defaultValue={stay.ageMin ?? ''}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Âge max
            <input
              name="ageMax"
              type="number"
              defaultValue={stay.ageMax ?? ''}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            />
          </label>
        </div>
        <label className="block text-sm font-medium text-slate-700">
          Lieu
          <input
            name="location"
            defaultValue={stay.location ?? ''}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
          />
        </label>
        <button className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white">
          Enregistrer
        </button>
      </form>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-slate-900">Sessions</h2>
          <ul className="space-y-2 text-sm text-slate-600">
            {staySessions.map((sessionItem) => (
              <li key={sessionItem.id} className="flex items-center justify-between">
                <span>
                  {sessionItem.startDate.toLocaleDateString('fr-FR')} -{' '}
                  {sessionItem.endDate.toLocaleDateString('fr-FR')}
                </span>
                <span className="text-xs text-slate-500">
                  {sessionItem.capacityReserved}/{sessionItem.capacityTotal} (
                  {sessionStatusLabel(sessionItem.status)})
                </span>
              </li>
            ))}
            {staySessions.length === 0 && <li>Aucune session.</li>}
          </ul>
          <form action={addSession} className="space-y-3 border-t border-slate-100 pt-4">
            <div className="grid gap-3 md:grid-cols-3">
              <label className="text-xs font-medium text-slate-600">
                Debut
                <input name="startDate" type="date" className="mt-1 w-full rounded border border-slate-200 px-2 py-1" required />
              </label>
              <label className="text-xs font-medium text-slate-600">
                Fin
                <input name="endDate" type="date" className="mt-1 w-full rounded border border-slate-200 px-2 py-1" required />
              </label>
              <label className="text-xs font-medium text-slate-600">
                Capacite
                <input name="capacityTotal" type="number" className="mt-1 w-full rounded border border-slate-200 px-2 py-1" required />
              </label>
            </div>
            <button className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white">
              Ajouter session
            </button>
          </form>
        </div>

        <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-slate-900">Réservations liées</h2>
          <div className="space-y-3 text-sm text-slate-600">
            {stayRequests.map((request) => (
              <div key={request.id} className="rounded-lg border border-slate-100 p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-slate-900">{request.partnerTenant?.name}</div>
                    <div className="text-xs text-slate-500">
                      Session {request.session?.startDate.toLocaleDateString('fr-FR')}
                    </div>
                  </div>
                  <form action={updateRequestStage} className="flex items-center gap-2">
                    <input type="hidden" name="requestId" value={request.id} />
                    <select
                      name="stageId"
                      defaultValue={request.currentStageId}
                      className="rounded border border-slate-200 px-2 py-1 text-xs"
                    >
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
                </div>
              </div>
            ))}
            {stayRequests.length === 0 && <p>Aucune demande.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
