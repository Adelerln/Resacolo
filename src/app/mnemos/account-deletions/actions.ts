'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireRole } from '@/lib/auth/require';
import { isAccountDeletionStatus } from '@/lib/account-deletion';
import { updateAccountDeletionRequestStatus } from '@/lib/account-deletion.server';

export async function updateAccountDeletionRequest(formData: FormData) {
  const session = await requireRole('MNEMOS');
  const id = String(formData.get('id') ?? '').trim();
  if (!id) redirect('/mnemos/account-deletions');

  const status = String(formData.get('status') ?? '').trim();
  const notes = String(formData.get('notes') ?? '');

  if (!isAccountDeletionStatus(status)) {
    redirect(`/mnemos/account-deletions/${id}?err=${encodeURIComponent('Statut invalide.')}`);
  }

  try {
    await updateAccountDeletionRequestStatus({
      id,
      status,
      notes,
      processedBy: session.userId
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Mise à jour impossible.';
    redirect(`/mnemos/account-deletions/${id}?err=${encodeURIComponent(message)}`);
  }

  revalidatePath('/mnemos/account-deletions');
  revalidatePath(`/mnemos/account-deletions/${id}`);
  redirect(`/mnemos/account-deletions/${id}?saved=1`);
}
