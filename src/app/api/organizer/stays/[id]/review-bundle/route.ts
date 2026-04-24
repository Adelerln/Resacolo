import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';
import { applyPublishedStayReviewPayload } from '@/lib/apply-published-stay-review-payload';
import { requireOrganizerApiAccess } from '@/lib/organizer-backoffice-access.server';
import { getServerSupabaseClient } from '@/lib/supabase/server';
import type { StayDraftReviewPayload } from '@/types/stay-draft-review';

export const runtime = 'nodejs';

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: stayId } = await params;
  const body = (await req.json().catch(() => null)) as
    | { organizerId?: string; payload?: StayDraftReviewPayload }
    | null;

  if (!body?.payload || typeof body.payload !== 'object') {
    return NextResponse.json({ error: 'Corps de requête invalide.' }, { status: 400 });
  }
  const access = await requireOrganizerApiAccess({
    requestedOrganizerId: body.organizerId,
    requiredSection: 'stays'
  });
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }
  const { selectedOrganizerId } = access.context;

  const supabase = getServerSupabaseClient();
  const result = await applyPublishedStayReviewPayload(
    supabase,
    stayId,
    selectedOrganizerId,
    body.payload
  );

  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: 400 });
  }

  revalidatePath(`/organisme/sejours/${stayId}`);
  revalidatePath(`/organisme/stays/${stayId}`);
  revalidatePath(`/organisme/stays/${stayId}/edit`);
  revalidatePath('/organisme/sejours');
  revalidatePath('/organisme/stays');
  revalidatePath('/sejours');

  return NextResponse.json({ ok: true, saved: true });
}
