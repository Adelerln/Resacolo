'use client';

import { useEffect, useRef, useState } from 'react';

type StayFloatingSaveButtonProps = {
  formId: string;
};

function serializeFormData(form: HTMLFormElement) {
  const entries = Array.from(new FormData(form).entries()).map(([key, value]) => [
    key,
    typeof value === 'string' ? value : value.name
  ]);

  entries.sort(([keyA, valueA], [keyB, valueB]) => {
    if (keyA === keyB) {
      return String(valueA).localeCompare(String(valueB), 'fr');
    }
    return keyA.localeCompare(keyB, 'fr');
  });

  return JSON.stringify(entries);
}

export default function StayFloatingSaveButton({ formId }: StayFloatingSaveButtonProps) {
  const [isDirty, setIsDirty] = useState(false);
  const initialSnapshotRef = useRef<string | null>(null);
  const hasUserInteractedRef = useRef(false);

  useEffect(() => {
    const form = document.getElementById(formId);
    if (!(form instanceof HTMLFormElement)) return;

    initialSnapshotRef.current = serializeFormData(form);
    hasUserInteractedRef.current = false;
    setIsDirty(false);

    const syncDirtyState = () => {
      const initialSnapshot = initialSnapshotRef.current;
      if (!initialSnapshot) return;
      setIsDirty(serializeFormData(form) !== initialSnapshot);
    };

    const handlePotentialUserChange = () => {
      hasUserInteractedRef.current = true;
      syncDirtyState();
    };

    const settleTimeout = window.setTimeout(() => {
      if (!hasUserInteractedRef.current) {
        initialSnapshotRef.current = serializeFormData(form);
        setIsDirty(false);
      }
    }, 400);

    form.addEventListener('input', handlePotentialUserChange);
    form.addEventListener('change', handlePotentialUserChange);
    form.addEventListener('reset', handlePotentialUserChange);

    return () => {
      window.clearTimeout(settleTimeout);
      form.removeEventListener('input', handlePotentialUserChange);
      form.removeEventListener('change', handlePotentialUserChange);
      form.removeEventListener('reset', handlePotentialUserChange);
    };
  }, [formId]);

  if (!isDirty) return null;

  return (
    <div className="sticky bottom-4 z-10 flex justify-end">
      <button
        type="submit"
        form={formId}
        className="rounded-full bg-emerald-600 px-5 py-3 text-sm font-semibold text-white shadow-lg"
      >
        Enregistrer le séjour
      </button>
    </div>
  );
}
