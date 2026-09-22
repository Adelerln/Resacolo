/**
 * Détecte si un stay_draft a déjà été publié vers un séjour live (pour masquer la carte « Brouillons d'import »).
 */
import { tryCanonicalizeStaySourceUrl } from '@/lib/stay-source-url-canonical';

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

/**
 * True si le JSON du brouillon indique une publication live réussie.
 * On s’appuie uniquement sur `live_publication.stay_id` : un `published_at` orphelin
 * (sans liaison séjour) ne doit pas masquer le brouillon dans la liste d’import.
 */
export function stayDraftHasLivePublicationInRawPayload(rawPayload: unknown): boolean {
  const o = parseStayDraftRawPayload(rawPayload);
  return readStayIdFromLivePublication(o.live_publication) != null;
}

export function isPublishedStayStatus(status: string | null | undefined): boolean {
  return String(status ?? '').trim().toUpperCase() === 'PUBLISHED';
}

type DraftRowForImportList = {
  raw_payload: unknown;
  source_url: string;
  status: string;
};

/**
 * Masque le brouillon de la liste « imports » si :
 * - raw_payload contient une publication live (`live_publication.stay_id`), ou
 * - un séjour publié existe pour la même source_url (filet).
 */
export function stayDraftShouldAppearInImportList(
  draft: DraftRowForImportList,
  publishedStaySourceUrls: Set<string>
): boolean {
  if (stayDraftHasLivePublicationInRawPayload(draft.raw_payload)) {
    return false;
  }

  if (draft.status.trim().toLowerCase() === 'published') {
    return false;
  }

  const url = draft.source_url?.trim();
  if (!url) return true;

  const canonicalUrl = tryCanonicalizeStaySourceUrl(url);
  if (
    publishedStaySourceUrls.has(url) ||
    (canonicalUrl ? publishedStaySourceUrls.has(canonicalUrl) : false)
  ) {
    return false;
  }

  return true;
}
