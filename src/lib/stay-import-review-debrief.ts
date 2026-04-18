/**
 * Construit un objet JSON lisible pour la relecture d'un brouillon importé
 * (sans le HTML brut : longueurs et extraits seulement).
 */

const RAW_TEXT_PREVIEW = 2_500;
const TRANSPORT_DEBUG_CAP = 40;

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function hostnameFromUrl(url: unknown): string | null {
  if (typeof url !== 'string' || !url.trim()) return null;
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

function htmlStats(html: unknown): { length_chars: number } | null {
  if (typeof html !== 'string') return null;
  return { length_chars: html.length };
}

function summarizeExtracted(extracted: unknown): Record<string, unknown> | null {
  if (!isPlainRecord(extracted)) return null;
  const rawText = extracted.rawText;
  const rawTextStr = typeof rawText === 'string' ? rawText : '';
  const { rawText: _omit, ...rest } = extracted;
  return {
    ...rest,
    rawText:
      rawTextStr.length === 0
        ? null
        : {
            length_chars: rawTextStr.length,
            preview: rawTextStr.slice(0, RAW_TEXT_PREVIEW),
            truncated: rawTextStr.length > RAW_TEXT_PREVIEW
          }
  };
}

export function buildStayImportReviewDebrief(rawPayload: Record<string, unknown>): Record<string, unknown> {
  const embedded = rawPayload.import_review_debrief;
  if (isPlainRecord(embedded)) {
    return {
      ...embedded,
      note:
        "Données figées à l'import (réimporter pour mettre à jour). Le HTML brut reste stocké dans raw_payload."
    };
  }

  const html = rawPayload.html;
  const extracted = summarizeExtracted(rawPayload.extracted ?? null);
  const transportVariants = Array.isArray(rawPayload.transport_variants) ? rawPayload.transport_variants : [];
  const transportPriceDebug = Array.isArray(rawPayload.transport_price_debug)
    ? rawPayload.transport_price_debug
    : [];
  const videoUrls = Array.isArray(rawPayload.video_urls) ? rawPayload.video_urls : [];
  const playwright = rawPayload.playwright;

  return {
    source_host: hostnameFromUrl(rawPayload.source_url),
    source_url: rawPayload.source_url ?? null,
    final_url: rawPayload.final_url ?? null,
    fetched_at: rawPayload.fetched_at ?? null,
    http: {
      status_code: rawPayload.status_code ?? null,
      content_type: rawPayload.content_type ?? null
    },
    html_snapshot: htmlStats(html),
    extracted,
    media: {
      video_urls_count: videoUrls.length,
      video_urls: videoUrls
    },
    transport: {
      variant_count: transportVariants.length,
      variants: transportVariants,
      price_debug_count: transportPriceDebug.length,
      price_debug_sample: transportPriceDebug.slice(0, TRANSPORT_DEBUG_CAP)
    },
    playwright: playwright ?? null,
    import_options: rawPayload.import_options ?? null,
    note:
      'Brouillon sans bloc import_review_debrief : synthèse dérivée de raw_payload. Réimporter le séjour pour obtenir la trace détaillée.'
  };
}
