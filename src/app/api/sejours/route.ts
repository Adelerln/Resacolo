import { NextRequest, NextResponse } from 'next/server';
import { buildQueryFromRequest, filterStays, getStays } from '@/lib/stays';

export const runtime = 'nodejs';
export const revalidate = 60 * 60; // 1 heure

export async function GET(req: NextRequest) {
  const forceRefresh = req.nextUrl.searchParams.get('refresh') === '1';

  const stays = await getStays({ forceRefresh });
  const filters = buildQueryFromRequest(req);
  const filtered = filterStays(stays, filters);

  return NextResponse.json({
    total: filtered.length,
    filters,
    stays: filtered
  });
}
