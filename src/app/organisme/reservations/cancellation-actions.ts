'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireOrganizerPageAccess } from '@/lib/organizer-backoffice-access.server';
import { createOrganizerCancellationRequest } from '@/lib/order-cancellation.server';
import { parseAmountEurosToCents } from '@/lib/order-workflow';
import { withOrganizerQuery } from '@/lib/organizers.server';
import { getServerSupabaseClient } from '@/lib/supabase/server';

export async function submitOrganizerCancellationAction(formData: FormData) {
  const requestedOrganizerId = String(formData.get('organizer_id') ?? '').trim();
  const orderId = String(formData.get('order_id') ?? '').trim();
  const reason = String(formData.get('reason') ?? '').trim();
  const amountEuros = String(formData.get('amount_euros') ?? '').trim();
  const attachmentPath = String(formData.get('attachment_path') ?? '').trim() || null;

  const organizerAccess = await requireOrganizerPageAccess({
    requestedOrganizerId,
    requiredSection: 'reservations'
  });
  const organizerId = organizerAccess.selectedOrganizerId;
  const userId = organizerAccess.session.userId;

  if (!organizerId || !orderId) {
    redirect(withOrganizerQuery('/organisme/reservations', organizerId));
  }

  const amountCents = amountEuros ? parseAmountEurosToCents(amountEuros) : null;
  const supabase = getServerSupabaseClient();

  try {
    await createOrganizerCancellationRequest({
      supabase,
      orderId,
      organizerId,
      userId,
      reason,
      attachmentPath,
      amountCents
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Annulation impossible.';
    redirect(
      withOrganizerQuery(
        `/organisme/reservations?error=${encodeURIComponent(message)}`,
        organizerId
      )
    );
  }

  revalidatePath(withOrganizerQuery('/organisme/reservations', organizerId));
  revalidatePath('/mnemos/cancellations');
  redirect(
    withOrganizerQuery('/organisme/reservations?cancelled=1', organizerId)
  );
}
