const DEFAULT_CANONICAL_HOST = 'resacolo.com';

const ALWAYS_REDIRECT_HOSTS: Record<string, string> = {
  'www.resacolo.com': DEFAULT_CANONICAL_HOST
};

const OPTIONAL_REDIRECT_HOSTS = new Set(['resacolo.vercel.app']);

function stripWww(host: string) {
  return host.startsWith('www.') ? host.slice(4) : host;
}

export function getCanonicalHost() {
  const fromEnv = process.env.CANONICAL_HOST?.trim().toLowerCase();
  if (fromEnv) return stripWww(fromEnv);

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (siteUrl) {
    try {
      return stripWww(new URL(siteUrl).hostname.toLowerCase());
    } catch {
      // ignore invalid URL
    }
  }

  return DEFAULT_CANONICAL_HOST;
}

export function isCanonicalHostRedirectsEnabled() {
  return process.env.ENABLE_CANONICAL_HOST_REDIRECTS === '1';
}

export function resolveCanonicalHostRedirect(hostHeader: string | null) {
  const host = hostHeader?.trim().toLowerCase();
  if (!host) return null;

  const normalizedHost = host.split(':')[0];

  const alwaysRedirectTo = ALWAYS_REDIRECT_HOSTS[normalizedHost];
  if (alwaysRedirectTo) {
    return alwaysRedirectTo;
  }

  if (!isCanonicalHostRedirectsEnabled()) {
    return null;
  }

  const canonicalHost = getCanonicalHost();
  if (normalizedHost === canonicalHost) {
    return null;
  }

  if (OPTIONAL_REDIRECT_HOSTS.has(normalizedHost)) {
    return canonicalHost;
  }

  return null;
}

export const __testables__ = {
  ALWAYS_REDIRECT_HOSTS,
  OPTIONAL_REDIRECT_HOSTS,
  stripWww
};
