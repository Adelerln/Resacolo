import Link from 'next/link';
import { extractAccommodationLocationMeta } from '@/lib/accommodation-location';
import { requireAdminSection } from '@/lib/auth/require';
import { formatAccommodationType } from '@/lib/accommodation-types';
import { getServerSupabaseClient } from '@/lib/supabase/server';
import { accommodationStatusBadgeClassName, accommodationStatusLabel } from '@/lib/ui/labels';

type PageProps = {
  searchParams?: Promise<{
    organizerId?: string | string[];
  }>;
};

function getSingleParam(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function AdminAccommodationsPage({ searchParams }: PageProps) {
  await requireAdminSection('accommodations');
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const requestedOrganizerId = getSingleParam(resolvedSearchParams?.organizerId)?.trim() ?? '';
  const supabase = getServerSupabaseClient();

  const { data: organizersRaw, error: organizersError } = await supabase
    .from('organizers')
    .select('id,name')
    .order('name', { ascending: true });

  if (organizersError) {
    throw new Error(`Impossible de charger les organisateurs : ${organizersError.message}`);
  }

  const organizers = organizersRaw ?? [];
  const organizersById = new Map(organizers.map((organizer) => [organizer.id, organizer.name]));
  const selectedOrganizerId = organizersById.has(requestedOrganizerId) ? requestedOrganizerId : '';

  let accommodationsQuery = supabase
    .from('accommodations')
    .select(
      'id,name,organizer_id,accommodation_type,location_mode,itinerant_zone,address_text,postal_code,city,department_code,region_text,country,description,status,updated_at'
    )
    .order('updated_at', { ascending: false });

  if (selectedOrganizerId) {
    accommodationsQuery = accommodationsQuery.eq('organizer_id', selectedOrganizerId);
  }

  const { data: accommodationsRaw, error: accommodationsError } = await accommodationsQuery;

  if (accommodationsError) {
    throw new Error(`Impossible de charger les hébergements : ${accommodationsError.message}`);
  }

  const accommodations = accommodationsRaw ?? [];
  const accommodationIds = accommodations.map((accommodation) => accommodation.id);

  const { data: stayLinksRaw, error: stayLinksError } = accommodationIds.length
    ? await supabase
        .from('stay_accommodations')
        .select('accommodation_id,stay_id')
        .in('accommodation_id', accommodationIds)
    : { data: [], error: null };

  if (stayLinksError) {
    throw new Error(`Impossible de charger les liens hébergements/séjours : ${stayLinksError.message}`);
  }

  const stayIds = Array.from(new Set((stayLinksRaw ?? []).map((link) => link.stay_id)));
  const { data: staysRaw, error: staysError } = stayIds.length
    ? await supabase.from('stays').select('id,title').in('id', stayIds)
    : { data: [], error: null };

  if (staysError) {
    throw new Error(`Impossible de charger les séjours liés : ${staysError.message}`);
  }

  const stayTitleById = new Map((staysRaw ?? []).map((stay) => [stay.id, stay.title]));
  const linkedStayTitlesByAccommodationId = new Map<string, string[]>();

  for (const link of stayLinksRaw ?? []) {
    const stayTitle = stayTitleById.get(link.stay_id);
    if (!stayTitle) continue;

    const existing = linkedStayTitlesByAccommodationId.get(link.accommodation_id) ?? [];
    existing.push(stayTitle);
    linkedStayTitlesByAccommodationId.set(link.accommodation_id, existing);
  }

  const rows = accommodations.map((accommodation) => {
    const locationMeta = extractAccommodationLocationMeta(accommodation.description, {
      accommodationType: accommodation.accommodation_type,
      locationMode: accommodation.location_mode,
      itinerantZone: accommodation.itinerant_zone,
      addressText: accommodation.address_text,
      postalCode: accommodation.postal_code,
      city: accommodation.city,
      departmentCode: accommodation.department_code,
      regionText: accommodation.region_text,
      country: accommodation.country
    });
    const linkedStayTitles = (linkedStayTitlesByAccommodationId.get(accommodation.id) ?? []).sort((left, right) =>
      left.localeCompare(right, 'fr', { sensitivity: 'base' })
    );

    return {
      ...accommodation,
      linkedStayTitles,
      locationLabel: locationMeta.locationLabel
    };
  });

  const selectedOrganizerName = selectedOrganizerId ? organizersById.get(selectedOrganizerId) ?? null : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="admin-page-title">Tous les hébergements</h1>
        <p className="admin-page-subtitle mt-1">
          Visualisation des hébergements créés par les organisateurs, avec filtre par organisme.
        </p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <form method="get" className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="w-full max-w-md">
            <label htmlFor="organizerId" className="block text-sm font-semibold text-slate-900">
              Organisateur
            </label>
            <select
              id="organizerId"
              name="organizerId"
              defaultValue={selectedOrganizerId}
              className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900"
            >
              <option value="">Tous les organisateurs</option>
              {organizers.map((organizer) => (
                <option key={organizer.id} value={organizer.id}>
                  {organizer.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-3">
            <button className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800">
              Filtrer
            </button>
            <Link
              href="/admin/hebergements"
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Réinitialiser
            </Link>
          </div>
        </form>

        <div className="mt-4 flex flex-wrap gap-3 text-sm text-slate-600">
          <div className="rounded-full bg-slate-100 px-3 py-1.5">
            {rows.length} hébergement{rows.length > 1 ? 's' : ''}
          </div>
          <div className="rounded-full bg-slate-100 px-3 py-1.5">
            Filtre : {selectedOrganizerName ?? 'Tous les organisateurs'}
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="min-w-[1120px] w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Hébergement</th>
                <th className="px-4 py-3">Organisateur</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Localisation</th>
                <th className="px-4 py-3">Séjours liés</th>
                <th className="px-4 py-3">Statut</th>
                <th className="px-4 py-3">Mis à jour</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-slate-100 align-top">
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900">{row.name}</div>
                    <div className="mt-1 text-xs text-slate-500">{row.id}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    <Link
                      href={`/admin/organizers/${row.organizer_id}`}
                      className="font-medium text-slate-700 hover:text-slate-900 hover:underline"
                    >
                      {organizersById.get(row.organizer_id) ?? 'Organisateur inconnu'}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{formatAccommodationType(row.accommodation_type)}</td>
                  <td className="px-4 py-3 text-slate-600">{row.locationLabel ?? 'Non renseignée'}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {row.linkedStayTitles.length > 0 ? row.linkedStayTitles.join(', ') : 'Aucun'}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    <span
                      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${accommodationStatusBadgeClassName(row.status)}`}
                    >
                      {accommodationStatusLabel(row.status)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {new Date(row.updated_at).toLocaleDateString('fr-FR')}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td className="px-4 py-6 text-slate-500" colSpan={7}>
                    Aucun hébergement trouvé pour ce filtre.
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
