import { parisMidnightUtc, shiftDateKey } from '@/lib/paris-time';

export function periodStartIso(startDate: string): string {
  return parisMidnightUtc(startDate).toISOString();
}

/** Fin de période inclusive côté UI → borne supérieure exclusive pour les requêtes `lt`. */
export function periodEndExclusive(endDate: string): string {
  return parisMidnightUtc(shiftDateKey(endDate, 1)).toISOString();
}

export function invoiceYearFromRange(endDate: string): number {
  return Number(endDate.slice(0, 4));
}
