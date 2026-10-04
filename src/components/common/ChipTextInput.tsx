'use client';

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

type ChipTextInputProps = {
  values: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  inputClassName?: string;
  /** Suggestions optionnelles filtrées pendant la saisie. */
  suggestions?: string[];
};

function normalizeChip(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function sameChip(a: string, b: string) {
  return a.toLocaleLowerCase('fr') === b.toLocaleLowerCase('fr');
}

export default function ChipTextInput({
  values,
  onChange,
  placeholder = 'Saisissez un mot…',
  disabled = false,
  className,
  inputClassName,
  suggestions = []
}: ChipTextInputProps) {
  const listId = useId();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [draft, setDraft] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(0);

  const options = useMemo(() => {
    const query = normalizeChip(draft);
    if (!query) return [];

    const availableSuggestions = suggestions
      .map((item) => normalizeChip(item))
      .filter(Boolean)
      .filter((item) => !values.some((value) => sameChip(value, item)))
      .filter((item) => item.toLocaleLowerCase('fr').includes(query.toLocaleLowerCase('fr')));

    const deduped = Array.from(
      new Map(availableSuggestions.map((item) => [item.toLocaleLowerCase('fr'), item])).values()
    );

    const alreadySelected = values.some((value) => sameChip(value, query));
    const queryAlreadyInSuggestions = deduped.some((item) => sameChip(item, query));
    if (!alreadySelected && !queryAlreadyInSuggestions) {
      return [query, ...deduped];
    }
    return deduped;
  }, [draft, suggestions, values]);

  useEffect(() => {
    setHighlightIndex(0);
  }, [options]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function selectOption(raw: string) {
    const chip = normalizeChip(raw);
    if (!chip) return;
    if (values.some((value) => sameChip(value, chip))) {
      setDraft('');
      setIsOpen(false);
      return;
    }
    onChange([...values, chip]);
    setDraft('');
    setIsOpen(false);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown') {
      if (options.length === 0) return;
      event.preventDefault();
      setIsOpen(true);
      setHighlightIndex((current) => (current + 1) % options.length);
      return;
    }
    if (event.key === 'ArrowUp') {
      if (options.length === 0) return;
      event.preventDefault();
      setIsOpen(true);
      setHighlightIndex((current) => (current - 1 + options.length) % options.length);
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      setIsOpen(false);
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      if (isOpen && options[highlightIndex]) {
        selectOption(options[highlightIndex]);
      } else if (options[0]) {
        setIsOpen(true);
      }
      return;
    }
    if (event.key === 'Backspace' && draft.length === 0 && values.length > 0) {
      onChange(values.slice(0, -1));
    }
  }

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative min-h-[42px] rounded-lg border border-slate-200 bg-white px-2 py-1.5',
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
                onClick={() => onChange(values.filter((value) => value !== chip))}
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
          role="combobox"
          aria-expanded={isOpen && options.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          autoComplete="off"
          placeholder={values.length === 0 ? placeholder : 'Ajouter…'}
          onChange={(event) => {
            const next = event.target.value;
            setDraft(next);
            setIsOpen(normalizeChip(next).length > 0);
          }}
          onFocus={() => {
            if (normalizeChip(draft).length > 0) setIsOpen(true);
          }}
          onKeyDown={onKeyDown}
          className={cn(
            'min-w-[120px] flex-1 border-0 bg-transparent px-1 py-0.5 text-sm text-slate-900 outline-none placeholder:text-slate-400',
            inputClassName
          )}
        />
      </div>

      {isOpen && options.length > 0 ? (
        <div className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
          <ul id={listId} role="listbox" className="max-h-56 overflow-y-auto py-1">
            {options.map((option, index) => {
              const isHighlighted = index === highlightIndex;
              const isExactDraft = sameChip(option, draft);
              return (
                <li key={`${option}-${index}`} role="option" aria-selected={isHighlighted}>
                  <button
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => selectOption(option)}
                    onMouseEnter={() => setHighlightIndex(index)}
                    className={cn(
                      'flex w-full items-center justify-between px-3 py-2 text-left text-sm',
                      isHighlighted ? 'bg-sky-50 text-sky-950' : 'text-slate-800 hover:bg-slate-50'
                    )}
                  >
                    <span className="font-medium">{option}</span>
                    {isExactDraft ? (
                      <span className="text-[11px] font-medium text-slate-500">Ajouter</span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
