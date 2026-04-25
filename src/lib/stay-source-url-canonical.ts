const TRACKING_QUERY_PARAM_NAMES = new Set(['fbclid', 'gclid', 'msclkid', 'dclid', 'ref']);

function shouldDropQueryParam(name: string): boolean {
  const normalized = name.trim().toLowerCase();
  if (!normalized) return true;
  if (normalized.startsWith('utm_')) return true;
  return TRACKING_QUERY_PARAM_NAMES.has(normalized);
}

function sortQueryEntries(left: [string, string], right: [string, string]): number {
  const leftName = left[0].toLowerCase();
  const rightName = right[0].toLowerCase();
  if (leftName !== rightName) return leftName.localeCompare(rightName);
  if (left[1] !== right[1]) return left[1].localeCompare(right[1]);
  return left[0].localeCompare(right[0]);
}

function normalizePathname(pathname: string): string {
  if (!pathname) return '/';
  const squashed = pathname.replace(/\/{2,}/g, '/');
  if (squashed !== '/' && squashed.endsWith('/')) {
    return squashed.slice(0, -1);
  }
  return squashed || '/';
}

export function canonicalizeStaySourceUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    throw new Error('source-url-empty');
  }

  const parsed = new URL(trimmed);
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('source-url-invalid-protocol');
  }

  parsed.hostname = parsed.hostname.toLowerCase();
  parsed.hash = '';
  parsed.pathname = normalizePathname(parsed.pathname);

  if (parsed.protocol === 'http:' && parsed.port === '80') {
    parsed.port = '';
  }
  if (parsed.protocol === 'https:' && parsed.port === '443') {
    parsed.port = '';
  }

  const keptEntries: Array<[string, string]> = [];
  for (const [name, value] of parsed.searchParams.entries()) {
    if (!shouldDropQueryParam(name)) {
      keptEntries.push([name, value]);
    }
  }
  keptEntries.sort(sortQueryEntries);

  parsed.search = '';
  for (const [name, value] of keptEntries) {
    parsed.searchParams.append(name, value);
  }

  return parsed.toString();
}

export function tryCanonicalizeStaySourceUrl(rawUrl: string | null | undefined): string | null {
  const value = String(rawUrl ?? '').trim();
  if (!value) return null;
  try {
    return canonicalizeStaySourceUrl(value);
  } catch {
    return null;
  }
}

export function areStaySourceUrlsEquivalent(
  firstUrl: string | null | undefined,
  secondUrl: string | null | undefined
): boolean {
  const firstCanonical = tryCanonicalizeStaySourceUrl(firstUrl);
  const secondCanonical = tryCanonicalizeStaySourceUrl(secondUrl);
  if (firstCanonical && secondCanonical) {
    return firstCanonical === secondCanonical;
  }
  return String(firstUrl ?? '').trim() === String(secondUrl ?? '').trim();
}
