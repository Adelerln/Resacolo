import { NextResponse } from 'next/server';
import { getServerSupabaseClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

export async function GET(_: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug: idOrSlug } = await params;
  const supabase = getServerSupabaseClient();

  let { data: organizer } = await supabase
    .from('organizers')
    .select('id,name,accepts_ancv_paper,accepts_ancv_connect,is_vacaf_approved')
    .eq('slug', idOrSlug)
    .maybeSingle();

  if (!organizer) {
    const { data: byId } = await supabase
      .from('organizers')
      .select('id,name,accepts_ancv_paper,accepts_ancv_connect,is_vacaf_approved')
      .eq('id', idOrSlug)
      .maybeSingle();
    organizer = byId ?? null;
  }

  if (!organizer) {
    return NextResponse.json(
      {
        acceptsAncvPaper: false,
        acceptsAncvConnect: false,
        isVacafApproved: false
      },
      { status: 404 }
    );
  }

  return NextResponse.json({
    organizerId: organizer.id,
    organizerName: organizer.name,
    acceptsAncvPaper: organizer.accepts_ancv_paper,
    acceptsAncvConnect: organizer.accepts_ancv_connect,
    isVacafApproved: organizer.is_vacaf_approved
  });
}
