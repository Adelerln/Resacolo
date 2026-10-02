/**
 * Clés stables pour lier une ligne du brouillon (sessions / transport) aux sessions live après publication.
 * Doit rester aligné avec `liveSessionStableKey` pour le même couple de dates.
 */

export function normalizeDraftSessionDateKey(raw: unknown): string {
  const s = String(raw ?? '').trim();
  if (!s) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s);
  return Number.isFinite(d.getTime()) ? d.toISOString().slice(0, 10) : '';
}

/** Clé depuis une ligne `sessions_json` du brouillon. */
export function draftSessionStableKey(session: Record<string, unknown>, index: number): string {
  const startRaw = normalizeDraftSessionDateKey(session.start_date);
  const endRaw = normalizeDraftSessionDateKey(session.end_date);
  if (startRaw || endRaw) return `${startRaw}|${endRaw}`;
  const label = String(session.label ?? '').trim();
  if (label) return `label:${label}`;
  return `idx:${index}`;
}

/** Clé depuis une ligne `sessions` Supabase après publication. */
export function liveSessionStableKey(
  row: { start_date: string | null; end_date: string | null },
  index: number
): string {
  const start = normalizeDraftSessionDateKey(row.start_date);
  const end = normalizeDraftSessionDateKey(row.end_date);
  if (start || end) return `${start}|${end}`;
  return `idx:${index}`;
}

/** Sessions live proposées pour une option transport (clés brouillon / live alignées). */
export function filterLiveSessionsForTransportOption<
  T extends { id: string; start_date: string | null; end_date: string | null }
>(sessions: T[], excludedSessionKeys: string[]): T[] {
  if (excludedSessionKeys.length === 0) return sessions;

  const excluded = new Set(excludedSessionKeys);
  const liveKeys = sessions.map((session, index) => liveSessionStableKey(session, index));
  const overlaps = excludedSessionKeys.some((key) => liveKeys.includes(key));
  if (!overlaps) return sessions;

  return sessions.filter((session, index) => !excluded.has(liveSessionStableKey(session, index)));
}

/** Affiche une date ISO jour (YYYY-MM-DD) en libellé français, sans décalage fuseau. */
function formatFrenchDayLabel(isoDay: string): string {
  const d = new Date(`${isoDay}T12:00:00`);
  if (!Number.isFinite(d.getTime())) return isoDay;
  return d.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
}

export function formatDraftSessionShortLabel(session: Record<string, unknown>): string {
  const start = normalizeDraftSessionDateKey(session.start_date);
  const end = normalizeDraftSessionDateKey(session.end_date);
  if (start && end) {
    if (start === end) return formatFrenchDayLabel(start);
    return `${formatFrenchDayLabel(start)} → ${formatFrenchDayLabel(end)}`;
  }
  const label = String(session.label ?? '').trim();
  return label || 'Session';
}
