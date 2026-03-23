'use client';

import { useEffect, useState } from 'react';

type OrganizerProfileFormEnhancerProps = {
  formId: string;
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

function markFieldDirty(
  field: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
  isDirty: boolean
) {
  field.classList.remove(...IDLE_CLASSES, ...DIRTY_CLASSES);
  field.classList.add(...(isDirty ? DIRTY_CLASSES : IDLE_CLASSES));
}

export default function OrganizerProfileFormEnhancer({
  formId
}: OrganizerProfileFormEnhancerProps) {
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    const form = document.getElementById(formId);
    if (!(form instanceof HTMLFormElement)) return;

    const fields = Array.from(
      form.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
        'input, textarea, select'
      )
    ).filter((field) => field.type !== 'hidden' && field.type !== 'submit' && field.type !== 'button');

    const initialValues = new Map(fields.map((field) => [field, normalizeValue(field)]));
    const initialSnapshot = serializeFormData(form);

    const syncState = () => {
      for (const field of fields) {
        markFieldDirty(field, normalizeValue(field) !== initialValues.get(field));
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
  }, [formId]);

  if (!isDirty) return null;

  return (
    <div className="sticky bottom-4 z-10 flex justify-end">
      <button
        type="submit"
        form={formId}
        className="rounded-full bg-emerald-600 px-5 py-3 text-sm font-semibold text-white shadow-lg"
      >
        Enregistrer
      </button>
    </div>
  );
}
