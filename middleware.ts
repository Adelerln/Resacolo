import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';
import { createClient } from '@supabase/supabase-js';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import {
  canAccessBackofficePath,
  getHomePathForRole,
  resolveRoleContextForUserId
} from '@/lib/auth/roles';
import { resolveCanonicalHostRedirect } from '@/lib/site-host';
import type { Database } from '@/types/supabase';

const PROTECTED_PATH_PREFIXES = [
  '/admin',
  '/organisme',
  '/partenaire',
  '/mnemos',
  '/back-office'
] as const;

function buildRedirectTo(req: NextRequest, pathname: string) {
  const url = new URL(pathname, req.url);
  return url;
}

function buildLoginRedirect(req: NextRequest) {
  const redirectTo = `${req.nextUrl.pathname}${req.nextUrl.search}`;
  const loginUrl = new URL('/login', req.url);
  loginUrl.searchParams.set('redirectTo', redirectTo);
  return loginUrl;
}

function maybeRedirectToCanonicalHost(req: NextRequest) {
  const canonicalHost = resolveCanonicalHostRedirect(req.headers.get('host'));
  if (!canonicalHost) return null;

  const redirectUrl = req.nextUrl.clone();
  redirectUrl.protocol = 'https:';
  redirectUrl.host = canonicalHost;
  return NextResponse.redirect(redirectUrl, 308);
}

function isProtectedPath(pathname: string) {
  return PROTECTED_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

function getMiddlewareServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error('Supabase env manquantes pour le middleware.');
  }
  return createClient<Database>(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}

export async function middleware(req: NextRequest) {
  const canonicalRedirect = maybeRedirectToCanonicalHost(req);
  if (canonicalRedirect) {
    return canonicalRedirect;
  }

  if (req.nextUrl.pathname.startsWith('/back-office')) {
    return NextResponse.redirect(buildRedirectTo(req, '/organisme'));
  }

  if (!isProtectedPath(req.nextUrl.pathname)) {
    return NextResponse.next();
  }

  const res = NextResponse.next();
  const supabase = createMiddlewareClient<Database>({ req, res });
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(buildLoginRedirect(req));
  }

  const roleContext = await resolveRoleContextForUserId(user.id, getMiddlewareServiceClient());
  if (!canAccessBackofficePath(roleContext.role, req.nextUrl.pathname)) {
    return NextResponse.redirect(buildRedirectTo(req, getHomePathForRole(roleContext.role)));
  }

  return res;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|ttf|woff|woff2)$).*)'
  ]
};
