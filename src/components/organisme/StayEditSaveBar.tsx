'use client';

import UnsavedChangesWhen from '@/components/common/UnsavedChangesWhen';
import { useFormDirty } from '@/components/common/form-dirty';

/**
 * Barre d’enregistrement toujours visible sur la fiche séjour + garde anti-quitte si modifs.
 */
export default function StayEditSaveBar({ formId }: { formId: string }) {
  const isDirty = useFormDirty(formId);

  return (
    <>
      <UnsavedChangesWhen when={isDirty} />
      <div className="sticky bottom-3 z-10 flex justify-center sm:bottom-4 sm:justify-end">
        <button
          type="submit"
          form={formId}
          disabled={!isDirty}
          title={!isDirty ? 'Aucune modification à enregistrer' : undefined}
          className="w-full max-w-xs rounded-full bg-emerald-600 px-5 py-3 text-sm font-semibold text-white shadow-lg enabled:hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:max-w-none"
        >
          Enregistrer le séjour
        </button>
      </div>
    </>
  );
}
