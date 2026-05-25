'use client';

import { useMemo, useState } from 'react';

type ClickMultiSelectFieldProps = {
  label: string;
  name: string;
  options: string[];
  initialValues: string[];
  tone?: 'neutral' | 'positive' | 'negative';
  emptyMessage?: string;
};

function normalizeValue(value: string) {
  return value.trim().toLowerCase();
}

function withDisplayCaps(value: string) {
  const accentMap: Record<string, string> = {
    age: 'Âge',
    activite: 'Activité',
    activites: 'Activités',
    aout: 'Août',
    cote: 'Côte',
    ete: 'Été',
    ile: 'Île',
    iles: 'Îles',
    noel: 'Noël',
    sejour: 'Séjour',
    sejours: 'Séjours'
  };
  return value.replace(/\p{L}+/gu, (word) => {
    const normalized = word.toLowerCase();
    if (accentMap[normalized]) return accentMap[normalized];
    return word.charAt(0).toUpperCase() + word.slice(1);
  });
}

export default function ClickMultiSelectField({
  label,
  name,
  options,
  initialValues,
  tone = 'neutral',
  emptyMessage = 'Aucune option disponible'
}: ClickMultiSelectFieldProps) {
  const normalizedOptions = useMemo(
    () =>
      Array.from(new Set(options.map((option) => option.trim()).filter(Boolean))).sort((a, b) =>
        a.localeCompare(b, 'fr', { sensitivity: 'base' })
      ),
    [options]
  );

  const normalizedInitial = useMemo(() => {
    const selected = new Set(initialValues.map((value) => normalizeValue(value)));
    return normalizedOptions.filter((option) => selected.has(normalizeValue(option)));
  }, [initialValues, normalizedOptions]);

  const [selectedOptions, setSelectedOptions] = useState<string[]>(normalizedInitial);

  const toggleValue = (option: string) => {
    const key = normalizeValue(option);
    setSelectedOptions((current) => {
      const hasOption = current.some((item) => normalizeValue(item) === key);
      if (hasOption) {
        return current.filter((item) => normalizeValue(item) !== key);
      }
      return [...current, option];
    });
  };

  const toneClasses =
    tone === 'positive'
      ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
      : tone === 'negative'
        ? 'border-rose-300 bg-rose-50 text-rose-900'
        : 'border-slate-300 bg-slate-100 text-slate-800';
  const selectedToneClasses =
    tone === 'positive'
      ? 'border-emerald-400 bg-emerald-200 text-emerald-950'
      : tone === 'negative'
        ? 'border-rose-400 bg-rose-200 text-rose-950'
        : 'border-slate-400 bg-slate-200 text-slate-900';

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-slate-700">{label}</p>
      {normalizedOptions.length === 0 ? (
        <p className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-500">
          {emptyMessage}
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {normalizedOptions.map((option) => {
            const isSelected = selectedOptions.some(
              (item) => normalizeValue(item) === normalizeValue(option)
            );
            return (
              <button
                key={option}
                type="button"
                aria-pressed={isSelected}
                onClick={() => toggleValue(option)}
                className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:ring-offset-1 ${
                  isSelected ? selectedToneClasses : toneClasses
                }`}
              >
                {withDisplayCaps(option)}
              </button>
            );
          })}
        </div>
      )}
      {selectedOptions.map((option) => (
        <input key={`${name}-${option}`} type="hidden" name={name} value={option} />
      ))}
    </div>
  );
}
