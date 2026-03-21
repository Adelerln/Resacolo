import { revalidatePath } from 'next/cache';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import GoogleMapsCityInput from '@/components/common/GoogleMapsCityInput';
import SavedToast from '@/components/common/SavedToast';
import StayEditorialTabs from '@/components/organisme/StayEditorialTabs';
import { requireRole } from '@/lib/auth/require';
import { resolveOrganizerSelection, withOrganizerQuery } from '@/lib/organizers';
import { formatStayAgeRange, getStayAgeBounds, normalizeStayAges, parseStayAges, STAY_AGE_OPTIONS } from '@/lib/stay-ages';
import { getServerSupabaseClient } from '@/lib/supabase/server';
import { sessionStatusLabel, stayStatusLabel } from '@/lib/ui/labels';

type PageProps = {
  params: { id: string };
  searchParams?: {
    organizerId?: string | string[];
    saved?: string | string[];
    error?: string | string[];
  };
};

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function OrganizerStayDetailPage({ params, searchParams }: PageProps) {
  const session = requireRole('ORGANISATEUR');
  const supabase = getServerSupabaseClient();
  const { selectedOrganizerId } = await resolveOrganizerSelection(
    searchParams?.organizerId,
    session.tenantId ?? null
  );
  const savedParam = Array.isArray(searchParams?.saved) ? searchParams?.saved[0] : searchParams?.saved;
  const errorParam = Array.isArray(searchParams?.error) ? searchParams?.error[0] : searchParams?.error;
  const showSavedBanner = savedParam === '1';

  if (!selectedOrganizerId) {
    redirect('/organisme/sejours');
  }

  const { data: stay } = await supabase
    .from('stays')
    .select(
      'id,title,status,season_id,description,summary,activities_text,program_text,supervision_text,required_documents_text,transport_text,ages,age_min,age_max,location_text,transport_mode,organizer_id'
    )
    .eq('id', params.id)
    .maybeSingle();

  if (!stay || stay.organizer_id !== selectedOrganizerId) {
    redirect(withOrganizerQuery('/organisme/sejours', selectedOrganizerId));
  }
  const currentStay = stay;
  const selectedAges = normalizeStayAges(currentStay.ages, currentStay.age_min, currentStay.age_max);

  const [
    { data: seasonsRaw },
    { data: sessionsRaw },
    { data: mediaRaw },
    { data: accommodationsRaw },
    { data: stayAccommodationLinksRaw }
  ] = await Promise.all([
    supabase.from('seasons').select('id,name').order('name', { ascending: true }),
    supabase
      .from('sessions')
      .select('id,start_date,end_date,capacity_total,capacity_reserved,status')
      .eq('stay_id', currentStay.id)
      .order('start_date', { ascending: true }),
    supabase
      .from('stay_media')
      .select('id,url,position,media_type')
      .eq('stay_id', currentStay.id)
      .order('position', { ascending: true }),
    supabase
      .from('accommodations')
      .select(
        'id,name,accommodation_type,description,capacity_total,room_count,bed_info,bathroom_info,indoor_features,outdoor_features,medical_proximity,catering_info,accessibility_info,status'
      )
      .eq('organizer_id', selectedOrganizerId)
      .order('name', { ascending: true }),
    supabase
      .from('stay_accommodations')
      .select('accommodation_id,position')
      .eq('stay_id', currentStay.id)
      .order('position', { ascending: true })
  ]);

  const seasons = seasonsRaw ?? [];
  const sessions = sessionsRaw ?? [];
  const media = mediaRaw ?? [];
  const accommodations = accommodationsRaw ?? [];
  const stayAccommodationLinks = stayAccommodationLinksRaw ?? [];
  const linkedAccommodationIds = new Set(
    stayAccommodationLinks.map((link) => link.accommodation_id)
  );
  const linkedAccommodations = stayAccommodationLinks
    .map((link) => accommodations.find((item) => item.id === link.accommodation_id))
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  async function updateStay(formData: FormData) {
    'use server';
    const supabase = getServerSupabaseClient();
    const title = String(formData.get('title') ?? '').trim();
    const summary = String(formData.get('summary') ?? '').trim();
    const seasonId = String(formData.get('season_id') ?? '').trim();
    const description = String(formData.get('description') ?? '').trim();
    const activitiesText = String(formData.get('activities_text') ?? '').trim();
    const programText = String(formData.get('program_text') ?? '').trim();
    const supervisionText = String(formData.get('supervision_text') ?? '').trim();
    const requiredDocumentsText = String(formData.get('required_documents_text') ?? '').trim();
    const selectedAges = parseStayAges(formData);
    const { ages, ageMin, ageMax } = getStayAgeBounds(selectedAges);
    const location = String(formData.get('location') ?? '').trim();
    const transportMode = String(formData.get('transport_mode') ?? '').trim();
    const transportText = String(formData.get('transport_text') ?? '').trim();

    await supabase
      .from('stays')
      .update({
        title,
        summary: summary || null,
        season_id: seasonId || currentStay.season_id,
        description: description || null,
        activities_text: activitiesText || null,
        program_text: programText || null,
        supervision_text: supervisionText || null,
        required_documents_text: requiredDocumentsText || null,
        ages,
        age_min: ageMin,
        age_max: ageMax,
        location_text: location || null,
        transport_mode: transportMode || currentStay.transport_mode,
        transport_text: transportText || null
      })
      .eq('id', currentStay.id);

    revalidatePath(`/organisme/sejours/${currentStay.id}`);
    revalidatePath(`/organisme/stays/${currentStay.id}`);
    revalidatePath('/organisme/sejours');
    revalidatePath('/organisme/stays');
    redirect(withOrganizerQuery(`/organisme/sejours/${currentStay.id}?saved=1`, selectedOrganizerId));
  }

  async function addSession(formData: FormData) {
    'use server';
    const supabase = getServerSupabaseClient();
    const startDate = String(formData.get('startDate') ?? '').trim();
    const endDate = String(formData.get('endDate') ?? '').trim();
    const capacityTotal = Number(formData.get('capacityTotal') ?? 0);
    if (!startDate || !endDate || !capacityTotal) {
      redirect(withOrganizerQuery(`/organisme/sejours/${currentStay.id}`, selectedOrganizerId));
    }

    await supabase.from('sessions').insert({
      stay_id: currentStay.id,
      start_date: startDate,
      end_date: endDate,
      capacity_total: capacityTotal,
      capacity_reserved: 0,
      status: 'OPEN'
    });

    revalidatePath(`/organisme/sejours/${currentStay.id}`);
    revalidatePath(`/organisme/stays/${currentStay.id}`);
    revalidatePath('/organisme/sejours');
    revalidatePath('/organisme/stays');
    redirect(withOrganizerQuery(`/organisme/sejours/${currentStay.id}`, selectedOrganizerId));
  }

  async function syncAccommodations(formData: FormData) {
    'use server';
    const supabase = getServerSupabaseClient();
    const selectedIds = formData
      .getAll('accommodation_ids')
      .map((value) => String(value))
      .filter(Boolean);

    const { data: validRows } = await supabase
      .from('accommodations')
      .select('id')
      .eq('organizer_id', selectedOrganizerId);
    const validIds = new Set((validRows ?? []).map((row) => row.id));
    const filteredIds = selectedIds.filter((id) => validIds.has(id));

    await supabase.from('stay_accommodations').delete().eq('stay_id', currentStay.id);

    if (filteredIds.length > 0) {
      await supabase.from('stay_accommodations').insert(
        filteredIds.map((accommodationId, index) => ({
          stay_id: currentStay.id,
          accommodation_id: accommodationId,
          position: index
        }))
      );
    }

    revalidatePath(`/organisme/sejours/${currentStay.id}`);
    revalidatePath(`/organisme/stays/${currentStay.id}`);
    redirect(withOrganizerQuery(`/organisme/sejours/${currentStay.id}`, selectedOrganizerId));
  }

  return (
    <div className="space-y-6">
      {showSavedBanner && <SavedToast message="La fiche séjour a bien été enregistrée." />}
      {errorParam && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          Impossible d&apos;enregistrer l&apos;hébergement : {decodeURIComponent(errorParam)}
        </div>
      )}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">{currentStay.title}</h1>
          <p className="text-sm text-slate-600">
            Saison: {seasons.find((season) => season.id === currentStay.season_id)?.name ?? '-'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
            {stayStatusLabel(currentStay.status)}
          </span>
          <button
            type="submit"
            form="stay-form"
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white"
          >
            Enregistrer le séjour
          </button>
        </div>
      </div>

      <form
        id="stay-form"
        action={updateStay}
        className="space-y-4"
      >
        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-slate-900">Infos séjour</h2>
          <label className="block text-sm font-medium text-slate-700">
            Titre
            <input
              name="title"
              defaultValue={currentStay.title}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Résumé commercial
            <textarea
              name="summary"
              defaultValue={currentStay.summary ?? ''}
              rows={3}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Saison
            <select
              name="season_id"
              defaultValue={currentStay.season_id}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            >
              <option value="">Sélectionner</option>
              {seasons.map((season) => (
                <option key={season.id} value={season.id}>
                  {season.name}
                </option>
              ))}
            </select>
          </label>
        </section>

        <StayEditorialTabs
          description={currentStay.description ?? ''}
          activitiesText={currentStay.activities_text ?? ''}
          programText={currentStay.program_text ?? ''}
          supervisionText={currentStay.supervision_text ?? ''}
          requiredDocumentsText={currentStay.required_documents_text ?? ''}
          transportMode={currentStay.transport_mode ?? 'Sans transport'}
          transportText={currentStay.transport_text ?? ''}
        />

        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-slate-900">Paramètres du séjour</h2>
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
                  <input
                    type="checkbox"
                    name="ages"
                    value={age}
                    defaultChecked={selectedAges.includes(age)}
                    className="cursor-pointer"
                  />
                  <span>{age} ans</span>
                </label>
              ))}
            </div>
            <p className="text-xs text-slate-500">
              Sélection actuelle : {formatStayAgeRange(selectedAges)}
            </p>
          </div>
          <GoogleMapsCityInput
            name="location"
            label="Ville du séjour"
            defaultValue={currentStay.location_text ?? ''}
          />
          <div className="flex justify-end">
            <button
              type="submit"
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white"
            >
              Enregistrer le séjour
            </button>
          </div>
        </section>
      </form>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-slate-900">Hébergements liés</h2>
          <p className="mt-1 text-sm text-slate-600">
            Sélectionne les hébergements réutilisables à rattacher à ce séjour.
          </p>
          <form action={syncAccommodations} className="mt-4 space-y-3">
            <div className="space-y-2">
              {accommodations.map((accommodation) => (
                <label
                  key={accommodation.id}
                  className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-100 px-3 py-3 text-sm"
                >
                  <input
                    type="checkbox"
                    name="accommodation_ids"
                    value={accommodation.id}
                    defaultChecked={linkedAccommodationIds.has(accommodation.id)}
                    className="mt-1 cursor-pointer"
                  />
                  <span>
                    <span className="block font-medium text-slate-900">{accommodation.name}</span>
                    <span className="block text-slate-600">
                      {accommodation.accommodation_type || 'Type non renseigné'}
                    </span>
                  </span>
                </label>
              ))}
              {accommodations.length === 0 && (
                <p className="text-sm text-slate-500">Aucun hébergement créé pour cet organisme.</p>
              )}
            </div>
            <div className="flex justify-end">
              <button className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
                Enregistrer les liaisons
              </button>
            </div>
          </form>
          {linkedAccommodations.length > 0 && (
            <ul className="mt-4 space-y-2 text-sm text-slate-600">
              {linkedAccommodations.map((accommodation) => (
                <li key={accommodation.id} className="rounded-lg border border-slate-100 px-3 py-2">
                  <div className="font-medium text-slate-900">{accommodation.name}</div>
                  <div>{accommodation.accommodation_type || 'Type non renseigné'}</div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-slate-900">Médias</h2>
          <ul className="mt-4 space-y-2 text-sm text-slate-600">
            {media.map((item) => (
              <li key={item.id} className="rounded-lg border border-slate-100 px-3 py-2">
                {item.media_type || 'media'} : {item.url}
              </li>
            ))}
            {media.length === 0 && <li>Aucun média.</li>}
          </ul>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-slate-900">Transport</h2>
          <p className="mt-4 text-sm text-slate-600">
            {currentStay.transport_mode || 'Non renseigné'}
          </p>
          <p className="mt-3 whitespace-pre-line text-sm text-slate-600">
            {currentStay.transport_text || 'Aucun texte transport saisi.'}
          </p>
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-slate-900">Sessions</h2>
          <ul className="space-y-2 text-sm text-slate-600">
            {sessions.map((sessionItem) => (
              <li key={sessionItem.id} className="flex items-center justify-between">
                <span>
                  {new Date(sessionItem.start_date).toLocaleDateString('fr-FR')} -{' '}
                  {new Date(sessionItem.end_date).toLocaleDateString('fr-FR')}
                </span>
                <span className="text-xs text-slate-500">
                  {sessionItem.capacity_reserved}/{sessionItem.capacity_total} (
                  {sessionStatusLabel(sessionItem.status)})
                </span>
              </li>
            ))}
            {sessions.length === 0 && <li>Aucune session.</li>}
          </ul>
          <form action={addSession} className="space-y-3 border-t border-slate-100 pt-4">
            <div className="grid gap-3 md:grid-cols-3">
              <label className="text-xs font-medium text-slate-600">
                Debut
                <input
                  name="startDate"
                  type="date"
                  className="mt-1 w-full rounded border border-slate-200 px-2 py-1"
                  required
                />
              </label>
              <label className="text-xs font-medium text-slate-600">
                Fin
                <input
                  name="endDate"
                  type="date"
                  className="mt-1 w-full rounded border border-slate-200 px-2 py-1"
                  required
                />
              </label>
              <label className="text-xs font-medium text-slate-600">
                Capacite
                <input
                  name="capacityTotal"
                  type="number"
                  className="mt-1 w-full rounded border border-slate-200 px-2 py-1"
                  required
                />
              </label>
            </div>
            <button className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white">
              Ajouter session
            </button>
          </form>
        </div>

        <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-slate-900">Réservations liées</h2>
          <p className="text-sm text-slate-600">
            Cette section sera branchée quand le flux de réservation organisateur sera connecté.
          </p>
        </div>
      </div>

      <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Créer un hébergement</h2>
          <p className="text-sm text-slate-600">
            La création et la modification détaillées se font maintenant depuis la page dédiée des hébergements.
          </p>
        </div>
        <div className="flex justify-end">
          <Link
            href={withOrganizerQuery('/organisme/hebergements', selectedOrganizerId)}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            Gérer les hébergements
          </Link>
        </div>
      </section>

      {accommodations.length > 0 && (
        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Bibliothèque des hébergements</h2>
            <p className="text-sm text-slate-600">
              Pour modifier une fiche, utilise la page dédiée des hébergements.
            </p>
          </div>
          <div className="space-y-4">
            {accommodations.map((accommodation) => (
              <div key={accommodation.id} className="rounded-xl border border-slate-100 p-4">
                <div className="font-medium text-slate-900">{accommodation.name}</div>
                <div className="text-sm text-slate-600">
                  {accommodation.accommodation_type || 'Type non renseigné'}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="sticky bottom-4 z-10 flex justify-end">
        <button
          type="submit"
          form="stay-form"
          className="rounded-full bg-emerald-600 px-5 py-3 text-sm font-semibold text-white shadow-lg"
        >
          Enregistrer le séjour
        </button>
      </div>
    </div>
  );
}
