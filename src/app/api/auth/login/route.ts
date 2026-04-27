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

function canUseRedirectForRole(role: AppRole, path: string) {
  if (role === 'MNEMOS') return path.startsWith('/mnemos');
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


export async function POST(req: Request) {
  const expectsJson = requestExpectsJson(req);

  try {
    const contentType = req.headers.get('content-type') ?? '';
    const data =
      contentType.includes('application/json')
        ? await req.json()
        : Object.fromEntries(await req.formData());
    const parsed = loginSchema.safeParse(data);
    if (!parsed.success) {
      if (expectsJson) {
        return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
      }
      return NextResponse.redirect(new URL('/login?error=invalid-input', req.url), { status: 303 });
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
      return NextResponse.redirect(new URL('/login?error=invalid-credentials', req.url), {
        status: 303
      });
    }

    const roleContext = await resolveRoleContextForUserId(signInData.user.id);
    const role = mapRole(roleContext.role);

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
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(errorCode)}`, req.url), {
      status: 303
    });
  }
}
