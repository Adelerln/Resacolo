'use client';

import { ChangeEvent } from 'react';
import clsx from 'clsx';
import { filterGroups } from '@/components/sejours/filterOptions';
import type { StayAudience, StayCategory, StayDuration, StayFilters as StayFiltersMeta } from '@/types/stay';

type StayPeriod = StayFiltersMeta['periods'][number];
type StayTransport = StayFiltersMeta['transport'][number];

export interface StayFilterState {
  q?: string;
  categories: StayCategory[];
  audiences: StayAudience[];
  durations: StayDuration[];
  periods: StayPeriod[];
  transport: StayTransport[];
  organizer: string[];
  priceMax?: number;
}

interface StayFiltersProps {
  value: StayFilterState;
  onChange: (value: StayFilterState) => void;
  onReset: () => void;
}

function toggleValue<TValue>(list: TValue[], value: TValue) {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

export function StayFilters({ value, onChange, onReset }: StayFiltersProps) {
  const handleCheckbox = <Key extends 'categories' | 'audiences' | 'durations' | 'periods' | 'transport' | 'organizer'>(
    key: Key,
    checkboxValue: StayFilterState[Key][number]
  ) => {
    const list = value[key];
    const updated = toggleValue(list, checkboxValue);
    onChange({ ...value, [key]: updated });
  };

  const handleSearch = (event: ChangeEvent<HTMLInputElement>) => {
    onChange({ ...value, q: event.target.value });
  };

  const handlePrice = (event: ChangeEvent<HTMLInputElement>) => {
    const next = Number.parseInt(event.target.value, 10);
    if (Number.isNaN(next)) {
      onChange({ ...value, priceMax: undefined });
    } else {
      onChange({ ...value, priceMax: next });
    }
  };

  return (
    <aside className="sticky top-24 flex h-[calc(100vh-8rem)] flex-col gap-6 overflow-auto rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="space-y-2">
        <h2 className="text-lg font-semibold text-slate-800">Rechercher</h2>
        <input
          type="search"
          placeholder="Mot-clé, destination, activité..."
          className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
          value={value.q ?? ''}
          onChange={handleSearch}
        />
      </div>
      <div className="space-y-4 text-sm text-slate-700">
        <section>
          <h3 className="font-semibold text-slate-800">Âges</h3>
          <div className="mt-2 flex flex-col gap-2">
            {filterGroups.audiences.map((option) => (
              <label key={option.value} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                  checked={value.audiences.includes(option.value)}
                  onChange={() => handleCheckbox('audiences', option.value)}
                />
                {option.label}
              </label>
            ))}
          </div>
        </section>
        <section>
          <h3 className="font-semibold text-slate-800">Thématiques</h3>
          <div className="mt-2 flex flex-col gap-2">
            {filterGroups.categories.map((option) => (
              <label key={option.value} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                  checked={value.categories.includes(option.value)}
                  onChange={() => handleCheckbox('categories', option.value)}
                />
                {option.label}
              </label>
            ))}
          </div>
        </section>
        <section>
          <h3 className="font-semibold text-slate-800">Périodes</h3>
          <div className="mt-2 flex flex-col gap-2">
            {filterGroups.periods.map((option) => (
              <label key={option.value} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                  checked={value.periods.includes(option.value)}
                  onChange={() => handleCheckbox('periods', option.value)}
                />
                {option.label}
              </label>
            ))}
          </div>
        </section>
        <section>
          <h3 className="font-semibold text-slate-800">Durée</h3>
          <div className="mt-2 flex flex-col gap-2">
            {filterGroups.durations.map((option) => (
              <label key={option.value} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                  checked={value.durations.includes(option.value)}
                  onChange={() => handleCheckbox('durations', option.value)}
                />
                {option.label}
              </label>
            ))}
          </div>
        </section>
        <section>
          <h3 className="font-semibold text-slate-800">Transport</h3>
          <div className="mt-2 flex flex-col gap-2">
            {filterGroups.transport.map((option) => (
              <label key={option.value} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                  checked={value.transport.includes(option.value)}
                  onChange={() => handleCheckbox('transport', option.value)}
                />
                {option.label}
              </label>
            ))}
          </div>
        </section>
        <section>
          <h3 className="font-semibold text-slate-800">Organisateur</h3>
          <div className="mt-2 flex flex-col gap-2">
            {filterGroups.organizers.map((option) => (
              <label key={option.value} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                  checked={value.organizer.includes(option.value)}
                  onChange={() => handleCheckbox('organizer', option.value)}
                />
                {option.label}
              </label>
            ))}
          </div>
        </section>
        <section>
          <h3 className="font-semibold text-slate-800">Budget maximum</h3>
          <input
            type="number"
            min={0}
            step={50}
            value={value.priceMax ?? ''}
            onChange={handlePrice}
            placeholder="Ex. 900"
            className="mt-2 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
          />
          <p className="mt-1 text-xs text-slate-500">Laisse vide pour ne pas filtrer sur le prix.</p>
        </section>
      </div>
      <button
        onClick={onReset}
        className={clsx(
          'mt-auto inline-flex justify-center rounded-md border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-brand-200 hover:text-brand-700'
        )}
      >
        Réinitialiser
      </button>
    </aside>
  );
}
