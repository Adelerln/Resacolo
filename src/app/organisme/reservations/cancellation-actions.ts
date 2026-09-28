'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireOrganizerPageAccess } from '@/lib/organizer-backoffice-access.server';
import { createOrganizerCancellationRequest } from '@/lib/order-cancellation.server';
import { parseAmountEurosToCents } from '@/lib/order-workflow';
import { withOrganizerQuery } from '@/lib/organizers.server';
import { getServerSupabaseClient } from '@/lib/supabase/server';

const CANCELLATION_DOCS_BUCKET = 'organizer-docs';
const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024;

const ALLOWED_ATTACHMENT_TYPES = new Set(['image/png', 'image/jpeg', 'application/pdf']);

function extensionForAttachment(file: File) {
  const fromName = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (fromName === 'png' || fromName === 'jpg' || fromName === 'jpeg' || fromName === 'pdf') {
    return fromName === 'jpeg' ? 'jpg' : fromName;
  }
  if (file.type === 'image/png') return 'png';
  if (file.type === 'image/jpeg') return 'jpg';
  if (file.type === 'application/pdf') return 'pdf';
  return null;
}

function isAllowedAttachment(file: File) {
  if (ALLOWED_ATTACHMENT_TYPES.has(file.type)) return true;
  return /\.(png|jpe?g|pdf)$/i.test(file.name);
}

async function uploadCancellationAttachment(input: {
  organizerId: string;
  orderId: string;
  file: File;
}) {
  if (!isAllowedAttachment(input.file)) {
    throw new Error('Format de pièce jointe non accepté (PNG, JPEG ou PDF).');
  }
  if (input.file.size > MAX_ATTACHMENT_BYTES) {
    throw new Error('Pièce jointe trop volumineuse (max. 8 Mo).');
  }

  const extension = extensionForAttachment(input.file);
  if (!extension) {
    throw new Error('Impossible de déterminer le format du fichier.');
  }

  const path = `organizers/${input.organizerId}/cancellations/${input.orderId}-${randomUUID()}.${extension}`;
  const buffer = Buffer.from(await input.file.arrayBuffer());
  const supabase = getServerSupabaseClient();
  const contentType =
    input.file.type ||
    (extension === 'pdf' ? 'application/pdf' : extension === 'png' ? 'image/png' : 'image/jpeg');

  const { error } = await supabase.storage.from(CANCELLATION_DOCS_BUCKET).upload(path, buffer, {
    upsert: false,
    contentType
  });

  if (error) {
    throw new Error(`Échec de l’envoi de la pièce jointe : ${error.message}`);
  }

  return path;
}

export async function submitOrganizerCancellationAction(formData: FormData) {
  const requestedOrganizerId = String(formData.get('organizer_id') ?? '').trim();
  const orderId = String(formData.get('order_id') ?? '').trim();
  const reason = String(formData.get('reason') ?? '').trim();
  const amountEuros = String(formData.get('amount_euros') ?? '').trim();
  const attachmentFile = formData.get('attachment');

  const organizerAccess = await requireOrganizerPageAccess({
    requestedOrganizerId,
    requiredSection: 'reservations',
    forServerAction: true
  });
  const organizerId = organizerAccess.selectedOrganizerId;
  const userId = organizerAccess.session.userId;

  if (!organizerId || !orderId) {
    redirect(withOrganizerQuery('/organisme/reservations', organizerId));
  }

  const amountCents = amountEuros ? parseAmountEurosToCents(amountEuros) : null;
  const supabase = getServerSupabaseClient();

  try {
    let attachmentPath: string | null = null;
    if (attachmentFile instanceof File && attachmentFile.size > 0) {
      attachmentPath = await uploadCancellationAttachment({
        organizerId,
        orderId,
        file: attachmentFile
      });
    }

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
  redirect(withOrganizerQuery('/organisme/reservations?cancelled=1', organizerId));
}
