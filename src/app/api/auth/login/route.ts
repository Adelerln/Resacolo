import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { z } from 'zod';
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

function buildLoginErrorUrl({
  req,
  loginPath,
  errorCode,
  redirectTo,
  loginMode
}: {
  req: Request;
  loginPath: string;
  errorCode: string;
  redirectTo?: string;
  loginMode?: 'family' | 'pro';
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
  return url;
}

function getOptionalField(input: unknown, key: string) {
  if (!input || typeof input !== 'object') return undefined;
  const value = (input as Record<string, unknown>)[key];
  return typeof value === 'string' ? value : undefined;
}

function isRoleAllowedForLoginMode(role: AppRole, loginMode: 'family' | 'pro' | undefined) {
  if (!loginMode) return true;
  if (loginMode === 'family') return role === 'CLIENT';
  return role === 'ORGANISATEUR' || role === 'PARTENAIRE' || role === 'ADMIN' || role === 'MNEMOS';
}

export async function POST(req: Request) {
  const expectsJson = requestExpectsJson(req);
  let loginPath = '/login';
  let redirectTo: string | undefined;
  let loginMode: 'family' | 'pro' | undefined;

  try {
    const contentType = req.headers.get('content-type') ?? '';
    const data =
      contentType.includes('application/json')
        ? await req.json()
        : Object.fromEntries(await req.formData());
    loginPath = sanitizeLoginPath(getOptionalField(data, 'loginPath'));
    redirectTo = getOptionalField(data, 'redirectTo');
    loginMode = getOptionalField(data, 'loginMode') === 'pro' ? 'pro' : getOptionalField(data, 'loginMode') === 'family' ? 'family' : undefined;
    const parsed = loginSchema.safeParse(data);
    if (!parsed.success) {
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
      if (expectsJson) {
        return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
      }
      return NextResponse.redirect(
        buildLoginErrorUrl({
          req,
          loginPath,
          errorCode: 'invalid-credentials',
          redirectTo: input.redirectTo,
          loginMode: input.loginMode
        }),
        { status: 303 }
      );
    }

    const roleContext = await resolveRoleContextForUserId(signInData.user.id);
    const role = mapRole(roleContext.role);

    if (!isRoleAllowedForLoginMode(role, input.loginMode)) {
      await supabase.auth.signOut();
      const errorCode = input.loginMode === 'pro' ? 'wrong-login-space-pro' : 'wrong-login-space-family';
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

    return NextResponse.redirect(new URL(redirectPath, req.url), { status: 303 });
  } catch (error) {
    console.error('[auth/login] unexpected error:', error);
    const errorCode = classifyLoginError(error);
    if (expectsJson) {
      return NextResponse.json({ error: 'Authentication error', code: errorCode }, { status: 500 });
    }
    return NextResponse.redirect(
      buildLoginErrorUrl({
        req,
        loginPath,
        errorCode,
        redirectTo,
        loginMode
      }),
      { status: 303 }
    );
  }
}
