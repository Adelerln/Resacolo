'use client';

import { useEffect, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Loader2 } from 'lucide-react';

type RemainingPlacesEditorProps = {
  action: (formData: FormData) => void;
  initialValue: number;
  hiddenFields: Record<string, string>;
  inputClassName?: string;
  labelClassName?: string;
  buttonLabel?: string;
  inlineSubmit?: boolean;
  onDirtyChange?: (isDirty: boolean) => void;
  registerSubmit?: (submit: ((nextEditSessionId?: string) => void) | null) => void;
};

function RemainingPlacesFormFields({
  value,
  setValue,
  isDirty,
  computedLabelClassName,
  computedInputClassName,
  buttonLabel,
  inlineSubmit
}: {
  value: string;
  setValue: (next: string) => void;
  isDirty: boolean;
  computedLabelClassName: string;
  computedInputClassName: string;
  buttonLabel: string;
  inlineSubmit: boolean;
}) {
  const { pending } = useFormStatus();

  return (
    <>
      <label className={computedLabelClassName}>
        Places restantes
        <input
          name="remaining_places"
          type="number"
          min="0"
          step="1"
          required
          value={value}
          onChange={(event) => setValue(event.target.value)}
          className={computedInputClassName}
          disabled={pending}
        />
      </label>
      {isDirty && (
        <button
          type="submit"
          disabled={pending}
          aria-busy={pending}
          className={
            inlineSubmit
              ? 'inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-wait disabled:opacity-80'
              : 'fixed bottom-4 left-4 right-4 z-30 inline-flex items-center justify-center gap-2 rounded-full bg-emerald-600 px-5 py-3 text-sm font-semibold text-white shadow-lg disabled:cursor-wait disabled:opacity-80 sm:left-auto sm:right-4 sm:w-auto'
          }
        >
          {pending ? (
            <>
              <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
              <span>Enregistrement…</span>
            </>
          ) : (
            buttonLabel
          )}
        </button>
      )}
    </>
  );
}

export default function RemainingPlacesEditor({
  action,
  initialValue,
  hiddenFields,
  inputClassName,
  labelClassName,
  buttonLabel = 'Enregistrer',
  inlineSubmit = false,
  onDirtyChange,
  registerSubmit
}: RemainingPlacesEditorProps) {
  const formRef = useRef<HTMLFormElement | null>(null);
  const dirtyChangeRef = useRef(onDirtyChange);
  const registerSubmitRef = useRef(registerSubmit);
  const [value, setValue] = useState(String(initialValue));
  const isDirty = value !== String(initialValue);
  const computedLabelClassName = labelClassName
    ? `${labelClassName} inline-flex items-center gap-3`
    : 'inline-flex items-center gap-3 text-xs font-medium text-slate-600';
  const computedInputClassName = inputClassName
    ? `${inputClassName} ${isDirty ? 'bg-white' : 'bg-slate-100'}`
    : `w-20 rounded border border-slate-200 px-2 py-1 ${isDirty ? 'bg-white' : 'bg-slate-100'}`;

  useEffect(() => {
    dirtyChangeRef.current = onDirtyChange;
  }, [onDirtyChange]);

  useEffect(() => {
    registerSubmitRef.current = registerSubmit;
  }, [registerSubmit]);

  useEffect(() => {
    dirtyChangeRef.current?.(isDirty);
  }, [isDirty]);

  useEffect(() => {
    setValue(String(initialValue));
  }, [initialValue]);

  useEffect(() => {
    const register = registerSubmitRef.current;
    if (!register) return;
    register((nextEditSessionId) => {
      const form = formRef.current;
      if (!form) return;
      const nextSessionInput = form.elements.namedItem('next_edit_session_id');
      if (nextSessionInput instanceof HTMLInputElement) {
        nextSessionInput.value = nextEditSessionId ?? '';
      }
      form.requestSubmit();
    });
    return () => register(null);
  }, []);

  return (
    <form
      ref={formRef}
      action={action}
      className={
        inlineSubmit
          ? 'flex flex-col items-start gap-2'
          : 'flex flex-wrap items-center gap-2'
      }
    >
      {Object.entries(hiddenFields).map(([name, hiddenValue]) => (
        <input key={name} type="hidden" name={name} value={hiddenValue} />
      ))}
      <RemainingPlacesFormFields
        value={value}
        setValue={setValue}
        isDirty={isDirty}
        computedLabelClassName={computedLabelClassName}
        computedInputClassName={computedInputClassName}
        buttonLabel={buttonLabel}
        inlineSubmit={inlineSubmit}
      />
    </form>
  );
}
