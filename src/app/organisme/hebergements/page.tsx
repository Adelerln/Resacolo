import { revalidatePath } from 'next/cache';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import SavedToast from '@/components/common/SavedToast';
import { formatAccommodationType } from '@/lib/accommodation-types';
import { extractAccommodationLocationMeta } from '@/lib/accommodation-location';
import { deleteAccommodationForOrganizer } from '@/lib/accommodations';
import { requireOrganizerPageAccess } from '@/lib/organizer-backoffice-access.server';
import { withOrganizerQuery } from '@/lib/organizers.server';
import { getServerSupabaseClient } from '@/lib/supabase/server';
import { accommodationStatusBadgeClassName, accommodationStatusLabel } from '@/lib/ui/labels';

type PageProps = {
  searchParams?: Promise<{
    organizerId?: string | string[];
    saved?: string | string[];
    deleted?: string | string[];
    archived?: string | string[];
    unarchived?: string | string[];
    error?: string | string[];
  }>;
};

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function OrganizerAccommodationsPage({ searchParams }: PageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const {
    selectedOrganizer,
    selectedOrganizerId
  } = await requireOrganizerPageAccess({
    requestedOrganizerId: resolvedSearchParams?.organizerId,
    requiredSection: 'accommodations'
  });
  const supabase = getServerSupabaseClient();
  const savedParam = Array.isArray(resolvedSearchParams?.saved)
    ? resolvedSearchParams?.saved[0]
    : resolvedSearchParams?.saved;
  const deletedParam = Array.isArray(resolvedSearchParams?.deleted)
    ? resolvedSearchParams?.deleted[0]
    : resolvedSearchParams?.deleted;
  const archivedParam = Array.isArray(resolvedSearchParams?.archived)
    ? resolvedSearchParams?.archived[0]
    : resolvedSearchParams?.archived;
  const unarchivedParam = Array.isArray(resolvedSearchParams?.unarchived)
    ? resolvedSearchParams?.unarchived[0]
    : resolvedSearchParams?.unarchived;
  const errorParam = Array.isArray(resolvedSearchParams?.error)
    ? resolvedSearchParams?.error[0]
    : resolvedSearchParams?.error;
  const showSavedBanner = savedParam === '1';
  const showDeletedBanner = deletedParam === '1';
  const showArchivedBanner = archivedParam === '1';
  const showUnarchivedBanner = unarchivedParam === '1';

  if (!selectedOrganizerId) {
    redirect('/organisme/sejours');
  }

  const [{ data: accommodationsRaw }, { data: stayLinksRaw }, { data: staysRaw }, { data: mediaRaw }] = await Promise.all([
    supabase
      .from('accommodations')
      .select(
        'id,name,accommodation_type,description,bed_info,bathroom_info,catering_info,accessibility_info,status,updated_at,validated_at'
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

  const accommodations = (accommodationsRaw ?? []).map((accommodation) => {
    const locationMeta = extractAccommodationLocationMeta(accommodation.description);
    return {
      ...accommodation,
      description: locationMeta.description,
      locationLabel: locationMeta.locationLabel,
      linkedStayTitles: linkedStayTitlesByAccommodationId.get(accommodation.id) ?? [],
      mediaCount: mediaCountByAccommodationId.get(accommodation.id) ?? 0
    };
  });

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

  async function toggleAccommodationArchive(formData: FormData) {
    'use server';
    const supabase = getServerSupabaseClient();
    const accommodationId = String(formData.get('accommodation_id') ?? '').trim();
    const nextStatus = String(formData.get('next_status') ?? '').trim();

    if (!accommodationId || (nextStatus !== 'ARCHIVED' && nextStatus !== 'VALIDATED')) {
      redirect(
        withOrganizerQuery(
          '/organisme/hebergements?error=archive-action-invalid',
          selectedOrganizerId
        )
      );
    }

    const { error } = await supabase
      .from('accommodations')
      .update({
        status: nextStatus,
        updated_at: new Date().toISOString()
      })
      .eq('id', accommodationId)
      .eq('organizer_id', selectedOrganizerId);

    if (error) {
      redirect(
        withOrganizerQuery(
          `/organisme/hebergements?error=${encodeURIComponent(error.message)}`,
          selectedOrganizerId
        )
      );
    }

    revalidatePath('/organisme/hebergements');
    revalidatePath('/organisme/sejours');
    revalidatePath('/organisme/stays');
    redirect(
      withOrganizerQuery(
        `/organisme/hebergements?${nextStatus === 'ARCHIVED' ? 'archived=1' : 'unarchived=1'}`,
        selectedOrganizerId
      )
    );
  }

  return (
    <div className="space-y-6">
      {showSavedBanner && <SavedToast message="La fiche hébergement a bien été enregistrée." />}
      {showDeletedBanner && <SavedToast message="La fiche hébergement a bien été supprimée." />}
      {showArchivedBanner && <SavedToast message="La fiche hébergement a bien été archivée." />}
      {showUnarchivedBanner && <SavedToast message="La fiche hébergement a bien été désarchivée." />}
      {errorParam && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {decodeURIComponent(errorParam)}
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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
          className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white"
        >
          Ajouter un hébergement
        </Link>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="min-w-[980px] w-full text-left text-sm">
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
                    {accommodation.locationLabel ? (
                      <div className="mt-1 text-xs font-semibold text-slate-700">{accommodation.locationLabel}</div>
                    ) : null}
                    <div className="mt-1 max-w-md text-xs text-slate-500">{accommodation.description || 'Aucune description'}</div>
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
                  <td className="px-4 py-3 text-slate-600">
                    <span
                      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${accommodationStatusBadgeClassName(accommodation.status)}`}
                    >
                      {accommodationStatusLabel(accommodation.status)}
                    </span>
                  </td>
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
                      <form action={toggleAccommodationArchive}>
                        <input type="hidden" name="accommodation_id" value={accommodation.id} />
                        <input
                          type="hidden"
                          name="next_status"
                          value={
                            accommodation.status === 'ARCHIVED'
                              ? accommodation.validated_at
                                ? 'VALIDATED'
                                : 'DRAFT'
                              : 'ARCHIVED'
                          }
                        />
                        <button
                          className={`rounded-lg px-3 py-1 text-xs font-semibold ${
                            accommodation.status === 'ARCHIVED'
                              ? 'border border-emerald-200 text-emerald-700'
                              : 'border border-amber-200 text-amber-700'
                          }`}
                        >
                          {accommodation.status === 'ARCHIVED' ? 'Désarchiver' : 'Archiver'}
                        </button>
                      </form>
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
    </div>
  );
}
