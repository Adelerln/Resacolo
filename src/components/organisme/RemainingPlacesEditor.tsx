'use client';

import { useState } from 'react';

type RemainingPlacesEditorProps = {
  action: (formData: FormData) => void;
  initialValue: number;
  hiddenFields: Record<string, string>;
  inputClassName?: string;
  labelClassName?: string;
  buttonLabel?: string;
};

export default function RemainingPlacesEditor({
  action,
  initialValue,
  hiddenFields,
  inputClassName,
  labelClassName,
  buttonLabel = 'Enregistrer'
}: RemainingPlacesEditorProps) {
  const [value, setValue] = useState(String(initialValue));
  const isDirty = value !== String(initialValue);
  const computedLabelClassName = labelClassName
    ? `${labelClassName} inline-flex items-center gap-3`
    : 'inline-flex items-center gap-3 text-xs font-medium text-slate-600';
  const computedInputClassName = inputClassName
    ? `${inputClassName} ${isDirty ? 'bg-white' : 'bg-slate-100'}`
    : `w-20 rounded border border-slate-200 px-2 py-1 ${isDirty ? 'bg-white' : 'bg-slate-100'}`;

  return (
    <form action={action} className="flex items-center gap-2">
      {Object.entries(hiddenFields).map(([name, hiddenValue]) => (
        <input key={name} type="hidden" name={name} value={hiddenValue} />
      ))}
      <label className={computedLabelClassName}>
        Places restantes
        <input
          name="remaining_places"
          type="number"
          min="0"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          className={computedInputClassName}
        />
      </label>
      {isDirty && (
        <button
          type="submit"
          className="fixed bottom-4 right-4 z-30 rounded-full bg-emerald-600 px-5 py-3 text-sm font-semibold text-white shadow-lg"
        >
          {buttonLabel}
        </button>
      )}
    </form>
  );
}
