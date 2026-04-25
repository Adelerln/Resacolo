import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(req: NextRequest) {
  void req;
  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/organisme/:path*', '/partenaire/:path*', '/mnemos/:path*']
};
