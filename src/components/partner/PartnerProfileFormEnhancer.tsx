'use client';

import type { ReactNode } from 'react';
import UnsavedChangesWhen from '@/components/common/UnsavedChangesWhen';
import OrganizerProfileFormEnhancer from '@/components/organisme/OrganizerProfileFormEnhancer';
import { useFormDirty } from '@/components/common/form-dirty';

export default function PartnerProfileFormEnhancer({
  formId,
  resetToken,
  submitSlot
}: {
  formId: string;
  resetToken?: string;
  /** Bouton d’enregistrement custom (ex. pending « Enregistrement… »). */
  submitSlot?: ReactNode;
}) {
  const isDirty = useFormDirty(formId, resetToken);

  return (
    <>
      <UnsavedChangesWhen when={isDirty} />
      {submitSlot ? (
        isDirty ? (
          <div className="pointer-events-none fixed right-4 bottom-4 z-40 flex justify-end sm:right-6 sm:bottom-6">
            {submitSlot}
          </div>
        ) : null
      ) : (
        <OrganizerProfileFormEnhancer formId={formId} resetToken={resetToken} />
      )}
    </>
  );
}
