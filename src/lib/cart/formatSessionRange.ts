/** Plage de dates de session pour libellés panier (fr-FR). */
export function formatSessionDateRangeFr(startDate: string, endDate: string): string {
  const start = new Date(`${startDate}T12:00:00Z`);
  const end = new Date(`${endDate}T12:00:00Z`);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) {
    return `${startDate} → ${endDate}`;
  }
  return `Du ${start.toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris' })} au ${end.toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris' })}`;
}
