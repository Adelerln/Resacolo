import { revalidatePath } from 'next/cache';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ChevronDown, ChevronUp } from 'lucide-react';
import OrganizerPageHeader from '@/components/organisme/OrganizerPageHeader';
import AccommodationLinkedStaysDropdown from '@/components/organisme/AccommodationLinkedStaysDropdown';
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
    sortBy?: string | string[];
    sortDir?: string | string[];
  }>;
};

type AccommodationSortKey = 'name' | 'type' | 'linkedStays' | 'mediaCount' | 'status' | 'updatedAt';
type AccommodationSortDirection = 'asc' | 'desc';

const DEFAULT_SORT_KEY: AccommodationSortKey = 'name';
const DEFAULT_SORT_DIRECTION: AccommodationSortDirection = 'asc';

function getSingleParam(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

function isAccommodationSortKey(value: string | undefined): value is AccommodationSortKey {
  return (
    value === 'name' ||
    value === 'type' ||
    value === 'linkedStays' ||
    value === 'mediaCount' ||
    value === 'status' ||
    value === 'updatedAt'
  );
}

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function OrganizerAccommodationsPage({ searchParams }: PageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const { selectedOrganizerId } = await requireOrganizerPageAccess({
    requestedOrganizerId: resolvedSearchParams?.organizerId,
    requiredSection: 'accommodations'
  });
  const supabase = getServerSupabaseClient();
  const savedParam = getSingleParam(resolvedSearchParams?.saved);
  const deletedParam = getSingleParam(resolvedSearchParams?.deleted);
  const archivedParam = getSingleParam(resolvedSearchParams?.archived);
  const unarchivedParam = getSingleParam(resolvedSearchParams?.unarchived);
  const errorParam = getSingleParam(resolvedSearchParams?.error);
  const requestedSortBy = getSingleParam(resolvedSearchParams?.sortBy);
  const requestedSortDir = getSingleParam(resolvedSearchParams?.sortDir);
  const sortBy = isAccommodationSortKey(requestedSortBy) ? requestedSortBy : DEFAULT_SORT_KEY;
  const sortDir: AccommodationSortDirection =
    requestedSortDir === 'desc' ? 'desc' : DEFAULT_SORT_DIRECTION;
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
        'id,name,accommodation_type,address_text,postal_code,city,department_code,region_text,country,description,bed_info,bathroom_info,catering_info,accessibility_info,status,updated_at,validated_at'
      )
      .eq('organizer_id', selectedOrganizerId),
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

  const accommodations = (accommodationsRaw ?? [])
    .map((accommodation) => {
      const locationMeta = extractAccommodationLocationMeta(accommodation.description, {
        addressText: accommodation.address_text,
        postalCode: accommodation.postal_code,
        city: accommodation.city,
        departmentCode: accommodation.department_code,
        regionText: accommodation.region_text,
        country: accommodation.country
      });
      const linkedStayTitles = linkedStayTitlesByAccommodationId.get(accommodation.id) ?? [];

      return {
        ...accommodation,
        description: locationMeta.description,
        locationLabel: locationMeta.locationLabel,
        linkedStayTitles: linkedStayTitles.sort((left, right) =>
          left.localeCompare(right, 'fr', { sensitivity: 'base' })
        ),
        mediaCount: mediaCountByAccommodationId.get(accommodation.id) ?? 0
      };
    })
    .sort((left, right) => {
      const direction = sortDir === 'asc' ? 1 : -1;

      const compareText = (a: string, b: string) =>
        a.localeCompare(b, 'fr', { sensitivity: 'base' }) * direction;
      const compareNumber = (a: number, b: number) => (a - b) * direction;

      switch (sortBy) {
        case 'name': {
          const result = compareText(left.name ?? '', right.name ?? '');
          if (result !== 0) return result;
          break;
        }
        case 'type': {
          const result = compareText(
            formatAccommodationType(left.accommodation_type),
            formatAccommodationType(right.accommodation_type)
          );
          if (result !== 0) return result;
          break;
        }
        case 'linkedStays': {
          const result = compareNumber(left.linkedStayTitles.length, right.linkedStayTitles.length);
          if (result !== 0) return result;
          break;
        }
        case 'mediaCount': {
          const result = compareNumber(left.mediaCount, right.mediaCount);
          if (result !== 0) return result;
          break;
        }
        case 'status': {
          const result = compareText(
            accommodationStatusLabel(left.status),
            accommodationStatusLabel(right.status)
          );
          if (result !== 0) return result;
          break;
        }
        case 'updatedAt': {
          const result = compareNumber(
            new Date(left.updated_at).getTime(),
            new Date(right.updated_at).getTime()
          );
          if (result !== 0) return result;
          break;
        }
      }

      return (left.name ?? '').localeCompare(right.name ?? '', 'fr', { sensitivity: 'base' });
    });

  function buildSortHref(key: AccommodationSortKey) {
    const params = new URLSearchParams();

    for (const [paramKey, paramValue] of Object.entries(resolvedSearchParams ?? {})) {
      if (
        paramValue == null ||
        paramKey === 'sortBy' ||
        paramKey === 'sortDir' ||
        paramKey === 'organizerId'
      ) {
        continue;
      }
      if (Array.isArray(paramValue)) {
        for (const value of paramValue) {
          params.append(paramKey, value);
        }
      } else {
        params.set(paramKey, paramValue);
      }
    }

    params.set('sortBy', key);
    params.set('sortDir', sortBy === key && sortDir === 'asc' ? 'desc' : 'asc');

    return withOrganizerQuery(`/organisme/hebergements?${params.toString()}`, selectedOrganizerId);
  }

  function renderSortableHeader(label: string, key: AccommodationSortKey, align: 'left' | 'center' = 'left') {
    const isActive = sortBy === key;
    const icon = !isActive ? null : sortDir === 'asc' ? (
      <ChevronUp className="h-3.5 w-3.5" />
    ) : (
      <ChevronDown className="h-3.5 w-3.5" />
    );

    return (
      <Link
        href={buildSortHref(key)}
        className={`inline-flex items-center gap-1 uppercase tracking-wide text-slate-500 hover:text-slate-700 ${
          align === 'center' ? 'justify-center' : ''
        }`}
      >
        <span>{label}</span>
        {icon}
      </Link>
    );
  }

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

      <OrganizerPageHeader
        title="Hébergements"
        actions={(
          <Link
            href={withOrganizerQuery('/organisme/hebergements/new', selectedOrganizerId)}
            className="organizer-btn-primary"
          >
            Ajouter un hébergement
          </Link>
        )}
      />

      <div className="organizer-table-shell">
        <div className="overflow-x-auto">
          <table className="organizer-table min-w-[1120px] w-full table-fixed">
            <colgroup>
              <col className="w-[31%]" />
              <col className="w-[9%]" />
              <col className="w-[13%]" />
              <col className="w-[7%]" />
              <col className="w-[9%]" />
              <col className="w-[9%]" />
              <col className="w-[22%]" />
            </colgroup>
            <thead>
              <tr>
                <th className="px-4 py-3">{renderSortableHeader('Hébergement', 'name')}</th>
                <th className="px-4 py-3 text-center">{renderSortableHeader('Type', 'type', 'center')}</th>
                <th className="px-4 py-3 text-center">
                  {renderSortableHeader('Séjours liés', 'linkedStays', 'center')}
                </th>
                <th className="px-4 py-3 text-center">
                  {renderSortableHeader('Médias', 'mediaCount', 'center')}
                </th>
                <th className="px-4 py-3 text-center">
                  {renderSortableHeader('Statut', 'status', 'center')}
                </th>
                <th className="px-4 py-3 text-center">
                  {renderSortableHeader('Mis à jour', 'updatedAt', 'center')}
                </th>
                <th className="px-4 py-3 text-center"></th>
              </tr>
            </thead>
            <tbody>
              {accommodations.map((accommodation) => (
                <tr key={accommodation.id} className="border-t border-slate-100">
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900">{accommodation.name}</div>
                    {accommodation.locationLabel ? (
                      <div className="mt-1 text-xs font-semibold text-slate-700">{accommodation.locationLabel}</div>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-center text-slate-600">
                    {formatAccommodationType(accommodation.accommodation_type)}
                  </td>
                  <td className="px-4 py-3 text-center text-slate-600">
                    {accommodation.linkedStayTitles.length > 0 ? (
                      <AccommodationLinkedStaysDropdown stayTitles={accommodation.linkedStayTitles} />
                    ) : (
                      'Aucun'
                    )}
                  </td>
                  <td className="px-4 py-3 text-center text-slate-600">{accommodation.mediaCount}</td>
                  <td className="px-4 py-3 text-center text-slate-600">
                    <span
                      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${accommodationStatusBadgeClassName(accommodation.status)}`}
                    >
                      {accommodationStatusLabel(accommodation.status)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center text-slate-600">
                    {new Date(accommodation.updated_at).toLocaleDateString('fr-FR')}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-2 whitespace-nowrap">
                      <Link
                        href={withOrganizerQuery(`/organisme/hebergements/${accommodation.id}`, selectedOrganizerId)}
                        className="organizer-btn-secondary min-h-[36px] border-emerald-200 px-3 py-1 text-xs text-emerald-700 hover:border-emerald-300 hover:bg-emerald-50"
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
                          className={`inline-flex min-h-[36px] items-center rounded-lg px-3 py-1 text-xs font-semibold ${
                            accommodation.status === 'ARCHIVED'
                              ? 'border border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                              : 'border border-amber-200 text-amber-700 hover:bg-amber-50'
                          }`}
                        >
                          {accommodation.status === 'ARCHIVED' ? 'Désarchiver' : 'Archiver'}
                        </button>
                      </form>
                      <form action={deleteAccommodation}>
                        <input type="hidden" name="accommodation_id" value={accommodation.id} />
                        <button className="organizer-btn-danger min-h-[36px] px-3 py-1 text-xs">
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
