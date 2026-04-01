import { NextResponse } from 'next/server';
import { getOrganizerBySlug } from '@/lib/mockOrganizers';
import {
  applyStayCatalogFilters,
  buildStayCatalogFilterOptions,
  parseStayCatalogFiltersFromSearchParams
} from '@/lib/stay-catalog-filters';
import { getStays } from '@/lib/stays';

export const runtime = 'nodejs';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const organizer = getOrganizerBySlug(slug);

  if (!organizer) {
    return NextResponse.json({ error: 'Organisateur non trouvé' }, { status: 404 });
  }

  const allStays = await getStays();
  const options = buildStayCatalogFilterOptions(allStays);
  const searchParams = new URLSearchParams();
  searchParams.set('organizer', organizer.name);
  const filters = parseStayCatalogFiltersFromSearchParams(searchParams, options);
  const stays =
    filters.organizerIds.length > 0
      ? applyStayCatalogFilters(allStays, filters)
      : allStays.filter((stay) =>
          stay.organizer.name.toLowerCase().includes(organizer.name.toLowerCase())
        );

  return NextResponse.json({ organizer, stays });
}
