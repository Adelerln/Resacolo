import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import type { EmailOtpType } from '@supabase/supabase-js';
import { syncClientProfileEmailFromAuthUser } from '@/lib/auth/sync-client-email';
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
  const code = requestUrl.searchParams.get('code');
  const next = sanitizeRelativePath(requestUrl.searchParams.get('next'), '/confirmation-mail');

  const cookieStore = await cookies();
  const cookieAccess = (() => cookieStore) as unknown as typeof cookies;
  const supabase = createRouteHandlerClient<Database>({ cookies: cookieAccess });

  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.redirect(buildConfirmationUrl(req, 'error'), { status: 303 });
    }
    if (data.user) {
      await syncClientProfileEmailFromAuthUser({
        userId: data.user.id,
        email: data.user.email
      });
    }
    const successUrl = new URL(next, req.url);
    if (!successUrl.searchParams.has('status')) {
      successUrl.searchParams.set('status', 'success');
    }
    return NextResponse.redirect(successUrl, { status: 303 });
  }

  if (!tokenHash || !type || !ALLOWED_TYPES.includes(type as EmailOtpType)) {
    return NextResponse.redirect(buildConfirmationUrl(req, 'error'), { status: 303 });
  }

  const { data, error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: type as EmailOtpType
  });

  if (error) {
    return NextResponse.redirect(buildConfirmationUrl(req, 'error'), { status: 303 });
  }

  if (type === 'email_change' && data.user) {
    await syncClientProfileEmailFromAuthUser({
      userId: data.user.id,
      email: data.user.email
    });
  }

  const successUrl = new URL(next, req.url);
  successUrl.searchParams.set('status', 'success');
  return NextResponse.redirect(successUrl, { status: 303 });
}

export async function POST(req: Request) {
  const formData = await req.formData();
  const tokenHash = String(formData.get('token_hash') ?? '').trim();
  const type = String(formData.get('type') ?? '').trim();
  const next = sanitizeRelativePath(String(formData.get('next') ?? ''), '/confirmation-mail');

  if (!tokenHash || !type || !ALLOWED_TYPES.includes(type as EmailOtpType)) {
    return NextResponse.redirect(buildConfirmationUrl(req, 'error'), { status: 303 });
  }

  const cookieStore = await cookies();
  const cookieAccess = (() => cookieStore) as unknown as typeof cookies;
  const supabase = createRouteHandlerClient<Database>({ cookies: cookieAccess });
  const { data, error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: type as EmailOtpType
  });

  if (error) {
    console.error('[auth/confirm] POST verifyOtp failed:', error.message);
    return NextResponse.redirect(buildConfirmationUrl(req, 'error'), { status: 303 });
  }

  if (type === 'email_change' && data.user) {
    await syncClientProfileEmailFromAuthUser({
      userId: data.user.id,
      email: data.user.email
    });
  }

  const successUrl = new URL(next, req.url);
  successUrl.searchParams.set('status', 'success');
  return NextResponse.redirect(successUrl, { status: 303 });
}
