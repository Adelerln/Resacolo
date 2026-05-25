'use client';

import { useState } from 'react';
import {
  ACCOMMODATION_TYPE_OPTIONS,
  MIXED_ACCOMMODATION_TYPE_OPTIONS,
  formatAccommodationType,
  parseAccommodationType,
  type AccommodationTypeOption,
  type MixedAccommodationTypeOption
} from '@/components/organisme/accommodation-type';

type AccommodationTypeFieldProps = {
  defaultValue?: string | null;
};

export default function AccommodationTypeField({ defaultValue }: AccommodationTypeFieldProps) {
  const parsedDefaultValue = parseAccommodationType(defaultValue);
  const [selectedType, setSelectedType] = useState<AccommodationTypeOption | ''>(
    parsedDefaultValue.baseType ?? ''
  );
  const [mixedTypes, setMixedTypes] = useState<MixedAccommodationTypeOption[]>(
    parsedDefaultValue.mixedTypes
  );

  const isMixed = selectedType === 'mixte';

  function toggleMixedType(option: MixedAccommodationTypeOption) {
    setMixedTypes((current) => {
      if (current.includes(option)) {
        return current.filter((value) => value !== option);
      }
      return [...current, option];
    });
  }

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-slate-700">
        Type d&apos;hébergement
        <select
          name="accommodation_type"
          value={selectedType}
          onChange={(event) => setSelectedType(event.target.value as AccommodationTypeOption | '')}
          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
          required
        >
          <option value="">Sélectionner</option>
          {ACCOMMODATION_TYPE_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {formatAccommodationType(option)}
            </option>
          ))}
        </select>
      </label>

      {isMixed && (
        <fieldset className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3">
          <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-slate-600">
            Sous-types (mixte)
          </legend>
          <p className="mb-2 text-xs text-slate-500">Cochez les types inclus dans cet hébergement.</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {MIXED_ACCOMMODATION_TYPE_OPTIONS.map((option) => (
              <label key={option} className="inline-flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  name="accommodation_type_mixed_values"
                  value={option}
                  checked={mixedTypes.includes(option)}
                  onChange={() => toggleMixedType(option)}
                  className="h-4 w-4 rounded border-slate-300 text-emerald-600"
                />
                <span>{formatAccommodationType(option)}</span>
              </label>
            ))}
          </div>
          {mixedTypes.length === 0 && (
            <p className="mt-2 text-xs text-amber-700">Sélectionnez au moins un sous-type pour “mixte”.</p>
          )}
        </fieldset>
      )}
    </div>
  );
}
