/**
 * Détecte si un stay_draft a déjà été publié vers un séjour live (pour masquer la carte « Brouillons d'import »).
 */

export function parseStayDraftRawPayload(rawPayload: unknown): Record<string, unknown> {
  if (rawPayload == null) return {};
  if (typeof rawPayload === 'string') {
    const trimmed = rawPayload.trim();
    if (!trimmed) return {};
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return { ...(parsed as Record<string, unknown>) };
      }
    } catch {
      return {};
    }
    return {};
  }
  if (typeof rawPayload === 'object' && !Array.isArray(rawPayload)) {
    return { ...(rawPayload as Record<string, unknown>) };
  }
  return {};
}

function readStayIdFromLivePublication(live: unknown): string | null {
  if (!live || typeof live !== 'object' || Array.isArray(live)) return null;
  const o = live as Record<string, unknown>;
  const id = o.stay_id ?? o.stayId;
  if (typeof id === 'string' && id.trim().length > 0) return id.trim();
  return null;
}

/** True si le JSON du brouillon indique une publication live réussise. */
export function stayDraftHasLivePublicationInRawPayload(rawPayload: unknown): boolean {
  const o = parseStayDraftRawPayload(rawPayload);
  if (readStayIdFromLivePublication(o.live_publication)) return true;
  const publishedAt = o.published_at;
  const publishError = o.publish_error;
  if (typeof publishedAt === 'string' && publishedAt.length > 0 && !publishError) {
    return true;
  }
  return false;
}

export function normalizeStayDraftStatus(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase();
}

export function isPublishedStayStatus(status: string | null | undefined): boolean {
  return String(status ?? '').trim().toUpperCase() === 'PUBLISHED';
}

type DraftRowForImportList = {
  raw_payload: unknown;
  source_url: string;
  status: string;
  validated_at: string | null;
};

/**
 * Masque le brouillon de la liste « imports » si :
 * - raw_payload indique une publication live, ou
 * - le brouillon est déjà validé (plus considéré comme brouillon d’import), ou
 * - il est validé côté métier et un séjour publié existe pour la même source_url (filet).
 */
export function stayDraftShouldAppearInImportList(
  draft: DraftRowForImportList,
  publishedStaySourceUrls: Set<string>
): boolean {
  if (stayDraftHasLivePublicationInRawPayload(draft.raw_payload)) {
    return false;
  }

  const validated =
    Boolean(draft.validated_at) || normalizeStayDraftStatus(draft.status) === 'validated';
  if (validated) {
    return false;
  }

  const url = draft.source_url?.trim();
  if (url && publishedStaySourceUrls.has(url)) {
    return false;
  }

  return true;
}
