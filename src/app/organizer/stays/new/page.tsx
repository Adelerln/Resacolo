import { redirect } from 'next/navigation';
import { requireRole } from '@/lib/auth/require';
import { mockSeasons } from '@/lib/mocks';

export default async function NewStayPage() {
  const session = requireRole('ORGANISATEUR');
  const organizerTenantId = session.tenantId;
  const useMock = process.env.MOCK_UI === '1';
  const seasons = useMock ? mockSeasons : [];

  async function createStay(formData: FormData) {
    'use server';
    const title = String(formData.get('title') ?? '');
    const seasonId = String(formData.get('seasonId') ?? '');
    const description = String(formData.get('description') ?? '');
    const ageMin = Number(formData.get('ageMin') ?? 0);
    const ageMax = Number(formData.get('ageMax') ?? 0);
    const location = String(formData.get('location') ?? '');

    if (!organizerTenantId) {
      redirect('/organizer/stays');
    }

    redirect('/organizer/stays');
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-slate-900">Nouveau sejour</h1>
      <form action={createStay} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6">
        <label className="block text-sm font-medium text-slate-700">
          Titre
          <input name="title" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" required />
        </label>
        <label className="block text-sm font-medium text-slate-700">
          Saison
          <select name="seasonId" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" required>
            <option value="">Selectionner</option>
            {seasons.map((season) => (
              <option key={season.id} value={season.id}>
                {season.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-medium text-slate-700">
          Description
          <textarea name="description" rows={4} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" />
        </label>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block text-sm font-medium text-slate-700">
            Age min
            <input name="ageMin" type="number" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Age max
            <input name="ageMax" type="number" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" />
          </label>
        </div>
        <label className="block text-sm font-medium text-slate-700">
          Lieu
          <input name="location" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" />
        </label>
        <button className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white">
          Creer
        </button>
      </form>
    </div>
  );
}
