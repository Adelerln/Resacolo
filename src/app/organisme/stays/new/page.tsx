import { redirect } from 'next/navigation';
import { requireRole } from '@/lib/auth/require';
import GoogleMapsCityInput from '@/components/common/GoogleMapsCityInput';
import { resolveOrganizerSelection, withOrganizerQuery } from '@/lib/organizers';
import { normalizeStayCategories, STAY_CATEGORY_OPTIONS } from '@/lib/stay-categories';
import { getStayAgeBounds, parseStayAges, STAY_AGE_OPTIONS } from '@/lib/stay-ages';
import { isMissingRegionTextColumnError, normalizeStayRegion, STAY_REGION_OPTIONS } from '@/lib/stay-regions';
import { getServerSupabaseClient } from '@/lib/supabase/server';
import type { Database } from '@/types/supabase';

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
    const selectedAges = parseStayAges(formData);
    const categories = normalizeStayCategories(
      formData
        .getAll('categories')
        .map((value) => String(value).trim())
        .filter(Boolean)
    );
    const { ages, ageMin, ageMax } = getStayAgeBounds(selectedAges);
    const location = String(formData.get('location') ?? '').trim();
    const region = normalizeStayRegion(formData.get('region_text'));
    const status = String(formData.get('status') ?? 'PUBLISHED').trim();
    const transportMode = String(formData.get('transport_mode') ?? 'Sans transport').trim();
    const normalizedStatus: Database['public']['Enums']['stay_status'] =
      status === 'DRAFT' || status === 'HIDDEN' || status === 'ARCHIVED' ? status : 'PUBLISHED';

    if (!title) {
      redirect(withOrganizerQuery('/organisme/sejours/new', organizerTenantId));
    }

    const basePayload: Database['public']['Tables']['stays']['Insert'] = {
      organizer_id: organizerTenantId,
      season_id: seasonId,
      title,
      description: description || null,
      categories,
      ages,
      age_min: ageMin,
      age_max: ageMax,
      location_text: location || null,
      transport_mode:
        transportMode === 'Aller/Retour similaire' ||
        transportMode === 'Aller/Retour différencié' ||
        transportMode === 'Sans transport'
          ? transportMode
          : 'Sans transport',
      status: normalizedStatus
    };

    const payloadWithRegion = region ? { ...basePayload, region_text: region } : basePayload;

    let insertedStay: { id: string } | null = null;
    let insertError: { message: string } | null = null;

    const firstAttempt = await supabase.from('stays').insert(payloadWithRegion).select('id').single();
    insertedStay = firstAttempt.data;
    insertError = firstAttempt.error;

    if (insertError && isMissingRegionTextColumnError(insertError.message)) {
      const fallbackAttempt = await supabase.from('stays').insert(basePayload).select('id').single();
      insertedStay = fallbackAttempt.data;
      insertError = fallbackAttempt.error;
    }

    if (insertError || !insertedStay) {
      console.error('Erreur Supabase (create stay)', insertError?.message ?? 'unknown');
      redirect(withOrganizerQuery('/organisme/sejours/new', organizerTenantId));
    }

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
        <div className="space-y-3">
          <div>
            <div className="text-sm font-medium text-slate-700">Catégories du séjour</div>
            <p className="mt-1 text-xs text-slate-500">Tu peux en sélectionner plusieurs.</p>
          </div>
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {STAY_CATEGORY_OPTIONS.map((category) => (
              <label
                key={category.value}
                className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700"
              >
                <input type="checkbox" name="categories" value={category.value} className="cursor-pointer" />
                <span>{category.label}</span>
              </label>
            ))}
          </div>
        </div>
        <div className="space-y-3">
          <div>
            <div className="text-sm font-medium text-slate-700">Âges</div>
            <p className="mt-1 text-xs text-slate-500">Coche les âges proposés.</p>
          </div>
          <div className="grid grid-cols-4 gap-2 md:grid-cols-6 lg:grid-cols-8">
            {STAY_AGE_OPTIONS.map((age) => (
              <label
                key={age}
                className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700"
              >
                <input type="checkbox" name="ages" value={age} className="cursor-pointer" />
                <span>{age} ans</span>
              </label>
            ))}
          </div>
        </div>
        <GoogleMapsCityInput name="location" label="Ville du séjour" />
        <label className="block text-sm font-medium text-slate-700">
          Région du séjour
          <select name="region_text" defaultValue="" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2">
            <option value="">Sélectionner</option>
            {STAY_REGION_OPTIONS.map((region) => (
              <option key={region} value={region}>
                {region}
              </option>
            ))}
          </select>
          <span className="mt-1 block text-xs text-slate-500">Choisir “Étranger” si le séjour se déroule hors de France.</span>
        </label>
        <label className="block text-sm font-medium text-slate-700">
          Mode de transport
          <select
            name="transport_mode"
            defaultValue="Sans transport"
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
          >
            <option value="Aller/Retour similaire">Aller/Retour similaire</option>
            <option value="Aller/Retour différencié">Aller/Retour différencié</option>
            <option value="Sans transport">Sans transport</option>
          </select>
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
