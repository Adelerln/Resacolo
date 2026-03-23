import { revalidatePath } from 'next/cache';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import SavedToast from '@/components/common/SavedToast';
import { formatAccommodationType } from '@/components/organisme/AccommodationFormFields';
import { requireRole } from '@/lib/auth/require';
import { deleteAccommodationForOrganizer } from '@/lib/accommodations';
import { resolveOrganizerSelection, withOrganizerQuery } from '@/lib/organizers';
import { getServerSupabaseClient } from '@/lib/supabase/server';

type PageProps = {
  searchParams?: {
    organizerId?: string | string[];
    saved?: string | string[];
    deleted?: string | string[];
    error?: string | string[];
  };
};

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function OrganizerAccommodationsPage({ searchParams }: PageProps) {
  const session = requireRole('ORGANISATEUR');
  const supabase = getServerSupabaseClient();
  const { selectedOrganizer, selectedOrganizerId } = await resolveOrganizerSelection(
    searchParams?.organizerId,
    session.tenantId ?? null
  );
  const savedParam = Array.isArray(searchParams?.saved) ? searchParams?.saved[0] : searchParams?.saved;
  const deletedParam = Array.isArray(searchParams?.deleted) ? searchParams?.deleted[0] : searchParams?.deleted;
  const errorParam = Array.isArray(searchParams?.error) ? searchParams?.error[0] : searchParams?.error;
  const showSavedBanner = savedParam === '1';
  const showDeletedBanner = deletedParam === '1';

  if (!selectedOrganizerId) {
    redirect('/organisme/sejours');
  }

  const [{ data: accommodationsRaw }, { data: stayLinksRaw }, { data: staysRaw }, { data: mediaRaw }] = await Promise.all([
    supabase
      .from('accommodations')
      .select(
        'id,name,accommodation_type,description,bed_info,bathroom_info,catering_info,accessibility_info,status,updated_at'
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

  async function deleteAccommodation(formData: FormData) {
    'use server';
    const accommodationId = String(formData.get('accommodation_id') ?? '').trim();

    if (!accommodationId) {
      redirect(withOrganizerQuery('/organisme/hebergements?error=missing-accommodation-id', selectedOrganizerId));
    }

    const { error } = await deleteAccommodationForOrganizer({
      accommodationId,
      organizerId: selectedOrganizerId
    });

    if (error) {
      redirect(
        withOrganizerQuery(
          `/organisme/hebergements?error=${encodeURIComponent(error)}`,
          selectedOrganizerId
        )
      );
    }

    revalidatePath('/organisme/hebergements');
    revalidatePath('/organisme/sejours');
    revalidatePath('/organisme/stays');
    redirect(withOrganizerQuery('/organisme/hebergements?deleted=1', selectedOrganizerId));
  }

  return (
    <div className="space-y-6">
      {showSavedBanner && <SavedToast message="La fiche hébergement a bien été enregistrée." />}
      {showDeletedBanner && <SavedToast message="La fiche hébergement a bien été supprimée." />}
      {errorParam && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {decodeURIComponent(errorParam)}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Hébergements</h1>
          <p className="text-sm text-slate-600">
            {selectedOrganizer
              ? `Gestion des hébergements réutilisables pour ${selectedOrganizer.name}.`
              : 'Gestion des hébergements réutilisables.'}
          </p>
        </div>
        <Link
          href={withOrganizerQuery('/organisme/hebergements/new', selectedOrganizerId)}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white"
        >
          Ajouter un hébergement
        </Link>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Hébergement</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Séjours liés</th>
              <th className="px-4 py-3">Médias</th>
              <th className="px-4 py-3">Statut</th>
              <th className="px-4 py-3">Mis à jour</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {accommodations.map((accommodation) => (
              <tr key={accommodation.id} className="border-t border-slate-100 align-top">
                <td className="px-4 py-3">
                  <div className="font-medium text-slate-900">{accommodation.name}</div>
                  <div className="mt-1 max-w-md text-xs text-slate-500">
                    {accommodation.description || 'Aucune description'}
                  </div>
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {formatAccommodationType(accommodation.accommodation_type)}
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {accommodation.linkedStayTitles.length > 0
                    ? accommodation.linkedStayTitles.join(', ')
                    : 'Aucun'}
                </td>
                <td className="px-4 py-3 text-slate-600">{accommodation.mediaCount}</td>
                <td className="px-4 py-3 text-slate-600">{accommodation.status}</td>
                <td className="px-4 py-3 text-slate-600">
                  {new Date(accommodation.updated_at).toLocaleDateString('fr-FR')}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Link
                      href={withOrganizerQuery(`/organisme/hebergements/${accommodation.id}`, selectedOrganizerId)}
                      className="rounded-lg border border-emerald-200 px-3 py-1 text-xs font-semibold text-emerald-700"
                    >
                      Éditer
                    </Link>
                    <form action={deleteAccommodation}>
                      <input type="hidden" name="accommodation_id" value={accommodation.id} />
                      <button className="rounded-lg border border-rose-200 px-3 py-1 text-xs font-semibold text-rose-700">
                        Supprimer
                      </button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
            {accommodations.length === 0 && (
              <tr>
                <td className="px-4 py-6 text-slate-500" colSpan={7}>
                  Aucun hébergement créé pour cet organisateur.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
