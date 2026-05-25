const DEFAULT_SITE_URL = 'https://resacolo.com';

function normalizeSiteUrl(input: string | undefined) {
  const trimmed = input?.trim();
  if (!trimmed) return DEFAULT_SITE_URL;

  try {
    const url = new URL(trimmed);
    return url.toString().replace(/\/$/, '');
  } catch {
    return DEFAULT_SITE_URL;
  }
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
