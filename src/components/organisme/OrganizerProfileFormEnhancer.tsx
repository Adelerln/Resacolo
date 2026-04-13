'use client';

import { useEffect, useState } from 'react';

type OrganizerProfileFormEnhancerProps = {
  formId: string;
  resetToken?: string;
};

const IDLE_CLASSES = ['bg-slate-100', 'border-slate-200'];
const DIRTY_CLASSES = ['bg-white', 'border-slate-300'];

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

function normalizeValue(field: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement) {
  if (field instanceof HTMLInputElement) {
    if (field.type === 'checkbox' || field.type === 'radio') {
      return field.checked ? '1' : '0';
    }
    if (field.type === 'file') {
      return field.files?.[0]?.name ?? '';
    }
  }

  return field.value;
}

function markFieldDirty(field: HTMLElement, isDirty: boolean) {
  field.classList.remove(...IDLE_CLASSES, ...DIRTY_CLASSES);
  field.classList.add(...(isDirty ? DIRTY_CLASSES : IDLE_CLASSES));
}

export default function OrganizerProfileFormEnhancer({
  formId,
  resetToken
}: OrganizerProfileFormEnhancerProps) {
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    const form = document.getElementById(formId);
    if (!(form instanceof HTMLFormElement)) return;

    const trackedFields = Array.from(
      form.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
        'input, textarea, select'
      )
    ).filter((field) => {
      if (field.type === 'submit' || field.type === 'button') return false;
      if (field.type === 'hidden') return field.dataset.trackDirty === 'true';
      return true;
    });
    const visualFields = trackedFields.filter(
      (field): field is HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement =>
        !(field instanceof HTMLInputElement && field.type === 'hidden')
    );

    const initialValues = new Map(trackedFields.map((field) => [field, normalizeValue(field)]));
    const initialSnapshot = serializeFormData(form);

    const syncState = () => {
      for (const field of visualFields) {
        markFieldDirty(field, normalizeValue(field) !== initialValues.get(field));
      }
      for (const field of trackedFields) {
        if (!(field instanceof HTMLInputElement) || field.type !== 'hidden') continue;
        const targetId = field.dataset.dirtyTarget;
        if (!targetId) continue;
        const target = document.getElementById(targetId);
        if (!target) continue;
        markFieldDirty(target, normalizeValue(field) !== initialValues.get(field));
      }
      setIsDirty(serializeFormData(form) !== initialSnapshot);
    };

    syncState();
    form.addEventListener('input', syncState);
    form.addEventListener('change', syncState);
    form.addEventListener('reset', syncState);

    return () => {
      form.removeEventListener('input', syncState);
      form.removeEventListener('change', syncState);
      form.removeEventListener('reset', syncState);
    };
  }, [formId, resetToken]);

  if (!isDirty) return null;

  return (
    <div className="pointer-events-none fixed right-4 bottom-4 z-40 flex justify-end sm:right-6 sm:bottom-6">
      <button
        type="submit"
        form={formId}
        className="pointer-events-auto w-full max-w-xs rounded-full bg-emerald-600 px-5 py-3 text-sm font-semibold text-white shadow-lg sm:w-auto sm:max-w-none"
      >
        Enregistrer
      </button>
    </div>
  );
}
