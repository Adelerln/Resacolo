import { NextResponse } from 'next/server';
import { z } from 'zod';
import { setSessionCookie, type AppRole } from '@/lib/auth/session';

export const runtime = 'nodejs';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  redirectTo: z.string().optional(),
  rememberMe: z.union([z.boolean(), z.string()]).optional()
});

function mapRole(
  memberships: { role: string; tenantId: string | null }[],
  organizerAccessIds: string[]
): {
  role: AppRole;
  tenantId?: string | null;
} {
  const admin = memberships.find((m) => m.role === 'PLATFORM_ADMIN' || m.role === 'SUPPORT');
  if (admin) return { role: 'ADMIN', tenantId: null };

  if (organizerAccessIds.length > 0) return { role: 'ORGANISATEUR', tenantId: organizerAccessIds[0] };

  const partner = memberships.find((m) => m.role === 'PARTNER_ADMIN' || m.role === 'PARTNER_AGENT');
  if (partner) return { role: 'PARTENAIRE', tenantId: partner.tenantId };

  return { role: 'CLIENT', tenantId: null };
}

function sanitizeRelativePath(value: string | undefined) {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed.startsWith('/') || trimmed.startsWith('//')) return null;
  return trimmed;
}

function canUseRedirectForRole(role: AppRole, path: string) {
  if (role === 'ADMIN') {
    return path.startsWith('/admin') || path.startsWith('/mnemos') || path.startsWith('/organisme');
  }
  if (role === 'ORGANISATEUR') return path.startsWith('/organisme');
  if (role === 'PARTENAIRE') return path.startsWith('/partenaire');
  return (
    !path.startsWith('/admin') &&
    !path.startsWith('/organisme') &&
    !path.startsWith('/partenaire') &&
    !path.startsWith('/mnemos')
  );
}

function assertDatabaseUrlConfigured() {
  const value = (process.env.DATABASE_URL ?? '').trim();
  if (!value) {
    throw new Error('DATABASE_URL is missing');
  }
  if (value.includes('<') || value.includes('>')) {
    throw new Error('DATABASE_URL contains placeholder values');
  }
}

function requestExpectsJson(req: Request) {
  const contentType = req.headers.get('content-type') ?? '';
  const accept = req.headers.get('accept') ?? '';
  return contentType.includes('application/json') || accept.includes('application/json');
}

function classifyLoginError(error: unknown): string {
  const message =
    error instanceof Error ? error.message.toLowerCase() : String(error ?? '').toLowerCase();

  if (message.includes('database_url') || message.includes('placeholder')) return 'db-config';
  if (
    message.includes("can't reach database server") ||
    message.includes('econnrefused') ||
    message.includes('econnreset') ||
    message.includes('etimedout') ||
    message.includes('connection')
  ) {
    return 'db-unreachable';
  }
  if (message.includes('prisma')) return 'db';
  if (message.includes('supabase')) return 'supabase';
  return 'server';
}


export async function POST(req: Request) {
  const expectsJson = requestExpectsJson(req);

  try {
    assertDatabaseUrlConfigured();

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
    const normalizedEmail = input.email.trim().toLowerCase();
    const rememberMe =
      input.rememberMe === true ||
      input.rememberMe === 'on' ||
      input.rememberMe === '1' ||
      input.rememberMe === 'true';

    const { prisma } = await import('@/lib/db');
    const { verifyPassword } = await import('@/lib/auth/password');
    const user = await prisma.user.findFirst({
      where: { email: { equals: normalizedEmail, mode: 'insensitive' } },
      include: { memberships: true }
    });

    if (!user || !user.passwordHash || !verifyPassword(input.password, user.passwordHash)) {
      if (expectsJson) {
        return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
      }
      return NextResponse.redirect(new URL('/login?error=invalid-credentials', req.url), {
        status: 303
      });
    }

    let organizerAccessIds: string[] = [];
    try {
      const { getServerSupabaseClient } = await import('@/lib/supabase/server');
      const supabase = getServerSupabaseClient();
      const { data: organizerAccessRows, error: organizerAccessError } = await supabase
        .from('organizer_backoffice_access')
        .select('organizer_id')
        .eq('app_user_id', user.id)
        .is('revoked_at', null);

      if (organizerAccessError) {
        console.warn('[auth/login] organizer_backoffice_access lookup failed:', organizerAccessError.message);
      }

      organizerAccessIds = Array.from(
        new Set((organizerAccessRows ?? []).map((row) => row.organizer_id).filter(Boolean))
      );
    } catch (supabaseError) {
      console.warn(
        '[auth/login] organizer_backoffice_access lookup unexpected failure:',
        supabaseError instanceof Error ? supabaseError.message : String(supabaseError)
      );
    }

    const { role, tenantId } = mapRole(
      user.memberships.map((m: { role: string; tenantId: string | null }) => ({
        role: m.role,
        tenantId: m.tenantId ?? null
      })),
      organizerAccessIds
    );

    await setSessionCookie({
      userId: user.id,
      email: user.email,
      name: user.name,
      role,
      tenantId
    }, { rememberMe });

    const defaultRedirect =
      role === 'ADMIN'
        ? '/admin'
        : role === 'ORGANISATEUR'
          ? '/organisme'
          : role === 'PARTENAIRE'
            ? '/partenaire'
            : '/';
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
