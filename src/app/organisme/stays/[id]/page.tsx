import { redirect } from 'next/navigation';
import { requireRole } from '@/lib/auth/require';
import { mockRequests, mockSeasons, mockSessions, mockStages, mockStays } from '@/lib/mocks';
import { sessionStatusLabel, stayStatusLabel } from '@/lib/ui/labels';
import { getServerSupabaseClient } from '@/lib/supabase/server';
import { getMockImageUrl, mockImages } from '@/lib/mockImages';

type PageProps = { params: { id: string } };

export default async function OrganizerStayDetailPage({ params }: PageProps) {
  const session = requireRole('ORGANISATEUR');
  const useMock = process.env.MOCK_UI === '1';
  const stay = useMock ? mockStays.find((item) => item.id === params.id) : null;
  const supabase = getServerSupabaseClient();
  const { data: seasonsRaw } = await supabase.from('seasons').select('id,name');
  const seasonOrder = ['Hiver', 'Printemps', 'Été', 'Automne', "Fin d'année"];
  const seasons = [...(seasonsRaw ?? [])].sort((a, b) => {
    const indexA = seasonOrder.indexOf(a.name);
    const indexB = seasonOrder.indexOf(b.name);
    if (indexA === -1 && indexB === -1) {
      return a.name.localeCompare(b.name, 'fr');
    }
    if (indexA === -1) return 1;
    if (indexB === -1) return -1;
    return indexA - indexB;
  });
  const photoUrls = useMock
    ? [
        getMockImageUrl(mockImages.sampleStays[0], 1200, 80),
        getMockImageUrl(mockImages.sampleStays[1], 1200, 80),
        ''
      ]
    : ['', '', ''];
  const transportOptions = useMock
    ? {
        bus: true,
        train: true,
        plane: false,
        byOwn: true,
        meetingPoint: 'Gare de Lyon, Paris',
        notes: 'Transferts inclus depuis la gare.'
      }
    : { bus: false, train: false, plane: false, byOwn: false, meetingPoint: '', notes: '' };
  const contentSections = useMock
    ? {
        tagline: 'Une aventure nature pour les 12-16 ans.',
        program: 'Randonnées, escalade, veillées.',
        lodging: 'Chalets en montagne, chambres de 4.',
        meals: 'Pension complète, cuisine locale.',
        supervision: '1 animateur pour 6 jeunes.'
      }
    : { tagline: '', program: '', lodging: '', meals: '', supervision: '' };

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

  async function updateStay() {
    'use server';
    redirect(`/organisme/stays/${params.id}`);
  }

  async function updateMedia() {
    'use server';
    redirect(`/organisme/stays/${params.id}`);
  }

  async function updateContent() {
    'use server';
    redirect(`/organisme/stays/${params.id}`);
  }

  async function updateTransport() {
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
          Saison
          <select
            name="season_id"
            defaultValue={stay.seasonId}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
          >
            <option value="">Sélectionner</option>
            {(seasons ?? []).map((season) => (
              <option key={season.id} value={season.id}>
                {season.name}
              </option>
            ))}
          </select>
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

      <div className="grid gap-6 lg:grid-cols-3">
        <form action={updateMedia} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-slate-900">Photos</h2>
          <p className="text-sm text-slate-500">Ajoute des URLs d’images (3 max).</p>
          <div className="space-y-3">
            {photoUrls.map((url, index) => (
              <label key={`photo-${index}`} className="block text-sm font-medium text-slate-700">
                Photo {index + 1}
                <input
                  name={`photo_${index + 1}`}
                  defaultValue={url}
                  placeholder="https://"
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                />
              </label>
            ))}
          </div>
          <button className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white">
            Enregistrer
          </button>
        </form>

        <form action={updateContent} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-slate-900">Textes</h2>
          <label className="block text-sm font-medium text-slate-700">
            Accroche
            <textarea
              name="tagline"
              defaultValue={contentSections.tagline}
              rows={2}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Programme
            <textarea
              name="program"
              defaultValue={contentSections.program}
              rows={3}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Hébergement
            <textarea
              name="lodging"
              defaultValue={contentSections.lodging}
              rows={3}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Restauration
            <textarea
              name="meals"
              defaultValue={contentSections.meals}
              rows={3}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Encadrement
            <textarea
              name="supervision"
              defaultValue={contentSections.supervision}
              rows={2}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            />
          </label>
          <button className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white">
            Enregistrer
          </button>
        </form>

        <form action={updateTransport} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-slate-900">Transports</h2>
          <div className="space-y-2 text-sm text-slate-700">
            <label className="flex items-center gap-2">
              <input type="checkbox" name="bus" defaultChecked={transportOptions.bus} />
              Bus
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" name="train" defaultChecked={transportOptions.train} />
              Train
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" name="plane" defaultChecked={transportOptions.plane} />
              Avion
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" name="byOwn" defaultChecked={transportOptions.byOwn} />
              Trajet par vos propres moyens
            </label>
          </div>
          <label className="block text-sm font-medium text-slate-700">
            Point de rendez-vous
            <input
              name="meetingPoint"
              defaultValue={transportOptions.meetingPoint}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Notes complémentaires
            <textarea
              name="transportNotes"
              defaultValue={transportOptions.notes}
              rows={3}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            />
          </label>
          <button className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white">
            Enregistrer
          </button>
        </form>
      </div>

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
