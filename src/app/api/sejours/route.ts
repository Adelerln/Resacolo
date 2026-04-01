import { NextRequest, NextResponse } from 'next/server';
import {
  applyStayCatalogFilters,
  buildStayCatalogFilterOptions,
  parseStayCatalogFiltersFromSearchParams
} from '@/lib/stay-catalog-filters';
import { getStays } from '@/lib/stays';

export const runtime = 'nodejs';
export const revalidate = 60 * 60; // 1 heure

export async function GET(req: NextRequest) {
  const forceRefresh = req.nextUrl.searchParams.get('refresh') === '1';

  const stays = await getStays({ forceRefresh });
  const options = buildStayCatalogFilterOptions(stays);
  const filters = parseStayCatalogFiltersFromSearchParams(req.nextUrl.searchParams, options);
  const filtered = applyStayCatalogFilters(stays, filters);

  return NextResponse.json({
    total: filtered.length,
    filters,
    options,
    stays: filtered
  });
}
