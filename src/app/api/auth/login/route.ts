import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { logUserLoginEvent } from '@/lib/auth/login-events.server';
import { getHomePathForRole, resolveRoleContextForUserId, type AppRole } from '@/lib/auth/roles';
import type { Database } from '@/types/supabase';

export const runtime = 'nodejs';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  redirectTo: z.string().optional(),
  loginPath: z.string().optional(),
  loginMode: z.enum(['family', 'pro']).optional(),
  rememberMe: z.union([z.boolean(), z.string()]).optional()
});

function mapRole(
  role: AppRole
) {
  return role;
}

function sanitizeRelativePath(value: string | undefined) {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed.startsWith('/') || trimmed.startsWith('//')) return null;
  return trimmed;
}

function sanitizeLoginPath(value: string | undefined) {
  const path = sanitizeRelativePath(value);
  if (!path) return '/login';
  if (path === '/login' || path === '/login/familles' || path === '/login/organisateur') {
    return path;
  }
  return '/login';
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

function requestExpectsJson(req: Request) {
  const contentType = req.headers.get('content-type') ?? '';
  const accept = req.headers.get('accept') ?? '';
  return contentType.includes('application/json') || accept.includes('application/json');
}

function classifyLoginError(error: unknown): string {
  const message =
    error instanceof Error ? error.message.toLowerCase() : String(error ?? '').toLowerCase();

  if (message.includes('supabase')) return 'supabase';
  return 'server';
}

function classifySignInErrorCode(
  error: unknown
): 'email-not-confirmed' | 'rate-limited' | 'invalid-credentials' {
  const message =
    error instanceof Error ? error.message.toLowerCase() : String(error ?? '').toLowerCase();
  const code =
    error && typeof error === 'object' && 'code' in error
      ? String((error as { code?: string }).code ?? '').toLowerCase()
      : '';
  const status =
    error && typeof error === 'object' && 'status' in error
      ? Number((error as { status?: number }).status)
      : null;

  if (
    status === 429 ||
    code.includes('rate_limit') ||
    message.includes('rate limit') ||
    message.includes('too many requests')
  ) {
    return 'rate-limited';
  }
  if (
    message.includes('email not confirmed') ||
    message.includes('email_not_confirmed') ||
    message.includes('signup is disabled') // fallback rare tenant messages
  ) {
    return 'email-not-confirmed';
  }
  return 'invalid-credentials';
}

function getSupabaseHostLabel() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) return 'non-configuré';
  try {
    return new URL(url).hostname;
  } catch {
    return 'url-invalide';
  }
}

