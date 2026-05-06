import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import type { EmailOtpType } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';

export const runtime = 'nodejs';

const ALLOWED_TYPES: EmailOtpType[] = ['signup', 'invite', 'magiclink', 'recovery', 'email', 'email_change'];

function sanitizeRelativePath(value: string | null | undefined, fallback: string) {
  if (!value) return fallback;
  const trimmed = value.trim();
  if (!trimmed.startsWith('/') || trimmed.startsWith('//')) return fallback;
  return trimmed;
}

function buildConfirmationUrl(req: Request, status: 'success' | 'error') {
  const url = new URL('/confirmation-mail', req.url);
  url.searchParams.set('status', status);
  return url;
}

export async function GET(req: Request) {
  const requestUrl = new URL(req.url);
  const tokenHash = requestUrl.searchParams.get('token_hash');
  const type = requestUrl.searchParams.get('type');
  const next = sanitizeRelativePath(requestUrl.searchParams.get('next'), '/confirmation-mail');

  if (!tokenHash || !type || !ALLOWED_TYPES.includes(type as EmailOtpType)) {
    return NextResponse.redirect(buildConfirmationUrl(req, 'error'), { status: 303 });
  }

  const cookieStore = await cookies();
  const cookieAccess = (() => cookieStore) as unknown as typeof cookies;
  const supabase = createRouteHandlerClient<Database>({ cookies: cookieAccess });
  const { error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: type as EmailOtpType
  });

  if (error) {
    return NextResponse.redirect(buildConfirmationUrl(req, 'error'), { status: 303 });
  }

  const successUrl = new URL(next, req.url);
  successUrl.searchParams.set('status', 'success');
  return NextResponse.redirect(successUrl, { status: 303 });
}

