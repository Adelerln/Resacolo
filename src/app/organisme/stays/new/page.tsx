import { redirect } from 'next/navigation';
import { requireRole } from '@/lib/auth/require';
import { getServerSupabaseClient } from '@/lib/supabase/server';

export default async function NewStayPage() {
  const session = requireRole('ORGANISATEUR');
  const organizerTenantId = session.tenantId;
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

  async function createStay(formData: FormData) {
    'use server';
    if (!organizerTenantId) {
      redirect('/organisme/sejours');
    }
    const seasonId = String(formData.get('season_id') ?? '');
    if (!seasonId) {
      redirect('/organisme/sejours');
    }

    redirect('/organisme/sejours');
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-slate-900">Nouveau séjour</h1>
      <form action={createStay} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6">
        <label className="block text-sm font-medium text-slate-700">
          Titre
          <input name="title" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" required />
        </label>
        <label className="block text-sm font-medium text-slate-700">
          Saison
          <select name="season_id" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" required>
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
