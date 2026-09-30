import { NextResponse } from 'next/server';
import {
  applyStayCatalogFilters,
  buildStayCatalogFilterOptions,
  parseStayCatalogFiltersFromSearchParams
} from '@/lib/stay-catalog-filters';
import { getStays } from '@/lib/stays';
import { getServerSupabaseClient } from '@/lib/supabase/server';
import { slugify } from '@/lib/utils';

export const runtime = 'nodejs';

function formatPublicAgeRange(ageMin: number | null, ageMax: number | null) {
  if (ageMin != null && ageMax != null) return `${ageMin}-${ageMax} ans`;
  if (ageMin != null) return `À partir de ${ageMin} ans`;
  if (ageMax != null) return `Jusqu’à ${ageMax} ans`;
  return 'Âges non renseignés';
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const supabase = getServerSupabaseClient();

  const { data: bySlug } = await supabase
    .from('organizers')
    .select('id,name,slug,description,founded_year,age_min,age_max,logo_path,website_url')
    .eq('slug', slug)
    .maybeSingle();

  let organizerRow = bySlug;
  if (!organizerRow) {
    const { data: all } = await supabase
      .from('organizers')
      .select('id,name,slug,description,founded_year,age_min,age_max,logo_path,website_url');
    organizerRow = (all ?? []).find((item) => slugify(item.name) === slug) ?? null;
  }

  if (!organizerRow) {
    return NextResponse.json({ error: 'Organisateur non trouvé' }, { status: 404 });
  }

  const logoUrl = organizerRow.logo_path
    ? (
        await supabase.storage
          .from('organizer-logo')
          .createSignedUrl(organizerRow.logo_path, 60 * 60)
      ).data?.signedUrl ?? null
    : null;

  const organizer = {
    slug: organizerRow.slug ?? slugify(organizerRow.name),
    name: organizerRow.name,
    creationYear: organizerRow.founded_year,
    publicAgeRange: formatPublicAgeRange(organizerRow.age_min, organizerRow.age_max),
    logoUrl,
    description: organizerRow.description?.replace(/<[^>]+>/g, ' ').trim() || null,
    website: organizerRow.website_url ?? null
  };

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
