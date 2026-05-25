import { normalizeStayAges } from '@/lib/stay-ages';

export const MAX_STAY_SUMMARY_LENGTH = 100;

export const STAY_TRANSPORT_LOGISTICS_MODES = [
  'Aller/Retour similaire',
  'Aller/Retour différencié',
  'Sans transport'
] as const;

export type StayTransportLogisticsMode = (typeof STAY_TRANSPORT_LOGISTICS_MODES)[number];

function normalizeWhitespace(value: string | null | undefined): string {
  if (!value) return '';
  return value.replace(/\s+/g, ' ').trim();
}

function truncateAtWordBoundary(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  const sliced = value.slice(0, maxLength + 1);
  const lastSpace = sliced.lastIndexOf(' ');
  if (lastSpace >= Math.floor(maxLength * 0.6)) {
    return sliced.slice(0, lastSpace).trim();
  }
  return value.slice(0, maxLength).trim();
}

function normalizeFrenchSummaryPhrasing(value: string): string {
  return value
    .replace(/\bpour\s+(\d{1,2})\s*[àa]\s*(\d{1,2})\s+ans\b/gi, 'de $1 à $2 ans')
    .replace(/\bpour\s+les\s+(\d{1,2})\s*[àa]\s*(\d{1,2})\s+ans\b/gi, 'de $1 à $2 ans')
    .replace(/\bpour\s+enfants\s+de\s+(\d{1,2})\s*[àa]\s*(\d{1,2})\s+ans\b/gi, 'pour enfants de $1 à $2 ans')
    .replace(/\bpour\s+adolescents\s+de\s+(\d{1,2})\s*[àa]\s*(\d{1,2})\s+ans\b/gi, 'pour adolescents de $1 à $2 ans')
    .replace(/\s+,/g, ',')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeStaySummary(value: string | null | undefined): string {
  return truncateAtWordBoundary(
    normalizeFrenchSummaryPhrasing(normalizeWhitespace(value)),
    MAX_STAY_SUMMARY_LENGTH
  );
}

export function normalizeStayTransportLogisticsMode(
  value: string | null | undefined
): StayTransportLogisticsMode | '' {
  const normalized = normalizeWhitespace(value).toLowerCase();
  if (!normalized) return '';
  if (normalized.includes('sans transport')) return 'Sans transport';
  if (normalized.includes('differencie') || normalized.includes('différencié') || normalized.includes('aller simple') || normalized.includes('retour different')) {
    return 'Aller/Retour différencié';
  }
  if (normalized.includes('similaire') || normalized.includes('aller/retour') || normalized.includes('aller retour')) {
    return 'Aller/Retour similaire';
  }
  return '';
}

export function inferTransportLogisticsModeFromSignals(input: {
  currentValue?: string | null;
  html?: string | null;
  visibleText?: string | null;
  transportOptions?: Array<{ departure_city?: string | null; return_city?: string | null }> | null;
}): StayTransportLogisticsMode | '' {
  const direct = normalizeStayTransportLogisticsMode(input.currentValue);
  if (direct) return direct;

  const options = input.transportOptions ?? [];
  if (
    options.some((option) => {
      const departure = normalizeWhitespace(option.departure_city);
      const returning = normalizeWhitespace(option.return_city);
      return departure && returning && departure !== returning;
    })
  ) {
    return 'Aller/Retour différencié';
  }

  if (
    options.some((option) => {
      const departure = normalizeWhitespace(option.departure_city);
      const returning = normalizeWhitespace(option.return_city);
      return departure || returning;
    })
  ) {
    return 'Aller/Retour similaire';
  }

  const combined = normalizeWhitespace([input.visibleText, input.html].filter(Boolean).join(' ')).toLowerCase();
  if (!combined) return '';
  if (
    /(transport aller|ville de depart|ville départ|ville de départ|depart aller)/i.test(combined) &&
    /(transport retour|ville de retour|retour transport|retour\/aller)/i.test(combined)
  ) {
    return 'Aller/Retour différencié';
  }
  if (/(sans transport|sans acheminement|rdv sur place|rendez vous sur place)/i.test(combined)) {
    return 'Sans transport';
  }
  return '';
}

export function expandDraftAges(
  ages?: number[] | null,
  ageMin?: number | null,
  ageMax?: number | null
): number[] {
  const normalized = Array.from(
    new Set((ages ?? []).map(Number).filter((value) => Number.isInteger(value) && value >= 3 && value <= 25))
  ).sort((left, right) => left - right);

  const rangeFromBounds = normalizeStayAges([], ageMin ?? null, ageMax ?? null);
  if (rangeFromBounds.length > 0) {
    return rangeFromBounds;
  }

  if (normalized.length === 2 && normalized[1] - normalized[0] > 1) {
    return normalizeStayAges([], normalized[0], normalized[1]);
  }

  return normalized;
}
