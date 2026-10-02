'use client';

import { useState, type KeyboardEvent } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

type ChipTextInputProps = {
  values: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  inputClassName?: string;
};

function normalizeChip(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

export default function ChipTextInput({
  values,
  onChange,
  placeholder = 'Saisissez un mot puis Entrée',
  disabled = false,
  className,
  inputClassName
}: ChipTextInputProps) {
  const [draft, setDraft] = useState('');

  function commitDraft(raw: string) {
    const chip = normalizeChip(raw);
    if (!chip) return;
    const exists = values.some((v) => v.toLocaleLowerCase('fr') === chip.toLocaleLowerCase('fr'));
    if (exists) {
      setDraft('');
      return;
    }
    onChange([...values, chip]);
    setDraft('');
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      commitDraft(draft);
      return;
    }
    if (event.key === 'Backspace' && draft.length === 0 && values.length > 0) {
      onChange(values.slice(0, -1));
    }
  }

  return (
    <div
      className={cn(
        'min-h-[42px] rounded-lg border border-slate-200 bg-white px-2 py-1.5',
        disabled && 'bg-slate-50 opacity-70',
        className
      )}
    >
      <div className="flex flex-wrap items-center gap-1.5">
        {values.map((chip) => (
          <span
            key={chip}
            className="inline-flex max-w-full items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-800"
          >
            <span className="truncate">{chip}</span>
            {!disabled ? (
              <button
                type="button"
                onClick={() => onChange(values.filter((v) => v !== chip))}
                className="rounded-full p-0.5 text-slate-500 hover:bg-slate-200 hover:text-slate-800"
                aria-label={`Retirer ${chip}`}
              >
                <X className="h-3 w-3" />
              </button>
            ) : null}
          </span>
        ))}
        <input
          type="text"
          value={draft}
          disabled={disabled}
          placeholder={values.length === 0 ? placeholder : 'Ajouter…'}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={onKeyDown}
          onBlur={() => commitDraft(draft)}
          className={cn(
            'min-w-[120px] flex-1 border-0 bg-transparent px-1 py-0.5 text-sm text-slate-900 outline-none placeholder:text-slate-400',
            inputClassName
          )}
        />
      </div>
    </div>
  );
}
