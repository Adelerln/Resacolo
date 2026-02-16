import { redirect } from 'next/navigation';
import { requireRole } from '@/lib/auth/require';
import { mockSeasons, mockSessions, mockStays } from '@/lib/mocks';
import { stayStatusLabel } from '@/lib/ui/labels';

export default async function PartnerCatalogPage({ searchParams }: { searchParams?: { q?: string } }) {
  const session = requireRole('PARTENAIRE');
  const partnerTenantId = session.tenantId;
  const useMock = process.env.MOCK_UI === '1';
  const season = useMock ? mockSeasons[0] : null;

  if (!partnerTenantId || !season) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold text-slate-900">Catalogue</h1>
        <p className="text-sm text-slate-600">Aucun catalogue disponible.</p>
      </div>
    );
  }

  const q = (searchParams?.q ?? '').toLowerCase();
  const stays = useMock ? mockStays.filter((stay) => stay.status === 'PUBLISHED') : [];
  const filtered = q ? stays.filter((stay) => stay.title.toLowerCase().includes(q)) : stays;

  const sessions = useMock ? mockSessions.filter((s) => filtered.some((stay) => stay.id === s.stayId)) : [];

  async function createRequest(formData: FormData) {
    'use server';
    const stayId = String(formData.get('stayId') ?? '');
    const sessionId = String(formData.get('sessionId') ?? '');
    if (!stayId || !sessionId) return;
    redirect('/partenaire/reservations');
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Catalogue</h1>
          <p className="text-sm text-slate-600">Saison {season.name}</p>
        </div>
        <form className="flex items-center gap-2">
          <input
            name="q"
            defaultValue={searchParams?.q ?? ''}
            placeholder="Rechercher"
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
          <button className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white">
            Filtrer
          </button>
        </form>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-slate-900">Sélection de catalogue</h2>
        <p className="mt-1 text-sm text-slate-600">
          Choisissez les séjours, organisateurs et tranches d'âge à exposer.
        </p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="block text-sm font-medium text-slate-700">
            Organisateurs
            <select className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" multiple>
              <option>Alpha Organisateur</option>
              <option>Cap Nature</option>
              <option>Azur Juniors</option>
            </select>
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Tranches d'âge
            <select className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" multiple>
              <option>6-10 ans</option>
              <option>11-13 ans</option>
              <option>14-17 ans</option>
            </select>
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Thématiques
            <select className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" multiple>
              <option>Sport</option>
              <option>Culture</option>
              <option>Nature</option>
            </select>
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Priorité
            <select className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2">
              <option>Par défaut</option>
              <option>Prioriser les nouveautés</option>
              <option>Prioriser les tops ventes</option>
            </select>
          </label>
        </div>
        <button className="mt-4 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white">
          Enregistrer la sélection
        </button>
      </div>

      <div className="space-y-4">
        {filtered.map((stay) => {
          const staySessions = sessions.filter((s) => s.stayId === stay.id);
          return (
            <div key={stay.id} className="rounded-2xl border border-slate-200 bg-white p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">{stay.title}</h2>
                  <p className="text-sm text-slate-600">{stay.location}</p>
                </div>
                <span className="text-xs font-semibold text-slate-500">{stayStatusLabel(stay.status)}</span>
              </div>
              <div className="mt-4 space-y-2 text-sm text-slate-600">
                {staySessions.map((sessionItem) => (
                  <div key={sessionItem.id} className="flex items-center justify-between">
                    <div>
                      {sessionItem.startDate.toLocaleDateString('fr-FR')} -{' '}
                      {sessionItem.endDate.toLocaleDateString('fr-FR')}
                    </div>
                    <form action={createRequest}>
                      <input type="hidden" name="stayId" value={stay.id} />
                      <input type="hidden" name="sessionId" value={sessionItem.id} />
                      <button className="rounded-lg bg-emerald-600 px-3 py-1 text-xs font-semibold text-white">
                        Faire une demande
                      </button>
                    </form>
                  </div>
                ))}
                {staySessions.length === 0 && <p>Aucune session disponible.</p>}
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-sm text-slate-500">
            Aucun séjour dans le catalogue.
          </div>
        )}
      </div>
    </div>
  );
}
