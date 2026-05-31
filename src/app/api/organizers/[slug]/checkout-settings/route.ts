import { NextResponse } from 'next/server';
import { getServerSupabaseClient } from '@/lib/supabase/server';
import { isMissingAnyColumnError } from '@/lib/supabase-schema-errors';

export const runtime = 'nodejs';

export async function GET(_: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug: idOrSlug } = await params;
  const supabase = getServerSupabaseClient();

  let { data: organizer, error } = await supabase
    .from('organizers')
    .select('id,name,accepts_ancv_paper,accepts_ancv_connect,is_vacaf_approved')
    .eq('slug', idOrSlug)
    .maybeSingle();

  if (error && isMissingAnyColumnError(error, ['accepts_ancv_paper', 'accepts_ancv_connect', 'is_vacaf_approved'])) {
    let { data: fallbackOrganizer } = await supabase
      .from('organizers')
      .select('id,name')
      .eq('slug', idOrSlug)
      .maybeSingle();
    if (!fallbackOrganizer) {
      const { data: fallbackById } = await supabase
        .from('organizers')
        .select('id,name')
        .eq('id', idOrSlug)
        .maybeSingle();
      fallbackOrganizer = fallbackById ?? null;
    }

    if (!fallbackOrganizer) {
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
      organizerId: fallbackOrganizer.id,
      organizerName: fallbackOrganizer.name,
      acceptsAncvPaper: false,
      acceptsAncvConnect: false,
      isVacafApproved: false
    });
  }

  if (!organizer) {
    const second = await supabase
      .from('organizers')
      .select('id,name,accepts_ancv_paper,accepts_ancv_connect,is_vacaf_approved')
      .eq('id', idOrSlug)
      .maybeSingle();
    organizer = second.data ?? null;
    error = second.error;
  }

  if (error) {
    return NextResponse.json(
      { error: `Impossible de charger les modalités de réservation de l'organisme : ${error.message}` },
      { status: 500 }
    );
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
