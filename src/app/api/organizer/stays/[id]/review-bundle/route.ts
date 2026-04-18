import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { applyPublishedStayReviewPayload } from '@/lib/apply-published-stay-review-payload';
import { resolveOrganizerSelection } from '@/lib/organizers.server';
import { mockOrganizerTenant } from '@/lib/mocks';
import { getServerSupabaseClient } from '@/lib/supabase/server';
import type { StayDraftReviewPayload } from '@/types/stay-draft-review';

export const runtime = 'nodejs';

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const isMockMode = process.env.MOCK_UI === '1' || process.env.DISABLE_AUTH === '1';
  const session = await getSession();

  if (!isMockMode && (!session || session.role !== 'ORGANISATEUR')) {
    return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 });
  }

  const { id: stayId } = await params;
  const body = (await req.json().catch(() => null)) as
    | { organizerId?: string; payload?: StayDraftReviewPayload }
    | null;

  if (!body?.payload || typeof body.payload !== 'object') {
    return NextResponse.json({ error: 'Corps de requête invalide.' }, { status: 400 });
  }

  const fallbackOrganizerId = isMockMode ? mockOrganizerTenant.id : session?.tenantId ?? null;
  const { selectedOrganizerId } = await resolveOrganizerSelection(body.organizerId, fallbackOrganizerId);

  if (!selectedOrganizerId) {
    return NextResponse.json({ error: 'Aucun organisateur disponible.' }, { status: 400 });
  }

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
