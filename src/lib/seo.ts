const DEFAULT_SITE_URL = 'https://resacolo.com';

function isLocalHostname(hostname: string) {
  const host = hostname.toLowerCase();
  return host === 'localhost' || host === '127.0.0.1' || host === '::1' || host.endsWith('.local');
}

function resolveVercelSiteUrl() {
  const vercelUrl = process.env.VERCEL_URL?.trim();
  if (!vercelUrl) return null;
  const host = vercelUrl.replace(/^https?:\/\//i, '').replace(/\/$/, '');
  if (!host || isLocalHostname(host)) return null;
  return `https://${host}`;
}

function normalizeSiteUrl(input: string | undefined) {
  const trimmed = input?.trim();
  const onVercel = Boolean(process.env.VERCEL || process.env.VERCEL_URL);

  if (trimmed) {
    try {
      const url = new URL(trimmed);
      // Sur Vercel, un NEXT_PUBLIC_SITE_URL=http://localhost:3000 casse les retours TPE (Axepta/Monetico).
      if (!(onVercel && isLocalHostname(url.hostname))) {
        return url.toString().replace(/\/$/, '');
      }
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
