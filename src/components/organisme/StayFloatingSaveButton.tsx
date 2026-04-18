'use client';

import StayEditSaveBar from '@/components/organisme/StayEditSaveBar';

type StayFloatingSaveButtonProps = {
  formId: string;
};

/** @deprecated Nom historique — utilise `StayEditSaveBar`. */
export default function StayFloatingSaveButton({ formId }: StayFloatingSaveButtonProps) {
  return <StayEditSaveBar formId={formId} />;
}
