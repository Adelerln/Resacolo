import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import type { Database } from '@/types/supabase';

export const runtime = 'nodejs';

function sanitizeRelativePath(value: unknown, fallback: string) {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  if (!trimmed.startsWith('/') || trimmed.startsWith('//')) return fallback;
  return trimmed;
}

async function signOutAndRedirect(req: Request, redirectPath: string) {
  const cookieStore = await cookies();
  const cookieAccess = (() => cookieStore) as unknown as typeof cookies;
  const supabase = createRouteHandlerClient<Database>({
    cookies: cookieAccess
  });
  await supabase.auth.signOut();
  cookieStore.set('resacolo_session', '', {
    path: '/',
    expires: new Date(0)
  });
  return NextResponse.redirect(new URL(redirectPath, req.url), { status: 303 });
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const redirectPath = sanitizeRelativePath(url.searchParams.get('redirectTo'), '/login');
  return signOutAndRedirect(req, redirectPath);
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

  return signOutAndRedirect(req, redirectPath);
}
