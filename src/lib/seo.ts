const DEFAULT_SITE_URL = 'https://resacolo.com';

function resolveVercelSiteUrl() {
  const vercelUrl = process.env.VERCEL_URL?.trim();
  if (!vercelUrl) return null;
  const host = vercelUrl.replace(/^https?:\/\//i, '').replace(/\/$/, '');
  if (!host) return null;
  return `https://${host}`;
}

function normalizeSiteUrl(input: string | undefined) {
  const trimmed = input?.trim();
  if (trimmed) {
    try {
      const url = new URL(trimmed);
      return url.toString().replace(/\/$/, '');
    } catch {
      // fall through
    }
  }

  // Sur Vercel, ne pas forcer resacolo.com (toujours WordPress tant que le DNS n'est pas basculé) :
  // sinon metadataBase / URLs absolues pointent vers le mauvais hôte.
  return resolveVercelSiteUrl() ?? DEFAULT_SITE_URL;
}

export const SITE_URL = normalizeSiteUrl(process.env.NEXT_PUBLIC_SITE_URL);
export const DEFAULT_STAY_OG_IMAGE_PATH = '/image/footer/gouttes.png';

export function toAbsoluteUrl(pathOrUrl: string) {
  const trimmed = pathOrUrl.trim();
  if (!trimmed) return SITE_URL;

  try {
    return new URL(trimmed).toString();
  } catch {
    const normalizedPath = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
    return new URL(normalizedPath, SITE_URL).toString();
  }
}
