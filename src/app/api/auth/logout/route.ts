import { NextResponse } from 'next/server';
import { clearSessionCookie } from '@/lib/auth/session';

export const runtime = 'nodejs';

function sanitizeRelativePath(value: unknown, fallback: string) {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  if (!trimmed.startsWith('/') || trimmed.startsWith('//')) return fallback;
  return trimmed;
}

export async function POST(req: Request) {
  const contentType = req.headers.get('content-type') ?? '';
  let redirectPath = '/login';

  if (contentType.includes('application/json')) {
    try {
      const body = await req.json();
      redirectPath = sanitizeRelativePath(body?.redirectTo, '/login');
    } catch {
      redirectPath = '/login';
    }
  } else {
    try {
      const formData = await req.formData();
      redirectPath = sanitizeRelativePath(formData.get('redirectTo'), '/login');
    } catch {
      redirectPath = '/login';
    }
  }

  await clearSessionCookie();
  return NextResponse.redirect(new URL(redirectPath, req.url), { status: 303 });
}
