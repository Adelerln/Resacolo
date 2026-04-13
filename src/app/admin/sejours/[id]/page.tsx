import Link from 'next/link';
import { redirect } from 'next/navigation';
import GoogleMapsCityInput from '@/components/common/GoogleMapsCityInput';
import SavedToast from '@/components/common/SavedToast';
import { requireRole } from '@/lib/auth/require';
import { formatStayAgeRange, getStayAgeBounds, normalizeStayAges, parseStayAges, STAY_AGE_OPTIONS } from '@/lib/stay-ages';
import { isMissingRegionTextColumnError, normalizeStayRegion, STAY_REGION_OPTIONS } from '@/lib/stay-regions';
import { getServerSupabaseClient } from '@/lib/supabase/server';
import { sessionStatusLabel, stayStatusLabel } from '@/lib/ui/labels';
import type { Database } from '@/types/supabase';

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams?: {
    saved?: string | string[];
  };
};

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function parseOptionalEuros(value: FormDataEntryValue | null) {
  const raw = String(value ?? '').trim().replace(',', '.');
  if (!raw) return null;
  const parsed = Number(raw);
  if (Number.isNaN(parsed) || parsed < 0) return null;
  return parsed;
}

function getSessionPriceAmountCents(
  sessionItem: {
    session_prices?:
      | {
          amount_cents: number;
          currency: string;
        }
      | {
          amount_cents: number;
          currency: string;
        }[]
      | null;
  }
) {
  if (!sessionItem.session_prices) return null;
  if (Array.isArray(sessionItem.session_prices)) {
    return sessionItem.session_prices[0]?.amount_cents ?? null;
  }
  return sessionItem.session_prices.amount_cents ?? null;
}

