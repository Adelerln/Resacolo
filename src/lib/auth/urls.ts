export function getPublicSiteOrigin(req?: Request) {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (fromEnv) {
    try {
      return new URL(fromEnv).origin;
    } catch {
      // fall through
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
    flow?: 'login' | 'recovery' | 'email-change';
  }
) {
  const url = new URL('/auth/callback', getAuthRedirectOrigin(req));
  url.searchParams.set('next', options.next);
  if (options.loginMode) url.searchParams.set('loginMode', options.loginMode);
  if (options.flow) url.searchParams.set('flow', options.flow);
  return url.toString();
}

export function buildEmailConfirmRedirectUrl(req: Request) {
  const url = new URL('/auth/confirm', getAuthRedirectOrigin(req));
  url.searchParams.set('next', '/confirmation-mail');
  return url.toString();
}
