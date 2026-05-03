'use client';

import { useDeferredValue, useId, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import type { OrganizerAccommodationOption } from '@/lib/organisme-accommodation-options';
import { cn } from '@/lib/utils';

type AccommodationPickerProps = {
  options: OrganizerAccommodationOption[];
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  name?: string;
  disabled?: boolean;
  className?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
};

export default function AccommodationPicker({
  options,
  value,
  defaultValue = '',
  onChange,
  name,
  disabled = false,
  className,
  searchPlaceholder = 'Rechercher un hébergement',
  emptyMessage = 'Aucun hébergement correspondant.'
}: AccommodationPickerProps) {
  const searchId = useId();
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const [internalValue, setInternalValue] = useState(defaultValue);
  const selectedValue = value ?? internalValue;

  const filteredOptions = useMemo(() => {
    const normalizedSearch = deferredSearch
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();

    if (!normalizedSearch) return options;

    return options.filter((option) =>
      option.searchText
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .includes(normalizedSearch)
    );
  }, [deferredSearch, options]);

  function updateValue(nextValue: string) {
    if (value === undefined) {
      setInternalValue(nextValue);
    }
    onChange?.(nextValue);
  }

  return (
    <div className={cn('space-y-3', className)}>
      {name ? <input type="hidden" name={name} value={selectedValue} /> : null}

      <label htmlFor={searchId} className="block text-sm font-medium text-slate-700">
        Rechercher un hébergement
      </label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          id={searchId}
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={searchPlaceholder}
          disabled={disabled}
          className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-orange-300 focus:ring-2 focus:ring-orange-100 disabled:cursor-not-allowed disabled:bg-slate-50"
        />
      </div>

      <div className="max-h-72 overflow-y-auto rounded-xl border border-slate-200 bg-white">
        {filteredOptions.length > 0 ? (
          <ul className="divide-y divide-slate-100">
            {filteredOptions.map((option) => {
              const checked = option.id === selectedValue;
              return (
                <li key={option.id}>
                  <label
                    className={cn(
                      'flex cursor-pointer items-start gap-3 px-4 py-3 transition hover:bg-slate-50',
                      checked && 'bg-orange-50/70'
                    )}
                  >
                    <input
                      type="radio"
                      name={`${name ?? searchId}-choice`}
                      value={option.id}
                      checked={checked}
                      onChange={() => updateValue(option.id)}
                      disabled={disabled}
                      className="mt-1 h-4 w-4 border-slate-300 text-orange-600"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium text-slate-900">{option.label}</span>
                      {option.meta ? (
                        <span className="mt-1 block text-xs font-semibold text-slate-700">{option.meta}</span>
                      ) : null}
                      {option.description ? (
                        <span className="mt-1 block text-xs text-slate-500">{option.description}</span>
                      ) : null}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="px-4 py-4 text-sm text-slate-500">{emptyMessage}</p>
        )}
      </div>
    </div>
  );
}
