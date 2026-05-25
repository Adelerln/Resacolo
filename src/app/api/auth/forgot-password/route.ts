import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { z } from 'zod';
import type { Database } from '@/types/supabase';

export const runtime = 'nodejs';

const forgotPasswordSchema = z.object({
  email: z.string().email(),
  returnPath: z.string().optional()
});

function sanitizeRelativePath(value: string | undefined) {
  if (!value) return '/login/mot-de-passe-oublie';
  const trimmed = value.trim();
  if (!trimmed.startsWith('/') || trimmed.startsWith('//')) return '/login/mot-de-passe-oublie';
  if (trimmed === '/login/mot-de-passe-oublie') return trimmed;
  return '/login/mot-de-passe-oublie';
}

function buildUrl(req: Request, path: string, params: Record<string, string>) {
  const url = new URL(path, req.url);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return url;
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const parsed = forgotPasswordSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) {
      return NextResponse.redirect(
        buildUrl(req, '/login/mot-de-passe-oublie', { error: 'invalid-email' }),
        { status: 303 }
      );
    }

    const input = parsed.data;
    const returnPath = sanitizeRelativePath(input.returnPath);
    const resetRedirectTo = new URL('/login/reinitialiser', req.url).toString();

    const cookieStore = await cookies();
    const cookieAccess = (() => cookieStore) as unknown as typeof cookies;
    const supabase = createRouteHandlerClient<Database>({ cookies: cookieAccess });

    const { error } = await supabase.auth.resetPasswordForEmail(input.email.trim().toLowerCase(), {
      redirectTo: resetRedirectTo
    });

    if (error) {
      return NextResponse.redirect(
        buildUrl(req, returnPath, { error: 'send-failed' }),
        { status: 303 }
      );
    }

    return NextResponse.redirect(
      buildUrl(req, returnPath, { sent: '1' }),
      { status: 303 }
    );
  } catch (error) {
    console.error('[auth/forgot-password] unexpected error:', error);
    return NextResponse.redirect(
      buildUrl(req, '/login/mot-de-passe-oublie', { error: 'server' }),
      { status: 303 }
    );
  }
}

