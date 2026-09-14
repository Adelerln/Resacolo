/** Calendar dates and instants shown by Resacolo use France's civil time, including DST. */
export const PARIS_TIME_ZONE = 'Europe/Paris';

const parisDateFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: PARIS_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
});

export function parisDateKey(date: Date = new Date()): string {
  const parts = parisDateFormatter.formatToParts(date);
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;
  if (!year || !month || !day) throw new Error('Date de Paris invalide.');
  return `${year}-${month}-${day}`;
}

export function parisYear(date: Date = new Date()): number {
  return Number(parisDateKey(date).slice(0, 4));
}

export function parisMonth(date: Date = new Date()): number {
  return Number(parisDateKey(date).slice(5, 7));
}

/** Adds calendar days, so a 23- or 25-hour DST day still counts as one day. */
export function shiftDateKey(dateKey: string, days: number): string {
  const date = new Date(`${dateKey}T12:00:00Z`);
  if (!Number.isFinite(date.getTime())) throw new Error('Date civile invalide.');
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Midnight in Paris expressed as a UTC instant for database range queries. */
export function parisMidnightUtc(dateKey: string): Date {
  const utcMidnight = new Date(`${dateKey}T00:00:00Z`);
  if (!Number.isFinite(utcMidnight.getTime())) throw new Error('Date civile invalide.');
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: PARIS_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(utcMidnight);
  const value = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value);
  const parisAtUtcMidnight = Date.UTC(value('year'), value('month') - 1, value('day'), value('hour'), value('minute'));
  return new Date(2 * utcMidnight.getTime() - parisAtUtcMidnight);
}
