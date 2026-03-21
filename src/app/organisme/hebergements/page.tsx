import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import SavedToast from '@/components/common/SavedToast';
import { requireRole } from '@/lib/auth/require';
import { resolveOrganizerSelection, withOrganizerQuery } from '@/lib/organizers';
import { getServerSupabaseClient } from '@/lib/supabase/server';
import { slugify } from '@/lib/utils';

type PageProps = {
  searchParams?: {
    organizerId?: string | string[];
    saved?: string | string[];
    error?: string | string[];
  };
};

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const ACCOMMODATION_TYPE_OPTIONS = [
  'centre',
  'auberge de jeunesse',
  'camping',
  "famille d'accueil",
  'mixte'
] as const;

export default async function OrganizerAccommodationsPage({ searchParams }: PageProps) {
  const session = requireRole('ORGANISATEUR');
  const supabase = getServerSupabaseClient();
  const { selectedOrganizer, selectedOrganizerId } = await resolveOrganizerSelection(
    searchParams?.organizerId,
    session.tenantId ?? null
  );
  const savedParam = Array.isArray(searchParams?.saved) ? searchParams?.saved[0] : searchParams?.saved;
  const errorParam = Array.isArray(searchParams?.error) ? searchParams?.error[0] : searchParams?.error;
  const showSavedBanner = savedParam === '1';

  if (!selectedOrganizerId) {
    redirect('/organisme/sejours');
  }

  const [{ data: accommodationsRaw }, { data: stayLinksRaw }, { data: staysRaw }, { data: mediaRaw }] = await Promise.all([
    supabase
      .from('accommodations')
      .select(
        'id,name,accommodation_type,description,capacity_total,room_count,bed_info,bathroom_info,indoor_features,outdoor_features,medical_proximity,catering_info,accessibility_info,status,updated_at'
      )
      .eq('organizer_id', selectedOrganizerId)
      .order('name', { ascending: true }),
    supabase.from('stay_accommodations').select('accommodation_id,stay_id'),
    supabase.from('stays').select('id,title,organizer_id').eq('organizer_id', selectedOrganizerId),
    supabase.from('accommodation_media').select('accommodation_id,id').order('position', { ascending: true })
  ]);

  const stays = staysRaw ?? [];
  const allowedStayIds = new Set(stays.map((stay) => stay.id));
  const linkedStayTitlesByAccommodationId = new Map<string, string[]>();
  const mediaCountByAccommodationId = new Map<string, number>();

  for (const link of stayLinksRaw ?? []) {
    if (!allowedStayIds.has(link.stay_id)) continue;
    const stayTitle = stays.find((stay) => stay.id === link.stay_id)?.title;
    if (!stayTitle) continue;
    const titles = linkedStayTitlesByAccommodationId.get(link.accommodation_id) ?? [];
    titles.push(stayTitle);
    linkedStayTitlesByAccommodationId.set(link.accommodation_id, titles);
  }

  for (const media of mediaRaw ?? []) {
    const count = mediaCountByAccommodationId.get(media.accommodation_id) ?? 0;
    mediaCountByAccommodationId.set(media.accommodation_id, count + 1);
  }

  const accommodations = (accommodationsRaw ?? []).map((accommodation) => ({
    ...accommodation,
    linkedStayTitles: linkedStayTitlesByAccommodationId.get(accommodation.id) ?? [],
    mediaCount: mediaCountByAccommodationId.get(accommodation.id) ?? 0
  }));

  async function createAccommodation(formData: FormData) {
    'use server';
    const supabase = getServerSupabaseClient();
    const name = String(formData.get('name') ?? '').trim();
    const accommodationType = String(formData.get('accommodation_type') ?? '').trim();

    if (!name || !accommodationType) {
      redirect(withOrganizerQuery('/organisme/hebergements?error=missing-required-fields', selectedOrganizerId));
    }

    const now = new Date().toISOString();
    const { error } = await supabase.from('accommodations').insert({
      organizer_id: selectedOrganizerId,
      name,
      accommodation_type: accommodationType,
      description: String(formData.get('description') ?? '').trim() || null,
      capacity_total: Number(formData.get('capacity_total') ?? 0) || null,
      room_count: Number(formData.get('room_count') ?? 0) || null,
      bed_info: String(formData.get('bed_info') ?? '').trim() || null,
      bathroom_info: String(formData.get('bathroom_info') ?? '').trim() || null,
      indoor_features: String(formData.get('indoor_features') ?? '').trim() || null,
      outdoor_features: String(formData.get('outdoor_features') ?? '').trim() || null,
      medical_proximity: String(formData.get('medical_proximity') ?? '').trim() || null,
      catering_info: String(formData.get('catering_info') ?? '').trim() || null,
      accessibility_info: String(formData.get('accessibility_info') ?? '').trim() || null,
      slug: slugify(name),
      ai_extracted_data: null,
      status: 'DRAFT',
      validated_at: null,
      validated_by_user_id: null,
      created_at: now,
      updated_at: now
    });

    if (error) {
      console.error('Erreur Supabase (create accommodation)', error.message);
      redirect(withOrganizerQuery(`/organisme/hebergements?error=${encodeURIComponent(error.message)}`, selectedOrganizerId));
    }

    revalidatePath('/organisme/hebergements');
    revalidatePath('/organisme/sejours');
    revalidatePath('/organisme/stays');
    redirect(withOrganizerQuery('/organisme/hebergements?saved=1', selectedOrganizerId));
  }

  async function updateAccommodation(formData: FormData) {
    'use server';
    const supabase = getServerSupabaseClient();
    const accommodationId = String(formData.get('accommodation_id') ?? '').trim();
    const name = String(formData.get('name') ?? '').trim();
    const accommodationType = String(formData.get('accommodation_type') ?? '').trim();

    if (!accommodationId || !name || !accommodationType) {
      redirect(withOrganizerQuery('/organisme/hebergements?error=missing-fields', selectedOrganizerId));
    }

    const { error } = await supabase
      .from('accommodations')
      .update({
        name,
        accommodation_type: accommodationType,
        description: String(formData.get('description') ?? '').trim() || null,
        capacity_total: Number(formData.get('capacity_total') ?? 0) || null,
        room_count: Number(formData.get('room_count') ?? 0) || null,
        bed_info: String(formData.get('bed_info') ?? '').trim() || null,
        bathroom_info: String(formData.get('bathroom_info') ?? '').trim() || null,
        indoor_features: String(formData.get('indoor_features') ?? '').trim() || null,
        outdoor_features: String(formData.get('outdoor_features') ?? '').trim() || null,
        medical_proximity: String(formData.get('medical_proximity') ?? '').trim() || null,
        catering_info: String(formData.get('catering_info') ?? '').trim() || null,
        accessibility_info: String(formData.get('accessibility_info') ?? '').trim() || null,
        slug: slugify(name),
        updated_at: new Date().toISOString()
      })
      .eq('id', accommodationId)
      .eq('organizer_id', selectedOrganizerId);

    if (error) {
      console.error('Erreur Supabase (update accommodation)', error.message);
      redirect(withOrganizerQuery(`/organisme/hebergements?error=${encodeURIComponent(error.message)}`, selectedOrganizerId));
    }

    revalidatePath('/organisme/hebergements');
    revalidatePath('/organisme/sejours');
    revalidatePath('/organisme/stays');
    redirect(withOrganizerQuery('/organisme/hebergements?saved=1', selectedOrganizerId));
  }

  return (
    <div className="space-y-6">
      {showSavedBanner && <SavedToast message="La fiche hébergement a bien été enregistrée." />}
      {errorParam && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          Impossible d&apos;enregistrer l&apos;hébergement : {decodeURIComponent(errorParam)}
        </div>
      )}

      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Hébergements</h1>
        <p className="text-sm text-slate-600">
          {selectedOrganizer
            ? `Gestion des hébergements réutilisables pour ${selectedOrganizer.name}.`
            : 'Gestion des hébergements réutilisables.'}
        </p>
      </div>

      <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Ajouter un hébergement</h2>
          <p className="mt-1 text-sm text-slate-600">
            Seuls le nom et le type sont obligatoires. Le reste peut être complété plus tard.
          </p>
        </div>
        <form action={createAccommodation} className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2 grid gap-4 md:grid-cols-2">
            <label className="block text-sm font-medium text-slate-700">
              Nom de l&apos;hébergement
              <input
                name="name"
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                required
              />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Type d&apos;hébergement
              <select
                name="accommodation_type"
                defaultValue=""
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                required
              >
                <option value="">Sélectionner</option>
                {ACCOMMODATION_TYPE_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="block text-sm font-medium text-slate-700 md:col-span-2">
            Description
            <textarea
              name="description"
              rows={3}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            />
          </label>

          <div className="md:col-span-2 rounded-xl border border-slate-100 p-4">
            <h3 className="text-sm font-semibold text-slate-900">Capacité & couchage</h3>
            <div className="mt-3 grid gap-4 md:grid-cols-2">
              <label className="block text-sm font-medium text-slate-700">
                Capacité totale
                <input
                  name="capacity_total"
                  type="number"
                  min="0"
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Nombre de chambres
                <input
                  name="room_count"
                  type="number"
                  min="0"
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                />
              </label>
              <label className="block text-sm font-medium text-slate-700 md:col-span-2">
                Informations couchage
                <textarea
                  name="bed_info"
                  rows={3}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                />
              </label>
            </div>
          </div>

          <div className="md:col-span-2 rounded-xl border border-slate-100 p-4">
            <h3 className="text-sm font-semibold text-slate-900">Sanitaires & confort</h3>
            <div className="mt-3 grid gap-4 md:grid-cols-2">
              <label className="block text-sm font-medium text-slate-700">
                Sanitaires
                <textarea
                  name="bathroom_info"
                  rows={3}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Confort intérieur
                <textarea
                  name="indoor_features"
                  rows={3}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                />
              </label>
            </div>
          </div>

          <div className="md:col-span-2 rounded-xl border border-slate-100 p-4">
            <h3 className="text-sm font-semibold text-slate-900">Extérieurs & environnement</h3>
            <div className="mt-3 grid gap-4 md:grid-cols-2">
              <label className="block text-sm font-medium text-slate-700">
                Espaces extérieurs
                <textarea
                  name="outdoor_features"
                  rows={3}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Proximité médicale
                <textarea
                  name="medical_proximity"
                  rows={3}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                />
              </label>
            </div>
          </div>

          <div className="md:col-span-2 rounded-xl border border-slate-100 p-4">
            <h3 className="text-sm font-semibold text-slate-900">Restauration</h3>
            <label className="mt-3 block text-sm font-medium text-slate-700">
              Informations restauration
              <textarea
                name="catering_info"
                rows={3}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              />
            </label>
          </div>

          <div className="md:col-span-2 rounded-xl border border-slate-100 p-4">
            <h3 className="text-sm font-semibold text-slate-900">Accessibilité</h3>
            <label className="mt-3 block text-sm font-medium text-slate-700">
              Informations accessibilité
              <textarea
                name="accessibility_info"
                rows={3}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              />
            </label>
          </div>

          <div className="md:col-span-2 rounded-xl border border-slate-100 p-4">
            <h3 className="text-sm font-semibold text-slate-900">Médias</h3>
            <p className="mt-2 text-sm text-slate-500">
              Les photos seront rattachées à la fiche une fois l&apos;hébergement créé.
            </p>
          </div>
          <div className="md:col-span-2 flex justify-end">
            <button className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white">
              Créer l&apos;hébergement
            </button>
          </div>
        </form>
      </section>

      <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Hébergements existants</h2>
          <p className="mt-1 text-sm text-slate-600">
            Les modifications faites ici seront visibles depuis les séjours qui utilisent ces fiches.
          </p>
        </div>

        {accommodations.length === 0 ? (
          <p className="text-sm text-slate-500">Aucun hébergement créé pour cet organisateur.</p>
        ) : (
          <div className="space-y-4">
            {accommodations.map((accommodation) => (
              <form
                key={accommodation.id}
                action={updateAccommodation}
                className="grid gap-4 rounded-2xl border border-slate-100 p-4 md:grid-cols-2"
              >
                <input type="hidden" name="accommodation_id" value={accommodation.id} />
                <div className="md:col-span-2 flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-base font-semibold text-slate-900">{accommodation.name}</h3>
                    <p className="text-xs text-slate-500">
                      Mis à jour le {new Date(accommodation.updated_at).toLocaleDateString('fr-FR')}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Type : {accommodation.accommodation_type || 'Non renseigné'} · Statut : {accommodation.status}
                    </p>
                    {accommodation.linkedStayTitles.length > 0 && (
                      <p className="mt-1 text-xs text-slate-500">
                        Utilisé dans : {accommodation.linkedStayTitles.join(', ')}
                      </p>
                    )}
                    <p className="mt-1 text-xs text-slate-500">
                      Médias liés : {accommodation.mediaCount}
                    </p>
                  </div>
                </div>
                <div className="md:col-span-2 grid gap-4 md:grid-cols-2">
                  <label className="block text-sm font-medium text-slate-700">
                    Nom de l&apos;hébergement
                    <input
                      name="name"
                      defaultValue={accommodation.name}
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                      required
                    />
                  </label>
                  <label className="block text-sm font-medium text-slate-700">
                    Type d&apos;hébergement
                    <select
                      name="accommodation_type"
                      defaultValue={accommodation.accommodation_type ?? ''}
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                      required
                    >
                      <option value="">Sélectionner</option>
                      {ACCOMMODATION_TYPE_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <label className="block text-sm font-medium text-slate-700 md:col-span-2">
                  Description
                  <textarea
                    name="description"
                    rows={3}
                    defaultValue={accommodation.description ?? ''}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                  />
                </label>
                <div className="md:col-span-2 rounded-xl border border-slate-100 p-4">
                  <h4 className="text-sm font-semibold text-slate-900">Capacité & couchage</h4>
                  <div className="mt-3 grid gap-4 md:grid-cols-2">
                    <label className="block text-sm font-medium text-slate-700">
                      Capacité totale
                      <input
                        name="capacity_total"
                        type="number"
                        min="0"
                        defaultValue={accommodation.capacity_total ?? ''}
                        className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                      />
                    </label>
                    <label className="block text-sm font-medium text-slate-700">
                      Nombre de chambres
                      <input
                        name="room_count"
                        type="number"
                        min="0"
                        defaultValue={accommodation.room_count ?? ''}
                        className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                      />
                    </label>
                    <label className="block text-sm font-medium text-slate-700 md:col-span-2">
                      Informations couchage
                      <textarea
                        name="bed_info"
                        rows={3}
                        defaultValue={accommodation.bed_info ?? ''}
                        className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                      />
                    </label>
                  </div>
                </div>
                <div className="md:col-span-2 rounded-xl border border-slate-100 p-4">
                  <h4 className="text-sm font-semibold text-slate-900">Sanitaires & confort</h4>
                  <div className="mt-3 grid gap-4 md:grid-cols-2">
                    <label className="block text-sm font-medium text-slate-700">
                      Sanitaires
                      <textarea
                        name="bathroom_info"
                        rows={3}
                        defaultValue={accommodation.bathroom_info ?? ''}
                        className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                      />
                    </label>
                    <label className="block text-sm font-medium text-slate-700">
                      Confort intérieur
                      <textarea
                        name="indoor_features"
                        rows={3}
                        defaultValue={accommodation.indoor_features ?? ''}
                        className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                      />
                    </label>
                  </div>
                </div>
                <div className="md:col-span-2 rounded-xl border border-slate-100 p-4">
                  <h4 className="text-sm font-semibold text-slate-900">Extérieurs & environnement</h4>
                  <div className="mt-3 grid gap-4 md:grid-cols-2">
                    <label className="block text-sm font-medium text-slate-700">
                      Espaces extérieurs
                      <textarea
                        name="outdoor_features"
                        rows={3}
                        defaultValue={accommodation.outdoor_features ?? ''}
                        className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                      />
                    </label>
                    <label className="block text-sm font-medium text-slate-700">
                      Proximité médicale
                      <textarea
                        name="medical_proximity"
                        rows={3}
                        defaultValue={accommodation.medical_proximity ?? ''}
                        className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                      />
                    </label>
                  </div>
                </div>
                <div className="md:col-span-2 rounded-xl border border-slate-100 p-4">
                  <h4 className="text-sm font-semibold text-slate-900">Restauration</h4>
                  <label className="mt-3 block text-sm font-medium text-slate-700">
                    Informations restauration
                    <textarea
                      name="catering_info"
                      rows={3}
                      defaultValue={accommodation.catering_info ?? ''}
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                    />
                  </label>
                </div>
                <div className="md:col-span-2 rounded-xl border border-slate-100 p-4">
                  <h4 className="text-sm font-semibold text-slate-900">Accessibilité</h4>
                  <label className="mt-3 block text-sm font-medium text-slate-700">
                    Informations accessibilité
                    <textarea
                      name="accessibility_info"
                      rows={3}
                      defaultValue={accommodation.accessibility_info ?? ''}
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                    />
                  </label>
                </div>
                <div className="md:col-span-2 flex justify-end">
                  <button className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
                    Enregistrer l&apos;hébergement
                  </button>
                </div>
              </form>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