function sanitizeErrorDetail(value: string | undefined) {
  if (!value) return null;
  const trimmed = value.trim().slice(0, 240);
  if (!trimmed) return null;
  return trimmed.replace(/[^\w\s.,:;!?()\-'àâäéèêëïîôùûüçÀÂÄÉÈÊËÏÎÔÙÛÜÇ/@]/g, '') || null;
}

function appendLoginDebugParams(
  url: URL,
  options?: { detail?: string | null; status?: string | number | null; code?: string | null }
) {
  if (process.env.NODE_ENV !== 'development') return;
  url.searchParams.set('supabaseHost', getSupabaseHostLabel());
  const detail = sanitizeErrorDetail(options?.detail ?? undefined);
  if (detail) url.searchParams.set('errorDetail', detail);
  if (options?.status != null && String(options.status).length > 0) {
    url.searchParams.set('errorStatus', String(options.status));
  }
  if (options?.code) url.searchParams.set('errorCodeSupabase', options.code);
}

function buildLoginErrorUrl({
  req,
  loginPath,
  errorCode,
  redirectTo,
  loginMode,
  debug
}: {
  req: Request;
  loginPath: string;
  errorCode: string;
  redirectTo?: string;
  loginMode?: 'family' | 'pro';
  debug?: { detail?: string | null; status?: string | number | null; code?: string | null };
}) {
  const url = new URL(loginPath, req.url);
  url.searchParams.set('error', errorCode);
  const safeRedirectTo = sanitizeRelativePath(redirectTo);
  if (safeRedirectTo) {
    url.searchParams.set('redirectTo', safeRedirectTo);
  }
  if (loginMode) {
    url.searchParams.set('mode', loginMode);
  }
  appendLoginDebugParams(url, debug);
  return url;
}

function formatSignInErrorDetail(error: unknown) {
  if (!error || typeof error !== 'object') {
    return { detail: 'Aucune réponse utilisateur Supabase.', status: null, code: null };
  }
  const authError = error as { message?: string; status?: number; code?: string };
  const parts = [authError.message?.trim()].filter(Boolean);
  if (authError.code) parts.push(`code=${authError.code}`);
  return {
    detail: parts.join(' · ') || 'Erreur auth sans message.',
    status: authError.status ?? null,
    code: authError.code ?? null
  };
}

function getOptionalField(input: unknown, key: string) {
  if (!input || typeof input !== 'object') return undefined;
  const value = (input as Record<string, unknown>)[key];
  return typeof value === 'string' ? value : undefined;
}

function isRoleAllowedForLoginMode(role: AppRole, loginMode: 'family' | 'pro' | undefined) {
  if (!loginMode) return true;
  if (loginMode === 'family') return role === 'CLIENT';
  return (
    role === 'ORGANISATEUR' ||
    role === 'PARTENAIRE' ||
    role === 'ADMIN' ||
    role === 'ADMIN_SALES' ||
    role === 'MNEMOS'
  );
}

export async function POST(req: Request) {
  const expectsJson = requestExpectsJson(req);
  let loginPath = '/login';
  let redirectTo: string | undefined;
  let loginMode: 'family' | 'pro' | undefined;
  let attemptEmail: string | undefined;

  try {
    const contentType = req.headers.get('content-type') ?? '';
    const data =
      contentType.includes('application/json')
        ? await req.json()
        : Object.fromEntries(await req.formData());
    loginPath = sanitizeLoginPath(getOptionalField(data, 'loginPath'));
    redirectTo = getOptionalField(data, 'redirectTo');
    loginMode = getOptionalField(data, 'loginMode') === 'pro' ? 'pro' : getOptionalField(data, 'loginMode') === 'family' ? 'family' : undefined;
    attemptEmail = getOptionalField(data, 'email');
    const parsed = loginSchema.safeParse(data);
    if (!parsed.success) {
      await logUserLoginEvent({
        req,
        email: attemptEmail,
        outcome: 'failure',
        errorCode: 'invalid-input',
        loginMode,
        loginPath,
        redirectTo
      });
      if (expectsJson) {
        return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
      }
      return NextResponse.redirect(
        buildLoginErrorUrl({
          req,
          loginPath,
          errorCode: 'invalid-input',
          redirectTo,
          loginMode
        }),
        { status: 303 }
      );
    }
    const input = parsed.data;
    const cookieStore = await cookies();
    const cookieAccess = (() => cookieStore) as unknown as typeof cookies;
    const supabase = createRouteHandlerClient<Database>({
      cookies: cookieAccess
    });

    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: input.email.trim().toLowerCase(),
      password: input.password
    });

    if (signInError || !signInData.user) {
      const errorCode = classifySignInErrorCode(signInError);
      const signInDebug = formatSignInErrorDetail(signInError);
      await logUserLoginEvent({
        req,
        email: input.email,
        outcome: 'failure',
        errorCode,
        loginMode: input.loginMode,
        loginPath,
        redirectTo: input.redirectTo
      });
      if (expectsJson) {
        if (errorCode === 'email-not-confirmed') {
          return NextResponse.json({ error: 'Email not confirmed', code: errorCode }, { status: 403 });
        }
        return NextResponse.json({ error: 'Invalid credentials', code: errorCode }, { status: 401 });
      }
      return NextResponse.redirect(
        buildLoginErrorUrl({
          req,
          loginPath,
          errorCode,
          redirectTo: input.redirectTo,
          loginMode: input.loginMode,
          debug: signInDebug
        }),
        { status: 303 }
      );
    }

    const roleContext = await resolveRoleContextForUserId(signInData.user.id);
    const role = mapRole(roleContext.role);

    if (!isRoleAllowedForLoginMode(role, input.loginMode)) {
      await supabase.auth.signOut();
      const errorCode = input.loginMode === 'pro' ? 'wrong-login-space-pro' : 'wrong-login-space-family';
      await logUserLoginEvent({
        req,
        userId: signInData.user.id,
        email: signInData.user.email ?? input.email,
        outcome: 'failure',
        errorCode,
        loginMode: input.loginMode,
        loginPath,
        redirectTo: input.redirectTo
      });
      if (expectsJson) {
        return NextResponse.json({ error: 'Login mode mismatch', code: errorCode }, { status: 403 });
      }
      return NextResponse.redirect(
        buildLoginErrorUrl({
          req,
          loginPath,
          errorCode,
          redirectTo: input.redirectTo,
          loginMode: input.loginMode
        }),
        { status: 303 }
      );
    }

    const defaultRedirect = getHomePathForRole(role);
    const requestedRedirect = sanitizeRelativePath(input.redirectTo);
    const redirectPath =
      requestedRedirect && canUseRedirectForRole(role, requestedRedirect)
        ? requestedRedirect
        : defaultRedirect;

    await logUserLoginEvent({
      req,
      userId: signInData.user.id,
      email: signInData.user.email ?? input.email,
      outcome: 'success',
      loginMode: input.loginMode,
      loginPath,
      redirectTo: redirectPath
    });

    return NextResponse.redirect(new URL(redirectPath, req.url), { status: 303 });
  } catch (error) {
    console.error('[auth/login] unexpected error:', error);
    const errorCode = classifyLoginError(error);
    const detail = error instanceof Error ? error.message : String(error ?? '');
    await logUserLoginEvent({
      req,
      email: attemptEmail,
      outcome: 'failure',
      errorCode,
      loginMode,
      loginPath,
      redirectTo
    });
    if (expectsJson) {
      return NextResponse.json({ error: 'Authentication error', code: errorCode }, { status: 500 });
    }
    return NextResponse.redirect(
      buildLoginErrorUrl({
        req,
        loginPath,
        errorCode,
        redirectTo,
        loginMode,
        debug: { detail, status: null, code: null }
      }),
      { status: 303 }
    );
  }
}
