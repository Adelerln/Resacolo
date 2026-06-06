'use client';

import { useState } from 'react';
import {
  ACCOMMODATION_TYPE_OPTIONS,
  formatAccommodationType,
  parseAccommodationType,
  type AccommodationTypeOption
} from '@/components/organisme/accommodation-type';

type AccommodationTypeFieldProps = {
  defaultValue?: string | null;
  onTypeChange?: (type: AccommodationTypeOption | '') => void;
};

export default function AccommodationTypeField({
  defaultValue,
  onTypeChange
}: AccommodationTypeFieldProps) {
  const parsedDefaultValue = parseAccommodationType(defaultValue);
  const [selectedType, setSelectedType] = useState<AccommodationTypeOption | ''>(
    parsedDefaultValue.baseType ?? ''
  );

  return (
    <label className="block text-sm font-medium text-slate-700">
      Type d&apos;hébergement
      <select
        name="accommodation_type"
        value={selectedType}
        onChange={(event) => {
          const nextType = event.target.value as AccommodationTypeOption | '';
          setSelectedType(nextType);
          onTypeChange?.(nextType);
        }}
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
  );
}