export default async function AdminStayDetailPage({ params: paramsPromise, searchParams }: PageProps) {
  const params = await paramsPromise;
  await requireRole('ADMIN');
  const supabase = getServerSupabaseClient();
  const savedParam = Array.isArray(searchParams?.saved) ? searchParams?.saved[0] : searchParams?.saved;
  const showSavedBanner = savedParam === '1';

  const { data: stay } = await supabase
    .from('stays')
    .select('*')
    .eq('id', params.id)
    .maybeSingle();

  if (!stay) {
    redirect('/admin/sejours');
  }

  const currentStay = stay;
  const selectedAges = normalizeStayAges(currentStay.ages, currentStay.age_min, currentStay.age_max);

  const [{ data: organizersRaw }, { data: seasonsRaw }, { data: sessionsRaw }, { data: mediaRaw }] =
    await Promise.all([
      supabase.from('organizers').select('id,name').order('name', { ascending: true }),
      supabase.from('seasons').select('id,name').order('name', { ascending: true }),
      supabase
        .from('sessions')
        .select('id,start_date,end_date,capacity_total,capacity_reserved,status,session_prices(amount_cents,currency)')
        .eq('stay_id', currentStay.id)
        .order('start_date', { ascending: true }),
      supabase
        .from('stay_media')
        .select('id,url,position,media_type')
        .eq('stay_id', currentStay.id)
        .order('position', { ascending: true })
    ]);

  const organizers = organizersRaw ?? [];
  const seasons = seasonsRaw ?? [];
  const sessions = sessionsRaw ?? [];
  const media = mediaRaw ?? [];

  async function updateStay(formData: FormData) {
    'use server';
    const supabase = getServerSupabaseClient();
    const title = String(formData.get('title') ?? '').trim();
    const organizerId = String(formData.get('organizer_id') ?? '').trim();
    const seasonId = String(formData.get('season_id') ?? '').trim();
    const status = String(formData.get('status') ?? '').trim();
    const description = String(formData.get('description') ?? '').trim();
    const selectedAges = parseStayAges(formData);
    const { ages, ageMin, ageMax } = getStayAgeBounds(selectedAges);
    const location = String(formData.get('location') ?? '').trim();
    const region = normalizeStayRegion(formData.get('region_text'));
    const transportMode = String(formData.get('transport_mode') ?? '').trim();

    const basePayload: Database['public']['Tables']['stays']['Update'] = {
      title,
      organizer_id: organizerId || currentStay.organizer_id,
      season_id: seasonId || currentStay.season_id,
      status:
        status === 'DRAFT' || status === 'PUBLISHED' || status === 'HIDDEN' || status === 'ARCHIVED'
          ? status
          : currentStay.status,
      description: description || null,
      ages,
      age_min: ageMin,
      age_max: ageMax,
      location_text: location || null,
      transport_mode: transportMode || undefined
    };

    const payloadWithRegion = { ...basePayload, region_text: region };
    let updateError: { message: string } | null = null;

    const firstAttempt = await supabase.from('stays').update(payloadWithRegion).eq('id', currentStay.id);
    updateError = firstAttempt.error;

    if (updateError && isMissingRegionTextColumnError(updateError.message)) {
      const fallbackAttempt = await supabase.from('stays').update(basePayload).eq('id', currentStay.id);
      updateError = fallbackAttempt.error;
    }

    if (updateError) {
      console.error('Erreur Supabase (admin update stay)', updateError.message);
      redirect(`/admin/sejours/${currentStay.id}`);
    }

    redirect(`/admin/sejours/${currentStay.id}?saved=1`);
  }

  async function addSession(formData: FormData) {
    'use server';
    const supabase = getServerSupabaseClient();
    const startDate = String(formData.get('startDate') ?? '').trim();
    const endDate = String(formData.get('endDate') ?? '').trim();
    const capacityTotal = Number(formData.get('capacityTotal') ?? 0);
    const amountEuros = parseOptionalEuros(formData.get('amount_euros'));
    const rawAmount = String(formData.get('amount_euros') ?? '').trim();

    if (
      !startDate ||
      !endDate ||
      Number.isNaN(capacityTotal) ||
      capacityTotal < 0 ||
      (rawAmount && amountEuros === null)
    ) {
      redirect(`/admin/sejours/${currentStay.id}`);
    }

    const { data: createdSession, error: sessionError } = await supabase
      .from('sessions')
      .insert({
        stay_id: currentStay.id,
        start_date: startDate,
        end_date: endDate,
        capacity_total: capacityTotal,
        capacity_reserved: 0,
        status: 'OPEN'
      })
      .select('id')
      .single();

    if (sessionError || !createdSession) {
      console.error('Erreur Supabase (admin add session)', sessionError?.message ?? 'unknown');
      redirect(`/admin/sejours/${currentStay.id}`);
    }

    if (amountEuros !== null) {
      const { error: priceError } = await supabase.from('session_prices').insert({
        session_id: createdSession.id,
        amount_cents: Math.round(amountEuros * 100),
        currency: 'EUR'
      });

      if (priceError) {
        await supabase.from('sessions').delete().eq('id', createdSession.id).eq('stay_id', currentStay.id);
        console.error('Erreur Supabase (admin add session price)', priceError.message);
        redirect(`/admin/sejours/${currentStay.id}`);
      }
    }

    redirect(`/admin/sejours/${currentStay.id}`);
  }

  async function deleteSession(formData: FormData) {
    'use server';
    const supabase = getServerSupabaseClient();
    const sessionId = String(formData.get('session_id') ?? '').trim();

    if (!sessionId) {
      redirect(`/admin/sejours/${currentStay.id}`);
    }

    await supabase
      .from('sessions')
      .delete()
      .eq('id', sessionId)
      .eq('stay_id', currentStay.id);

    redirect(`/admin/sejours/${currentStay.id}?saved=1`);
  }

  return (
      <div className="space-y-6">
      {showSavedBanner && <SavedToast message="La fiche séjour a bien été enregistrée." />}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link href="/admin/sejours" className="text-sm font-medium text-slate-500 hover:text-slate-800">
            Retour aux sejours
          </Link>
          <h1 className="mt-2 text-2xl font-semibold text-slate-900">{currentStay.title}</h1>
          <p className="text-sm text-slate-600">
            Saison: {seasons.find((season) => season.id === currentStay.season_id)?.name ?? '-'}
          </p>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
          {stayStatusLabel(currentStay.status)}
        </span>
      </div>

      <form action={updateStay} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
        <h2 className="text-lg font-semibold text-slate-900">Infos sejour</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block text-sm font-medium text-slate-700">
            Titre
            <input
              name="title"
              defaultValue={currentStay.title}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Organisateur
            <select
              name="organizer_id"
              defaultValue={currentStay.organizer_id}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            >
              {organizers.map((organizer) => (
                <option key={organizer.id} value={organizer.id}>
                  {organizer.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <label className="block text-sm font-medium text-slate-700">
            Saison
            <select
              name="season_id"
              defaultValue={currentStay.season_id}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            >
              {seasons.map((season) => (
                <option key={season.id} value={season.id}>
                  {season.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Statut
            <select
              name="status"
              defaultValue={currentStay.status}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            >
              <option value="DRAFT">Brouillon</option>
              <option value="PUBLISHED">Publie</option>
              <option value="HIDDEN">Masque</option>
              <option value="ARCHIVED">Archive</option>
            </select>
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Transport
            <select
              name="transport_mode"
              defaultValue={currentStay.transport_mode ?? ''}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            >
              <option value="Aller/Retour similaire">Aller/Retour similaire</option>
              <option value="Aller/Retour différencié">Aller/Retour différencié</option>
              <option value="Sans transport">Sans transport</option>
            </select>
          </label>
        </div>

        <label className="block text-sm font-medium text-slate-700">
          Description
          <textarea
            name="description"
            defaultValue={currentStay.description ?? ''}
            rows={5}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
          />
        </label>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="md:col-span-2">
            <div className="text-sm font-medium text-slate-700">Âges</div>
            <p className="mt-1 text-xs text-slate-500">Coche les âges proposés.</p>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
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
            <p className="mt-2 text-xs text-slate-500">
              Sélection actuelle : {formatStayAgeRange(selectedAges)}
            </p>
          </div>
          <GoogleMapsCityInput
            name="location"
            label="Ville du séjour"
            defaultValue={currentStay.location_text ?? ''}
          />
          <label className="block text-sm font-medium text-slate-700">
            Région du séjour
            <select
              name="region_text"
              defaultValue={currentStay.region_text ?? ''}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            >
              <option value="">Sélectionner</option>
              {STAY_REGION_OPTIONS.map((region) => (
                <option key={region} value={region}>
                  {region}
                </option>
              ))}
            </select>
            <span className="mt-1 block text-xs text-slate-500">
              Choisir “Étranger” si le séjour se déroule hors de France.
            </span>
          </label>
        </div>

        <div className="flex justify-end">
          <button className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white">
            Enregistrer
          </button>
        </div>
      </form>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
          <h2 className="text-lg font-semibold text-slate-900">Medias</h2>
          <ul className="mt-4 space-y-2 text-sm text-slate-600">
            {media.map((item) => (
              <li key={item.id} className="rounded-lg border border-slate-100 px-3 py-2">
                {item.media_type || 'media'} : {item.url}
              </li>
            ))}
            {media.length === 0 && <li>Aucun media.</li>}
          </ul>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
          <h2 className="text-lg font-semibold text-slate-900">Sessions</h2>
          <ul className="mt-4 space-y-2 text-sm text-slate-600">
            {sessions.map((sessionItem) => (
              <li key={sessionItem.id} className="flex flex-col gap-3 rounded-lg border border-slate-100 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div>
                    {new Date(sessionItem.start_date).toLocaleDateString('fr-FR')} -{' '}
                    {new Date(sessionItem.end_date).toLocaleDateString('fr-FR')}
                  </div>
                  <div className="text-xs text-slate-500">
                    {sessionItem.capacity_reserved}/{sessionItem.capacity_total} ({sessionStatusLabel(sessionItem.status)})
                  </div>
                  {getSessionPriceAmountCents(sessionItem) !== null && (
                    <div className="text-xs text-slate-500">
                      Prix: {(getSessionPriceAmountCents(sessionItem)! / 100).toLocaleString('fr-FR', {
                        style: 'currency',
                        currency: 'EUR'
                      })}
                    </div>
                  )}
                </div>
                <form action={deleteSession}>
                  <input type="hidden" name="session_id" value={sessionItem.id} />
                  <button className="rounded-lg border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700">
                    Supprimer
                  </button>
                </form>
              </li>
            ))}
            {sessions.length === 0 && <li>Aucune session.</li>}
          </ul>

          <form action={addSession} className="mt-4 space-y-3 border-t border-slate-100 pt-4">
            <div className="grid gap-3 md:grid-cols-4">
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
                  min="0"
                  className="mt-1 w-full rounded border border-slate-200 px-2 py-1"
                  required
                />
              </label>
              <label className="text-xs font-medium text-slate-600">
                Prix en euros
                <input
                  name="amount_euros"
                  type="number"
                  min="0"
                  step="0.01"
                  className="mt-1 w-full rounded border border-slate-200 px-2 py-1"
                  placeholder="0,00"
                />
              </label>
            </div>
            <button className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white">
              Ajouter session
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
