'use client';

import { useMemo, useState } from 'react';

type CountryDropdownFieldProps = {
  label: string;
  name: string;
  options: string[];
  initialValues: string[];
};

function normalizeValue(value: string) {
  return value.trim().toLowerCase();
}

function withDisplayCaps(value: string) {
  const accentMap: Record<string, string> = {
    cote: 'Côte',
    emirats: 'Émirats',
    etats: 'États',
    ile: 'Île',
    iles: 'Îles'
  };
  return value.replace(/\p{L}+/gu, (word) => {
    const normalized = word.toLowerCase();
    if (accentMap[normalized]) return accentMap[normalized];
    return word.charAt(0).toUpperCase() + word.slice(1);
  });
}

export default function CountryDropdownField({
  label,
  name,
  options,
  initialValues
}: CountryDropdownFieldProps) {
  const normalizedOptions = useMemo(
    () =>
      Array.from(new Set(options.map((option) => option.trim()).filter(Boolean))).sort((a, b) =>
        a.localeCompare(b, 'fr', { sensitivity: 'base' })
      ),
    [options]
  );

  const normalizedInitialValues = useMemo(() => {
    const seen = new Set<string>();
    const values: string[] = [];
    for (const value of initialValues) {
      const next = value.trim();
      if (!next) continue;
      const key = normalizeValue(next);
      if (seen.has(key)) continue;
      seen.add(key);
      values.push(next);
    }
    return values;
  }, [initialValues]);

  const [selectedCountries, setSelectedCountries] = useState<string[]>(normalizedInitialValues);
  const [selectedOption, setSelectedOption] = useState<string>('');

  const addCountry = (country: string) => {
    const value = country.trim();
    if (!value) return;
    const key = normalizeValue(value);
    setSelectedCountries((current) => {
      if (current.some((item) => normalizeValue(item) === key)) return current;
      return [...current, value];
    });
  };

  const removeCountry = (country: string) => {
    const key = normalizeValue(country);
    setSelectedCountries((current) => current.filter((item) => normalizeValue(item) !== key));
  };

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-slate-700">{label}</p>
      <div className="rounded-lg border border-slate-200 bg-slate-100 p-2">
        {normalizedOptions.length > 0 ? (
          <div className="flex items-center gap-2">
            <select
              value={selectedOption}
              onChange={(event) => setSelectedOption(event.target.value)}
              className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
            >
              <option value="">Sélectionner un pays</option>
              {normalizedOptions.map((option) => (
                <option key={option} value={option}>
                  {withDisplayCaps(option)}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => {
                addCountry(selectedOption);
                setSelectedOption('');
              }}
              className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
            >
              Ajouter
            </button>
          </div>
        ) : (
          <p className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-500">
            Aucun pays disponible
          </p>
        )}

        <div className="mt-2 flex flex-wrap gap-2">
          {selectedCountries.length === 0 ? (
            <span className="text-xs text-slate-500">Aucun pays sélectionné</span>
          ) : null}
          {selectedCountries.map((country) => (
            <button
              key={country}
              type="button"
              onClick={() => removeCountry(country)}
              className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-slate-700"
              title="Retirer"
            >
              {withDisplayCaps(country)} ×
            </button>
          ))}
        </div>
      </div>

      {selectedCountries.map((country) => (
        <input key={`${name}-${country}`} type="hidden" name={name} value={country} />
      ))}
    </div>
  );
}
