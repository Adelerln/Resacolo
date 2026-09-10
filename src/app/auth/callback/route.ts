import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { logUserLoginEvent } from '@/lib/auth/login-events.server';
import { getHomePathForRole, resolveRoleContextForUserId, type AppRole } from '@/lib/auth/roles';
import { getServerSupabaseClient } from '@/lib/supabase/server';
import type { Database } from '@/types/supabase';

export const runtime = 'nodejs';

function sanitizeRelativePath(value: string | null | undefined, fallback: string) {
  if (!value) return fallback;
  const trimmed = value.trim();
  if (!trimmed.startsWith('/') || trimmed.startsWith('//')) return fallback;
  return trimmed;
}

function canUseRedirectForRole(role: AppRole, path: string) {
  if (role === 'MNEMOS') {
    return (
      path.startsWith('/mnemos') ||
      path.startsWith('/admin') ||
      path.startsWith('/organisme') ||
      path.startsWith('/partenaire')
    );
  }
  if (role === 'ADMIN') return path.startsWith('/admin');
  if (role === 'ADMIN_SALES') return path.startsWith('/admin');
  if (role === 'ORGANISATEUR') return path.startsWith('/organisme');
  if (role === 'PARTENAIRE') return path.startsWith('/partenaire');
  return (
    !path.startsWith('/admin') &&
    !path.startsWith('/organisme') &&
    !path.startsWith('/partenaire') &&
    !path.startsWith('/mnemos')
  );
}

function isRoleAllowedForLoginMode(role: AppRole, loginMode: 'family' | 'pro') {
  if (loginMode === 'family') return role === 'CLIENT';
  return (
    role === 'ORGANISATEUR' ||
    role === 'PARTENAIRE' ||
    role === 'ADMIN' ||
    role === 'ADMIN_SALES' ||
    role === 'MNEMOS'
  );
}

function buildLoginErrorUrl(
  req: Request,
  errorCode: string,
  loginMode: 'family' | 'pro',
  next: string
) {
  const url = new URL('/login', req.url);
  url.searchParams.set('error', errorCode);
  url.searchParams.set('mode', loginMode);
  url.searchParams.set('redirectTo', next);
  return url;
}

async function ensureClientRowForOauthUser(user: {
  id: string;
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
}) {
  const metadata = user.user_metadata ?? {};
  const fullName =
    (typeof metadata.full_name === 'string' && metadata.full_name.trim()) ||
    (typeof metadata.name === 'string' && metadata.name.trim()) ||
    null;

  const admin = getServerSupabaseClient();
  const { error } = await admin.from('clients').upsert(
    {
      user_id: user.id,
      full_name: fullName
    },
    { onConflict: 'user_id' }
  );

  if (error) {
    console.warn('[auth/callback] clients upsert skipped:', error.message);
  }
}

export async function GET(req: Request) {
  const requestUrl = new URL(req.url);
  const code = requestUrl.searchParams.get('code');
  const oauthError = requestUrl.searchParams.get('error');
  const oauthErrorDescription = requestUrl.searchParams.get('error_description');
  const flow = requestUrl.searchParams.get('flow') ?? 'login';
  const loginMode =
    requestUrl.searchParams.get('loginMode') === 'pro' ? 'pro' : 'family';
  const next = sanitizeRelativePath(
    requestUrl.searchParams.get('next'),
    flow === 'recovery'
      ? '/login/reinitialiser'
      : loginMode === 'family'
        ? '/mon-compte'
        : '/organisme'
  );

  if (oauthError) {
    console.error('[auth/callback] oauth provider error:', oauthError, oauthErrorDescription);
    return NextResponse.redirect(buildLoginErrorUrl(req, 'oauth-failed', loginMode, next), {
      status: 303
    });
  }

  if (!code) {
    return NextResponse.redirect(buildLoginErrorUrl(req, 'oauth-failed', loginMode, next), {
      status: 303
    });
  }

  const cookieStore = await cookies();
  const cookieAccess = (() => cookieStore) as unknown as typeof cookies;
  const supabase = createRouteHandlerClient<Database>({ cookies: cookieAccess });

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) {
    console.error('[auth/callback] exchangeCodeForSession failed:', error?.message);
    await logUserLoginEvent({
      req,
      email: data.user?.email ?? undefined,
      outcome: 'failure',
      errorCode: 'oauth-failed',
      loginMode,
      loginPath: '/login',
      redirectTo: next
    });
    return NextResponse.redirect(buildLoginErrorUrl(req, 'oauth-failed', loginMode, next), {
      status: 303
    });
  }

  if (flow === 'recovery' || flow === 'email-change') {
    const redirectResponse = NextResponse.redirect(new URL(next, req.url), { status: 303 });
    redirectResponse.headers.set('Cache-Control', 'no-store');
    for (const cookie of cookieStore.getAll()) {
      const name = cookie.name;
      if (name.includes('sb-') || name.includes('supabase') || name.startsWith('resacolo_')) {
        redirectResponse.cookies.set(name, cookie.value);
      }
    }
    return redirectResponse;
  }

  const roleContext = await resolveRoleContextForUserId(data.user.id);
  const role = roleContext.role;

  if (!isRoleAllowedForLoginMode(role, loginMode)) {
    await supabase.auth.signOut();
    const errorCode = loginMode === 'pro' ? 'wrong-login-space-pro' : 'wrong-login-space-family';
    await logUserLoginEvent({
      req,
      userId: data.user.id,
      email: data.user.email ?? undefined,
      outcome: 'failure',
      errorCode,
      loginMode,
      loginPath: '/login',
      redirectTo: next
    });
    return NextResponse.redirect(buildLoginErrorUrl(req, errorCode, loginMode, next), {
      status: 303
    });
  }

  if (role === 'CLIENT') {
    await ensureClientRowForOauthUser(data.user);
  }

  const defaultRedirect = getHomePathForRole(role);
  const redirectPath =
    next.startsWith('/confirmation-mail') || canUseRedirectForRole(role, next.split('?')[0] ?? next)
      ? next
      : defaultRedirect;

  void logUserLoginEvent({
    req,
    userId: data.user.id,
    email: data.user.email ?? undefined,
    outcome: 'success',
    loginMode,
    loginPath: '/login',
    redirectTo: redirectPath
  });

  const redirectResponse = NextResponse.redirect(new URL(redirectPath, req.url), { status: 303 });
  redirectResponse.headers.set('Cache-Control', 'no-store');
  for (const cookie of cookieStore.getAll()) {
    const name = cookie.name;
    if (name.includes('sb-') || name.includes('supabase') || name.startsWith('resacolo_')) {
      redirectResponse.cookies.set(name, cookie.value);
    }
  }
  return redirectResponse;
}
