import { NextResponse } from 'next/server';
import { getOrganizerBySlug } from '@/lib/mockOrganizers';
import { getStays, filterStays } from '@/lib/stays';

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
  const stays = filterStays(allStays, { organizer: organizer.name });

  return NextResponse.json({ organizer, stays });
}
