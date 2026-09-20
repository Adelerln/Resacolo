export function getPublicSiteOrigin(req?: Request) {
  const onVercel = Boolean(process.env.VERCEL || process.env.VERCEL_URL);
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (fromEnv) {
    try {
      const origin = new URL(fromEnv).origin;
      const host = new URL(fromEnv).hostname.toLowerCase();
      const isLocal = host === 'localhost' || host === '127.0.0.1' || host === '::1';
      if (!(onVercel && isLocal)) {
        return origin;
      }
    } catch {
      // fall through
    }
  }
  if (onVercel) {
    const vercelUrl = process.env.VERCEL_URL?.trim();
    if (vercelUrl) {
      const host = vercelUrl.replace(/^https?:\/\//i, '').replace(/\/$/, '');
      if (host) return `https://${host}`;
    }
  }
  if (req) {
    return new URL(req.url).origin;
  }
  return 'https://resacolo.com';
}

/**
 * Origin used in auth e-mails (confirm, magic link, reset).
 * Prefer the request host so localhost / vercel.app work even if
 * NEXT_PUBLIC_SITE_URL still points at the old production domain.
 */
export function getAuthRedirectOrigin(req: Request) {
  try {
    const requestOrigin = new URL(req.url).origin;
    if (requestOrigin) return requestOrigin;
  } catch {
    // fall through
  }
  return getPublicSiteOrigin(req);
}

export function sanitizeAuthRelativePath(value: string | null | undefined, fallback: string) {
  if (!value) return fallback;
  const trimmed = value.trim();
  if (!trimmed.startsWith('/') || trimmed.startsWith('//')) return fallback;
  return trimmed;
}

export function buildAuthCallbackUrl(
  req: Request,
  options: {
    next: string;
    loginMode?: 'family' | 'pro';
    flow?: 'login' | 'recovery' | 'email-change' | 'invite';
  }
) {
  const url = new URL('/auth/callback', getAuthRedirectOrigin(req));
  url.searchParams.set('next', options.next);
  if (options.loginMode) url.searchParams.set('loginMode', options.loginMode);
  if (options.flow) url.searchParams.set('flow', options.flow);
  return url.toString();
}

export function buildEmailConfirmRedirectUrl(req: Request) {
  const url = new URL('/confirmation-mail/valider', getAuthRedirectOrigin(req));
  url.searchParams.set('next', '/confirmation-mail');
  return url.toString();
}
