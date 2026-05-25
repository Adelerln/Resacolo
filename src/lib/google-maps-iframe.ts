function escapeHtmlAttribute(value: string) {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

function isAllowedGoogleMapsEmbedUrl(value: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }

  if (url.protocol !== 'https:') return false;
  const hostname = url.hostname.toLowerCase();
  const isGoogleHost =
    hostname === 'google.com' ||
    hostname === 'www.google.com' ||
    hostname === 'maps.google.com' ||
    hostname.endsWith('.google.com');
  if (!isGoogleHost) return false;

  const path = url.pathname.toLowerCase();
  return path.includes('/maps') && path.includes('embed');
}

export function extractGoogleMapsEmbedSrcFromInput(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  if (/^https?:\/\//i.test(trimmed)) {
    return isAllowedGoogleMapsEmbedUrl(trimmed) ? trimmed : null;
  }

  const iframeOnlyPattern = /^\s*<iframe\b[\s\S]*<\/iframe>\s*$/i;
  if (!iframeOnlyPattern.test(trimmed)) return null;

  const srcMatch = trimmed.match(/\ssrc\s*=\s*["']([^"']+)["']/i);
  if (!srcMatch?.[1]) return null;
  const src = srcMatch[1].trim();
  return isAllowedGoogleMapsEmbedUrl(src) ? src : null;
}

export function buildGoogleMapsEmbedIframeHtml(src: string) {
  const safeSrc = escapeHtmlAttribute(src);
  return `<iframe src="${safeSrc}" width="640" height="480" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>`;
}

export function readMapIframeHtmlFromAiExtractedData(value: unknown): string | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const raw = (value as Record<string, unknown>).map_iframe_html;
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  return trimmed || null;
}

export function mergeMapIframeHtmlIntoAiExtractedData(
  current: unknown,
  mapIframeHtml: string | null
): Record<string, unknown> | null {
  const base =
    current && typeof current === 'object' && !Array.isArray(current)
      ? { ...(current as Record<string, unknown>) }
      : {};
  if (mapIframeHtml) {
    base.map_iframe_html = mapIframeHtml;
    return base;
  }
  delete base.map_iframe_html;
  return Object.keys(base).length > 0 ? base : null;
}
