import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireRole } from '@/lib/auth/require';
import { getServerSupabaseClient } from '@/lib/supabase/server';
import { sessionStatusLabel, stayStatusLabel } from '@/lib/ui/labels';

type PageProps = {
  params: { id: string };
  searchParams?: {
    saved?: string | string[];
  };
};

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function AdminStayDetailPage({ params, searchParams }: PageProps) {
  requireRole('ADMIN');
  const supabase = getServerSupabaseClient();
  const savedParam = Array.isArray(searchParams?.saved) ? searchParams?.saved[0] : searchParams?.saved;
  const showSavedBanner = savedParam === '1';

  const { data: stay } = await supabase
    .from('stays')
    .select(
      'id,title,status,season_id,description,age_min,age_max,location_text,transport_mode,organizer_id'
    )
    .eq('id', params.id)
    .maybeSingle();

  if (!stay) {
    redirect('/admin/sejours');
  }

  const currentStay = stay;

  const [{ data: organizersRaw }, { data: seasonsRaw }, { data: sessionsRaw }, { data: mediaRaw }] =
    await Promise.all([
      supabase.from('organizers').select('id,name').order('name', { ascending: true }),
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
    const ageMinRaw = String(formData.get('ageMin') ?? '').trim();
    const ageMaxRaw = String(formData.get('ageMax') ?? '').trim();
    const location = String(formData.get('location') ?? '').trim();
    const transportMode = String(formData.get('transport_mode') ?? '').trim();

    await supabase
      .from('stays')
      .update({
        title,
        organizer_id: organizerId || currentStay.organizer_id,
        season_id: seasonId || currentStay.season_id,
        status:
          status === 'DRAFT' || status === 'PUBLISHED' || status === 'HIDDEN' || status === 'ARCHIVED'
            ? status
            : currentStay.status,
        description: description || null,
        age_min: ageMinRaw ? Number(ageMinRaw) : null,
        age_max: ageMaxRaw ? Number(ageMaxRaw) : null,
        location_text: location || null,
        transport_mode: transportMode || undefined
      })
      .eq('id', currentStay.id);

    redirect(`/admin/sejours/${currentStay.id}?saved=1`);
  }

  async function addSession(formData: FormData) {
    'use server';
    const supabase = getServerSupabaseClient();
    const startDate = String(formData.get('startDate') ?? '').trim();
    const endDate = String(formData.get('endDate') ?? '').trim();
    const capacityTotal = Number(formData.get('capacityTotal') ?? 0);
    if (!startDate || !endDate || !capacityTotal) {
      redirect(`/admin/sejours/${currentStay.id}`);
    }

    await supabase.from('sessions').insert({
      stay_id: currentStay.id,
      start_date: startDate,
      end_date: endDate,
      capacity_total: capacityTotal,
      capacity_reserved: 0,
      status: 'OPEN'
    });

    redirect(`/admin/sejours/${currentStay.id}`);
  }

  return (
    <div className="space-y-6">
      {showSavedBanner && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
          La fiche séjour a bien été enregistrée.
        </div>
      )}
      <div className="flex items-center justify-between gap-4">
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

      <form action={updateStay} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6">
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
            <input
              name="transport_mode"
              defaultValue={currentStay.transport_mode ?? ''}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            />
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
          <label className="block text-sm font-medium text-slate-700">
            Age min
            <input
              name="ageMin"
              type="number"
              defaultValue={currentStay.age_min ?? ''}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Age max
            <input
              name="ageMax"
              type="number"
              defaultValue={currentStay.age_max ?? ''}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Lieu
            <input
              name="location"
              defaultValue={currentStay.location_text ?? ''}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            />
          </label>
        </div>

        <div className="flex justify-end">
          <button className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white">
            Enregistrer
          </button>
        </div>
      </form>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-6">
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

        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-slate-900">Sessions</h2>
          <ul className="mt-4 space-y-2 text-sm text-slate-600">
            {sessions.map((sessionItem) => (
              <li key={sessionItem.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 px-3 py-2">
                <span>
                  {new Date(sessionItem.start_date).toLocaleDateString('fr-FR')} -{' '}
                  {new Date(sessionItem.end_date).toLocaleDateString('fr-FR')}
                </span>
                <span className="text-xs text-slate-500">
                  {sessionItem.capacity_reserved}/{sessionItem.capacity_total} ({sessionStatusLabel(sessionItem.status)})
                </span>
              </li>
            ))}
            {sessions.length === 0 && <li>Aucune session.</li>}
          </ul>

          <form action={addSession} className="mt-4 space-y-3 border-t border-slate-100 pt-4">
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
        </section>
      </div>
    </div>
  );
}
