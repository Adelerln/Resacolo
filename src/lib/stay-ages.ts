import type { StayAudience } from '@/types/stay';

export const STAY_AGE_OPTIONS = Array.from({ length: 23 }, (_, index) => index + 3);

function isValidStayAge(value: number) {
  return Number.isInteger(value) && value >= 3 && value <= 25;
}

export function normalizeStayAges(
  ages?: number[] | null,
  ageMin?: number | null,
  ageMax?: number | null
) {
  const normalizedAges = Array.from(
    new Set((ages ?? []).map(Number).filter((value) => isValidStayAge(value)))
  ).sort((left, right) => left - right);

  if (normalizedAges.length > 0) {
    return normalizedAges;
  }

  const safeMin = typeof ageMin === 'number' && isValidStayAge(ageMin) ? ageMin : null;
  const safeMax = typeof ageMax === 'number' && isValidStayAge(ageMax) ? ageMax : null;

  if (safeMin !== null && safeMax !== null) {
    const start = Math.min(safeMin, safeMax);
    const end = Math.max(safeMin, safeMax);
    return STAY_AGE_OPTIONS.filter((age) => age >= start && age <= end);
  }

  if (safeMin !== null) {
    return [safeMin];
  }

  if (safeMax !== null) {
    return [safeMax];
  }

  return [];
}

export function parseStayAges(formData: FormData, fieldName = 'ages') {
  return Array.from(
    new Set(
      formData
        .getAll(fieldName)
        .map((value) => Number(value))
        .filter((value) => isValidStayAge(value))
    )
  ).sort((left, right) => left - right);
}

export function getStayAgeBounds(ages: number[]) {
  return {
    ages,
    ageMin: ages.length > 0 ? ages[0] : null,
    ageMax: ages.length > 0 ? ages[ages.length - 1] : null
  };
}

export function formatStayAgeRange(
  ages?: number[] | null,
  ageMin?: number | null,
  ageMax?: number | null
) {
  const normalizedAges = normalizeStayAges(ages, ageMin, ageMax);

  if (normalizedAges.length === 0) {
    return 'Tous âges';
  }

  if (normalizedAges.length === 1) {
    return `${normalizedAges[0]} ans`;
  }

  return `${normalizedAges[0]}-${normalizedAges[normalizedAges.length - 1]} ans`;
}

export function deriveStayAudiences(
  ages?: number[] | null,
  ageMin?: number | null,
  ageMax?: number | null
): StayAudience[] {
  const normalizedAges = normalizeStayAges(ages, ageMin, ageMax);

  if (normalizedAges.length === 0) {
    return [];
  }

  const ranges: Array<{ key: StayAudience; min: number; max: number }> = [
    { key: '6-9', min: 6, max: 9 },
    { key: '10-12', min: 10, max: 12 },
    { key: '13-15', min: 13, max: 15 },
    { key: '16-17', min: 16, max: 17 }
  ];

  return ranges
    .filter((range) => normalizedAges.some((age) => age >= range.min && age <= range.max))
    .map((range) => range.key);
}
