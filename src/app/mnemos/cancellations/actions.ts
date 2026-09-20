'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireRole } from '@/lib/auth/require';
import { reviewCancellationRequest } from '@/lib/order-cancellation.server';
import { getServerSupabaseClient } from '@/lib/supabase/server';

export async function reviewCancellationAction(formData: FormData) {
  const session = await requireRole('MNEMOS');
  const requestId = String(formData.get('request_id') ?? '').trim();
  const decisionRaw = String(formData.get('decision') ?? '').trim();
  const reviewNote = String(formData.get('review_note') ?? '').trim();
  const decision = decisionRaw === 'APPROVED' || decisionRaw === 'REJECTED' ? decisionRaw : null;

  if (!requestId || !decision) {
    redirect('/mnemos/cancellations');
  }

  const supabase = getServerSupabaseClient();
  try {
    await reviewCancellationRequest({
      supabase,
      requestId,
      reviewerUserId: session.userId,
      decision,
      reviewNote: reviewNote || null
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Traitement impossible.';
    redirect(`/mnemos/cancellations/${requestId}?error=${encodeURIComponent(message)}`);
  }

  revalidatePath('/mnemos/cancellations');
  revalidatePath(`/mnemos/cancellations/${requestId}`);
  redirect(`/mnemos/cancellations/${requestId}?done=1`);
}
