export const ACCOMMODATION_TYPE_OPTIONS = [
  'centre',
  'auberge de jeunesse',
  'camping',
  "famille d'accueil",
  'mixte'
] as const;

export type AccommodationTypeOption = (typeof ACCOMMODATION_TYPE_OPTIONS)[number];
export type MixedAccommodationTypeOption = Exclude<AccommodationTypeOption, 'mixte'>;

export const MIXED_ACCOMMODATION_TYPE_OPTIONS = ACCOMMODATION_TYPE_OPTIONS.filter(
  (option): option is MixedAccommodationTypeOption => option !== 'mixte'
);

const MIXED_PREFIX = 'mixte|';

function capitalizeLabel(value: string) {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function isAccommodationTypeOption(value: string): value is AccommodationTypeOption {
  return ACCOMMODATION_TYPE_OPTIONS.includes(value as AccommodationTypeOption);
}

function normalizeMixedTypes(values: readonly string[]): MixedAccommodationTypeOption[] {
  const normalized: MixedAccommodationTypeOption[] = [];

  for (const value of values) {
    const candidate = value.trim();
    if (!candidate || candidate === 'mixte' || !isAccommodationTypeOption(candidate)) {
      continue;
    }
    if (!normalized.includes(candidate as MixedAccommodationTypeOption)) {
      normalized.push(candidate as MixedAccommodationTypeOption);
    }
  }

  return normalized;
}

function inferMixedTypesFromRaw(rawValue: string): MixedAccommodationTypeOption[] {
  const raw = rawValue.toLowerCase();
  return MIXED_ACCOMMODATION_TYPE_OPTIONS.filter((option) => raw.includes(option.toLowerCase()));
}

export function buildAccommodationTypeValue(
  selectedType: string | null | undefined,
  mixedTypes: readonly string[] = []
): string {
  const normalizedType = String(selectedType ?? '').trim();
  if (!isAccommodationTypeOption(normalizedType)) {
    return '';
  }

  if (normalizedType !== 'mixte') {
    return normalizedType;
  }

  const normalizedMixedTypes = normalizeMixedTypes(mixedTypes);
  if (normalizedMixedTypes.length === 0) {
    return 'mixte';
  }

  return `${MIXED_PREFIX}${normalizedMixedTypes.join(',')}`;
}

export function parseAccommodationType(value?: string | null): {
  baseType: AccommodationTypeOption | null;
  mixedTypes: MixedAccommodationTypeOption[];
} {
  const raw = String(value ?? '').trim();
  if (!raw) {
    return { baseType: null, mixedTypes: [] };
  }

  if (raw === 'mixte') {
    return { baseType: 'mixte', mixedTypes: [] };
  }

  if (raw.startsWith(MIXED_PREFIX)) {
    const mixedTypes = normalizeMixedTypes(raw.slice(MIXED_PREFIX.length).split(','));
    return { baseType: 'mixte', mixedTypes };
  }

  if (raw.startsWith('mixte:')) {
    const mixedTypes = normalizeMixedTypes(raw.slice('mixte:'.length).split(','));
    return { baseType: 'mixte', mixedTypes };
  }

  if (isAccommodationTypeOption(raw)) {
    return { baseType: raw, mixedTypes: [] };
  }

  if (raw.toLowerCase().includes('mixte')) {
    return { baseType: 'mixte', mixedTypes: inferMixedTypesFromRaw(raw) };
  }

  return { baseType: null, mixedTypes: [] };
}

export function formatAccommodationType(value?: string | null) {
  const raw = String(value ?? '').trim();
  if (!raw) return 'Non renseigné';

  const parsed = parseAccommodationType(raw);

  if (parsed.baseType === 'mixte') {
    if (parsed.mixedTypes.length > 0) {
      return `Mixte (${parsed.mixedTypes.map((option) => capitalizeLabel(option)).join(', ')})`;
    }
    return 'Mixte';
  }

  if (parsed.baseType) {
    return capitalizeLabel(parsed.baseType);
  }

  return capitalizeLabel(raw);
}
