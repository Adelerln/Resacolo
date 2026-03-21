import { redirect } from 'next/navigation';
import { requireRole } from '@/lib/auth/require';
import { resolveOrganizerSelection, withOrganizerQuery } from '@/lib/organizers';
import { getServerSupabaseClient } from '@/lib/supabase/server';

type PageProps = {
  searchParams?: {
    organizerId?: string | string[];
  };
};

export default async function NewStayPage({ searchParams }: PageProps) {
  const session = requireRole('ORGANISATEUR');
  const supabase = getServerSupabaseClient();
  const { selectedOrganizer, selectedOrganizerId } = await resolveOrganizerSelection(
    searchParams?.organizerId,
    session.tenantId ?? null
  );
  const organizerTenantId = selectedOrganizerId;
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
    const supabase = getServerSupabaseClient();
    if (!organizerTenantId) {
      redirect('/organisme/sejours');
    }
    const seasonId = String(formData.get('season_id') ?? '');
    if (!seasonId) {
      redirect(withOrganizerQuery('/organisme/sejours', organizerTenantId));
    }
    const title = String(formData.get('title') ?? '').trim();
    const description = String(formData.get('description') ?? '').trim();
    const ageMinRaw = String(formData.get('ageMin') ?? '').trim();
    const ageMaxRaw = String(formData.get('ageMax') ?? '').trim();
    const location = String(formData.get('location') ?? '').trim();
    const status = String(formData.get('status') ?? 'PUBLISHED').trim();

    const ageMin = ageMinRaw ? Number(ageMinRaw) : null;
    const ageMax = ageMaxRaw ? Number(ageMaxRaw) : null;

    if (!title) {
      redirect(withOrganizerQuery('/organisme/sejours/new', organizerTenantId));
    }

    const { data: insertedStay } = await supabase
      .from('stays')
      .insert({
        organizer_id: organizerTenantId,
        season_id: seasonId,
        title,
        description: description || null,
        age_min: Number.isFinite(ageMin) ? ageMin : null,
        age_max: Number.isFinite(ageMax) ? ageMax : null,
        location_text: location || null,
        transport_mode: 'Sans transport',
        status: status === 'DRAFT' || status === 'HIDDEN' || status === 'ARCHIVED' ? status : 'PUBLISHED'
      })
      .select('id')
      .single();

    redirect(withOrganizerQuery(`/organisme/sejours/${insertedStay?.id ?? ''}`, organizerTenantId));
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Nouveau séjour</h1>
        <p className="text-sm text-slate-600">
          {selectedOrganizer
            ? `Création d'un séjour pour ${selectedOrganizer.name}.`
            : 'Création d’un séjour.'}
        </p>
      </div>
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
        <label className="block text-sm font-medium text-slate-700">
          Statut
          <select
            name="status"
            defaultValue="PUBLISHED"
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
          >
            <option value="PUBLISHED">Publié</option>
            <option value="DRAFT">Brouillon</option>
            <option value="HIDDEN">Masqué</option>
            <option value="ARCHIVED">Archivé</option>
          </select>
        </label>
        <button className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white">
          Creer
        </button>
      </form>
    </div>
  );
}
