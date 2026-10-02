import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';
import { requireOrganizerApiAccess } from '@/lib/organizer-backoffice-access.server';
import { applyDraftLinkedAccommodationChoice } from '@/lib/stay-draft-linked-accommodation';
import { getServerSupabaseClient } from '@/lib/supabase/server';
import type { Json } from '@/types/supabase';

export const runtime = 'nodejs';

function asObject(value: Json | null): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return { ...(value as Record<string, unknown>) };
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return {};
    }
  }
  return {};
}

function normalizeStatus(value: string | null | undefined): string {
  return String(value ?? '').trim().toLowerCase();
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = (await req.json().catch(() => null)) as {
    organizerId?: string;
    accommodationId?: string;
  } | null;

  const access = await requireOrganizerApiAccess({
    requestedOrganizerId: body?.organizerId,
    requiredSection: 'stays'
  });

  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const accommodationId = String(body?.accommodationId ?? '').trim();
  if (!accommodationId) {
    return NextResponse.json({ error: 'Hébergement requis.' }, { status: 400 });
  }

  const { selectedOrganizerId } = access.context;
  const supabase = getServerSupabaseClient();

  const { data: draft, error } = await supabase
    .from('stay_drafts')
    .select('id,organizer_id,status,raw_payload,accommodations_json')
    .eq('id', id)
    .eq('organizer_id', selectedOrganizerId)
    .maybeSingle();

  if (error || !draft) {
    return NextResponse.json(
      { error: error?.message ?? 'Brouillon introuvable.' },
      { status: 404 }
    );
  }

  const status = normalizeStatus(draft.status);
  if (status !== 'pending' && status !== 'draft' && status !== 'validated') {
    return NextResponse.json(
      { error: 'Seuls les brouillons non publiés peuvent rattacher un hébergement.' },
      { status: 400 }
    );
  }

  const { data: accommodation, error: accommodationError } = await supabase
    .from('accommodations')
    .select('id,name,accommodation_type')
    .eq('id', accommodationId)
    .eq('organizer_id', selectedOrganizerId)
    .maybeSingle();

  if (accommodationError || !accommodation) {
    return NextResponse.json(
      { error: accommodationError?.message ?? 'Hébergement introuvable pour cet organisateur.' },
      { status: 404 }
    );
  }

  const applied = applyDraftLinkedAccommodationChoice({
    rawPayload: asObject(draft.raw_payload),
    accommodationsJson: draft.accommodations_json,
    linkedAccommodationId: accommodation.id,
    linkedAccommodationName: accommodation.name
  });

  const { error: updateError } = await supabase
    .from('stay_drafts')
    .update({
      raw_payload: applied.rawPayload as Json,
      accommodations_json: applied.accommodationsJson,
      updated_at: new Date().toISOString()
    })
    .eq('id', draft.id)
    .eq('organizer_id', selectedOrganizerId);

  if (updateError) {
    return NextResponse.json(
      { error: updateError.message ?? "Impossible de rattacher l'hébergement." },
      { status: 500 }
    );
  }

  revalidatePath('/organisme/sejours');
  revalidatePath('/organisme/stays');
  revalidatePath(`/organisme/sejours/drafts/${id}`);
  revalidatePath(`/organisme/stays/drafts/${id}`);

  return NextResponse.json({
    success: true,
    accommodation: {
      id: accommodation.id,
      name: accommodation.name,
      accommodationType: accommodation.accommodation_type
    }
  });
}
