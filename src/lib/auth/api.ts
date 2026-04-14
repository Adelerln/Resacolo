import { NextResponse } from 'next/server';
import { getSession, type AppRole } from '@/lib/auth/session';

function isAuthBypassed() {
  return process.env.MOCK_UI === '1' || process.env.DISABLE_AUTH === '1';
}

export async function requireApiRole(req: Request, role: AppRole) {
  if (isAuthBypassed()) return null;

  const session = await getSession();
  if (!session || session.role !== role) {
    return NextResponse.redirect(new URL('/login', req.url), 303);
  }

  return null;
}

export async function requireApiAdmin(req: Request) {
  return requireApiRole(req, 'ADMIN');
}
