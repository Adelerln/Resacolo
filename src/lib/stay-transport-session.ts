import type { StayTransportOption } from '@/types/stay';

function transportOptionIdentityKey(option: Pick<StayTransportOption, 'departureCity' | 'returnCity' | 'amount'>) {
  return `${option.departureCity}\0${option.returnCity}\0${option.amount}`;
}

function dedupeTransportOptions(options: StayTransportOption[]): StayTransportOption[] {
  const seen = new Set<string>();
  const output: StayTransportOption[] = [];
  for (const option of options) {
    const key = transportOptionIdentityKey(option);
    if (seen.has(key)) continue;
    seen.add(key);
    output.push({ ...option, sessionId: null });
  }
  return output;
}

function sessionTransportSignature(
  options: StayTransportOption[],
  sessionId: string
): string {
  return options
    .filter((option) => option.sessionId === sessionId)
    .map((option) => transportOptionIdentityKey(option))
    .sort()
    .join('>');
}

/** Options de transport visibles pour une session (avec repli si les session_id en base sont obsolètes). */
export function filterTransportOptionsForSession(
  options: StayTransportOption[],
  sessionId: string,
  liveSessionIds: string[],
  /** Sessions encore proposées à la réservation (OPEN, etc.) — exclut ARCHIVED/COMPLETED. */
  bookableSessionIds?: string[]
): StayTransportOption[] {
  const direct = options.filter((opt) => opt.sessionId == null || opt.sessionId === sessionId);
  if (direct.length > 0) return direct;

  const sessionBound = options.filter((opt) => opt.sessionId != null);
  if (sessionBound.length === 0) return [];

  const activeSessionIds =
    bookableSessionIds && bookableSessionIds.length > 0 ? bookableSessionIds : liveSessionIds;
  const activeSessionIdSet = new Set(activeSessionIds);

  const boundToActiveSessions = sessionBound.filter(
    (option) => option.sessionId != null && activeSessionIdSet.has(option.sessionId)
  );

  if (boundToActiveSessions.length > 0 && activeSessionIds.length > 0) {
    const signaturesBySession = new Map(
      activeSessionIds.map((activeSessionId) => [
        activeSessionId,
        sessionTransportSignature(sessionBound, activeSessionId)
      ])
    );
    const nonEmptySignatures = Array.from(signaturesBySession.values()).filter(
      (signature) => signature.length > 0
    );
    const referenceSignature = nonEmptySignatures[0] ?? '';
    const hasCompatibleCoverage =
      referenceSignature.length > 0 &&
      Array.from(signaturesBySession.values()).every(
        (signature) => !signature || signature === referenceSignature
      );

    if (hasCompatibleCoverage) {
      return dedupeTransportOptions(boundToActiveSessions);
    }
  }

  const allBoundOrphaned = sessionBound.every(
    (opt) => opt.sessionId != null && !activeSessionIdSet.has(opt.sessionId)
  );
  if (!allBoundOrphaned) return [];

  return dedupeTransportOptions(sessionBound);
}
