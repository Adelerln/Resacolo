import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
type SessionPayload = {
  role: 'ADMIN' | 'ORGANISATEUR' | 'PARTENAIRE';
};

const rolePaths: Record<string, string> = {
  ADMIN: '/admin',
  ORGANISATEUR: '/organizer',
  PARTENAIRE: '/partner'
};

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (
    pathname.startsWith('/login') ||
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon')
  ) {
    return NextResponse.next();
  }

  const protectedPrefixes = ['/admin', '/organizer', '/partner'];
  const isProtected = protectedPrefixes.some((prefix) => pathname.startsWith(prefix));
  if (!isProtected) return NextResponse.next();

  const token = req.cookies.get('resacolo_session')?.value;
  if (!token) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  const session = parseSession(token);
  if (!session) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  const expectedPrefix = rolePaths[session.role];
  if (expectedPrefix && !pathname.startsWith(expectedPrefix)) {
    const url = req.nextUrl.clone();
    url.pathname = expectedPrefix;
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

function parseSession(token: string): SessionPayload | null {
  const [data] = token.split('.');
  if (!data) return null;
  try {
    const padded = data.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(data.length / 4) * 4, '=');
    const json = atob(padded);
    const payload = JSON.parse(json) as SessionPayload;
    if (!payload.role) return null;
    return payload;
  } catch {
    return null;
  }
}

export const config = {
  matcher: ['/admin/:path*', '/organizer/:path*', '/partner/:path*', '/login']
};
