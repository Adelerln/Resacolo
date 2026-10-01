import {
  isRasterImageUrl,
  isVideoUrlCandidate,
  pickFirstRasterImageUrl
} from '@/lib/stay-draft-url-extract';

const OG_IMAGE_RE =
  /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["'][^>]*>|<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["'][^>]*>/i;

async function fetchOgImageUrl(pageUrl: string): Promise<string | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2500);
  try {
    const response = await fetch(pageUrl, {
      signal: controller.signal,
      headers: { Accept: 'text/html' },
      next: { revalidate: 86400 }
    });
    if (!response.ok) return null;
    const html = await response.text();
    const match = html.match(OG_IMAGE_RE);
    const raw = (match?.[1] ?? match?.[2] ?? '').trim();
    if (!raw) return null;
    const absolute = new URL(raw, pageUrl).toString();
    return isRasterImageUrl(absolute) ? absolute : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Picks a displayable cover photo from accommodation media URLs.
 * Prefers real image files; if only gallery/HTML pages are stored, resolves og:image.
 */
export async function resolveAccommodationCoverImage(
  urls: Array<string | null | undefined>
): Promise<string | null> {
  const normalized = urls
    .map((item) => String(item ?? '').trim())
    .filter((url) => url.length > 0 && /^https?:\/\//i.test(url) && !isVideoUrlCandidate(url));

  const raster = pickFirstRasterImageUrl(normalized);
  if (raster) return raster;

  for (const url of normalized) {
    if (isRasterImageUrl(url)) continue;
    const ogImage = await fetchOgImageUrl(url);
    if (ogImage) return ogImage;
  }

  return null;
}
