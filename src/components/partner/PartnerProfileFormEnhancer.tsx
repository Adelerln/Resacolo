'use client';

import UnsavedChangesWhen from '@/components/common/UnsavedChangesWhen';
import OrganizerProfileFormEnhancer from '@/components/organisme/OrganizerProfileFormEnhancer';
import { useFormDirty } from '@/components/common/form-dirty';

export default function PartnerProfileFormEnhancer({
  formId,
  resetToken
}: {
  formId: string;
  resetToken?: string;
}) {
  const isDirty = useFormDirty(formId);

  return (
    <>
      <UnsavedChangesWhen when={isDirty} />
      <OrganizerProfileFormEnhancer formId={formId} resetToken={resetToken} />
    </>
  );
}
