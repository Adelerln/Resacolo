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
  const start = row.start_date ? String(row.start_date).slice(0, 10) : '';
  const end = row.end_date ? String(row.end_date).slice(0, 10) : '';
  if (start || end) return `${start}|${end}`;
  return `idx:${index}`;
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
