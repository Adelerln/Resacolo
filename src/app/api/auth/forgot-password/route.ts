import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { buildAuthCallbackUrl } from '@/lib/auth/urls';
import {
  ensureAuthUserForLegacyCustomer,
  findAuthUserIdByEmail,
  findLegacyWpCustomerByEmail
} from '@/lib/legacy-wp/server';
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
    const email = input.email.trim().toLowerCase();
    const returnPath = sanitizeRelativePath(input.returnPath);
    const resetRedirectTo = buildAuthCallbackUrl(req, {
      next: '/login/reinitialiser',
      flow: 'recovery'
    });

    let legacyDetected = false;
    try {
      const legacy = await findLegacyWpCustomerByEmail(email);
      if (legacy) {
        legacyDetected = true;
        const existingAuthId = await findAuthUserIdByEmail(email);
        if (!existingAuthId) {
          await ensureAuthUserForLegacyCustomer({
            email,
            firstName: legacy.first_name,
            lastName: legacy.last_name
          });
        }
      }
    } catch (legacyError) {
      console.warn('[auth/forgot-password] legacy bootstrap failed:', legacyError);
    }

    const cookieStore = await cookies();
    const cookieAccess = (() => cookieStore) as unknown as typeof cookies;
    const supabase = createRouteHandlerClient<Database>({ cookies: cookieAccess });

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: resetRedirectTo
    });

    if (error) {
      return NextResponse.redirect(
        buildUrl(req, returnPath, { error: 'send-failed' }),
        { status: 303 }
      );
    }

    const successParams: Record<string, string> = { sent: '1', email };
    if (legacyDetected) successParams.legacy = '1';

    return NextResponse.redirect(buildUrl(req, returnPath, successParams), { status: 303 });
  } catch (error) {
    console.error('[auth/forgot-password] unexpected error:', error);
    return NextResponse.redirect(
      buildUrl(req, '/login/mot-de-passe-oublie', { error: 'server' }),
      { status: 303 }
    );
  }
}
