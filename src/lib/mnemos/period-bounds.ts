export function periodStartIso(startDate: string): string {
  return new Date(`${startDate}T00:00:00.000Z`).toISOString();
}

/** Fin de période inclusive côté UI → borne supérieure exclusive pour les requêtes `lt`. */
export function periodEndExclusive(endDate: string): string {
  const d = new Date(`${endDate}T23:59:59.999Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

export function invoiceYearFromRange(endDate: string): number {
  return new Date(`${endDate}T12:00:00.000Z`).getUTCFullYear();
}
