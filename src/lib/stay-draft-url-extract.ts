/**
 * Extraction d’URL http(s) dans du texte libre (ex. javascript:window.open('https://youtube…')).
 * Utilisable côté client comme côté serveur (sans cheerio).
 */

export function isVideoUrlCandidate(value: string): boolean {
  return /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|vimeo\.com\/|dailymotion\.com\/|loom\.com\/share\/|wistia\.|\.mp4(?:$|\?)|\.webm(?:$|\?)|\.mov(?:$|\?))/i.test(
    value
  );
}

const HTTPS_IN_TEXT_RE = /https?:\/\/[^'")\s]+/gi;

function trimTrailingJunk(url: string): string {
  return url.replace(/[),;.]+$/, '');
}

export function extractHttpUrlsFromArbitraryString(text: string): string[] {
  const found = new Set<string>();
  HTTPS_IN_TEXT_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = HTTPS_IN_TEXT_RE.exec(text)) !== null) {
    const raw = trimTrailingJunk(match[0]);
    try {
      found.add(new URL(raw).toString());
    } catch {
      /* ignore */
    }
  }
  return Array.from(found);
}

export function extractVideoUrlsFromArbitraryString(text: string): string[] {
  const out: string[] = [];
  for (const url of extractHttpUrlsFromArbitraryString(text)) {
    if (isVideoUrlCandidate(url)) out.push(url);
  }
  return out;
}

const IMAGE_URL_HINT_RE =
  /\.(jpg|jpeg|png|gif|webp|avif|svg)(\?[^'"]*)?$/i;

export function extractImageUrlsFromArbitraryString(text: string): string[] {
  const out: string[] = [];
  for (const url of extractHttpUrlsFromArbitraryString(text)) {
    if (IMAGE_URL_HINT_RE.test(url) || /\/image|\/photo|\/upload|\/media|\/img\//i.test(url)) {
      out.push(url);
    }
  }
  return out;
}

/** À partir d’entrées brutes (JSON import, href javascript…), ne garde que des URLs vidéo https normalisées. */
export function normalizeImportedVideoUrlList(entries: string[]): string[] {
  const seen = new Set<string>();
  const list: string[] = [];
  for (const entry of entries) {
    const trimmed = entry.trim();
    if (!trimmed) continue;
    if (/^https?:\/\//i.test(trimmed) && isVideoUrlCandidate(trimmed)) {
      try {
        const u = new URL(trimmed).toString();
        if (!seen.has(u)) {
          seen.add(u);
          list.push(u);
        }
      } catch {
        /* skip */
      }
      continue;
    }
    for (const url of extractVideoUrlsFromArbitraryString(trimmed)) {
      if (!seen.has(url)) {
        seen.add(url);
        list.push(url);
      }
    }
  }
  return list;
}

/** Idem pour des vignettes / images. */
export function normalizeImportedImageUrlList(entries: string[]): string[] {
  const seen = new Set<string>();
  const list: string[] = [];
  for (const entry of entries) {
    const trimmed = entry.trim();
    if (!trimmed) continue;
    if (/^https?:\/\//i.test(trimmed)) {
      try {
        const u = new URL(trimmed).toString();
        if (!seen.has(u)) {
          seen.add(u);
          list.push(u);
        }
      } catch {
        /* skip */
      }
      continue;
    }
    for (const url of extractImageUrlsFromArbitraryString(trimmed)) {
      if (!seen.has(url)) {
        seen.add(url);
        list.push(url);
      }
    }
  }
  return list;
}
