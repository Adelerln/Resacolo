import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

type SessionPayload = {
  role: 'ADMIN' | 'ORGANISATEUR' | 'PARTENAIRE' | 'CLIENT';
};

const knownRoles: SessionPayload['role'][] = ['ADMIN', 'ORGANISATEUR', 'PARTENAIRE', 'CLIENT'];

const protectedPrefixes = ['/admin', '/organisme', '/partenaire', '/mnemos'];

const roleHomePaths: Record<Exclude<SessionPayload['role'], 'CLIENT'>, string> = {
  ADMIN: '/admin',
  ORGANISATEUR: '/organisme',
  PARTENAIRE: '/partenaire'
};

const roleAllowedPrefixes: Record<SessionPayload['role'], string[]> = {
  ADMIN: ['/admin', '/mnemos', '/organisme'],
  ORGANISATEUR: ['/organisme'],
  PARTENAIRE: ['/partenaire'],
  CLIENT: []
};

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (process.env.MOCK_UI === '1' || process.env.DISABLE_AUTH === '1') {
    return NextResponse.next();
  }
  if (
    pathname.startsWith('/login') ||
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon')
  ) {
    return NextResponse.next();
  }

  const isProtected = protectedPrefixes.some((prefix) => pathname.startsWith(prefix));
  if (!isProtected) return NextResponse.next();

  const token = req.cookies.get('resacolo_session')?.value;
  if (!token) {
    return NextResponse.redirect(loginUrl(req));
  }

  const session = parseSession(token);
  if (!session) {
    return NextResponse.redirect(loginUrl(req));
  }

  const allowedPrefixes = roleAllowedPrefixes[session.role] ?? [];
  const isAllowed = allowedPrefixes.some((prefix) => pathname.startsWith(prefix));
  if (!isAllowed) {
    const url = req.nextUrl.clone();
    url.pathname = session.role === 'CLIENT' ? '/' : roleHomePaths[session.role];
    url.search = '';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

function loginUrl(req: NextRequest) {
  const url = req.nextUrl.clone();
  const redirectTo = `${req.nextUrl.pathname}${req.nextUrl.search}`;
  url.pathname = '/login';
  url.search = '';
  url.searchParams.set('redirectTo', redirectTo);
  return url;
}

function parseSession(token: string): SessionPayload | null {
  const [data] = token.split('.');
  if (!data) return null;
  try {
    const padded = data.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(data.length / 4) * 4, '=');
    const json = atob(padded);
    const payload = JSON.parse(json) as SessionPayload;
    if (!payload.role || !knownRoles.includes(payload.role)) return null;
    return payload;
  } catch {
    return null;
  }
}

export const config = {
  matcher: ['/admin/:path*', '/organisme/:path*', '/partenaire/:path*', '/mnemos/:path*', '/login']
};
