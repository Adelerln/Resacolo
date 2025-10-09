import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createMiddlewareSupabaseClient } from '@supabase/auth-helpers-nextjs';

export async function middleware(request: NextRequest) {
  const response = NextResponse.next({
    request: {
      headers: request.headers
    }
  });

  const supabase = createMiddlewareSupabaseClient({ req: request, res: response });
  const {
    data: { session }
  } = await supabase.auth.getSession();

  const { pathname } = request.nextUrl;
  const isAuthPage = pathname === '/login' || pathname === '/signup';
  const isProtectedPage = pathname === '/dashboard';
  const isProtectedApi = pathname.startsWith('/api/');

  if (!session && (isProtectedPage || isProtectedApi)) {
    if (isProtectedApi) {
      return NextResponse.json({ message: 'Authentification requise.' }, { status: 401 });
    }

    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = '/login';
    redirectUrl.searchParams.set('redirectedFrom', pathname);
    return NextResponse.redirect(redirectUrl);
  }

  if (session && isAuthPage) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = '/dashboard';
    redirectUrl.search = '';
    return NextResponse.redirect(redirectUrl);
  }

  return response;
}

export const config = {
  matcher: ['/dashboard', '/login', '/signup', '/api/:path*']
};
