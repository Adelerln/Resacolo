import type { StayTransportOption } from '@/types/stay';

/** Options de transport visibles pour une session (avec repli si les session_id en base sont obsolètes). */
export function filterTransportOptionsForSession(
  options: StayTransportOption[],
  sessionId: string,
  liveSessionIds: string[]
): StayTransportOption[] {
  const direct = options.filter((opt) => opt.sessionId == null || opt.sessionId === sessionId);
  if (direct.length > 0) return direct;

  const sessionBound = options.filter((opt) => opt.sessionId != null);
  if (sessionBound.length === 0) return [];

  const liveIdSet = new Set(liveSessionIds);
  const allBoundOrphaned = sessionBound.every(
    (opt) => opt.sessionId != null && !liveIdSet.has(opt.sessionId)
  );
  if (!allBoundOrphaned) return [];

  const seen = new Set<string>();
  const fallback: StayTransportOption[] = [];
  for (const opt of sessionBound) {
    const key = `${opt.departureCity}\0${opt.returnCity}\0${opt.amount}`;
    if (seen.has(key)) continue;
    seen.add(key);
    fallback.push({ ...opt, sessionId: null });
  }
  return fallback;
}
