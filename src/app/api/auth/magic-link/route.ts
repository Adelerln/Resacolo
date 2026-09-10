import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { buildAuthCallbackUrl, sanitizeAuthRelativePath } from '@/lib/auth/urls';
import type { Database } from '@/types/supabase';

export const runtime = 'nodejs';

const schema = z.object({
  email: z.string().email(),
  loginMode: z.enum(['family', 'pro']).optional(),
  redirectTo: z.string().optional(),
  returnPath: z.string().optional()
});

function buildRedirect(req: Request, path: string, params: Record<string, string>) {
  const url = new URL(path, req.url);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return url;
}

export async function POST(req: Request) {
  const contentType = req.headers.get('content-type') ?? '';
  const expectsJson = contentType.includes('application/json');

  try {
    const raw = expectsJson
      ? await req.json()
      : Object.fromEntries(await req.formData());
    const parsed = schema.safeParse(raw);
    const loginMode = parsed.success && parsed.data.loginMode === 'pro' ? 'pro' : 'family';
    const returnPath = sanitizeAuthRelativePath(
      parsed.success ? parsed.data.returnPath : undefined,
      '/login'
    );
    const next = sanitizeAuthRelativePath(
      parsed.success ? parsed.data.redirectTo : undefined,
      loginMode === 'family' ? '/mon-compte' : '/organisme'
    );

    if (!parsed.success) {
      if (expectsJson) {
        return NextResponse.json({ error: 'Adresse e-mail invalide.' }, { status: 400 });
      }
      return NextResponse.redirect(
        buildRedirect(req, returnPath, { error: 'invalid-email', mode: loginMode }),
        { status: 303 }
      );
    }

    const cookieStore = await cookies();
    const cookieAccess = (() => cookieStore) as unknown as typeof cookies;
    const supabase = createRouteHandlerClient<Database>({ cookies: cookieAccess });

    const emailRedirectTo = buildAuthCallbackUrl(req, {
      next,
      loginMode,
      flow: 'login'
    });

    const { error } = await supabase.auth.signInWithOtp({
      email: parsed.data.email.trim().toLowerCase(),
      options: {
        emailRedirectTo,
        shouldCreateUser: false
      }
    });

    // Toujours réponse générique (évite l'énumération de comptes).
    if (error && !error.message.toLowerCase().includes('signups not allowed')) {
      console.warn('[auth/magic-link]', error.message);
    }

    if (expectsJson) {
      return NextResponse.json({
        ok: true,
        message: 'Si un compte existe avec cet e-mail, un lien de connexion vient d’être envoyé.'
      });
    }

    return NextResponse.redirect(
      buildRedirect(req, returnPath, {
        magicSent: '1',
        mode: loginMode,
        redirectTo: next
      }),
      { status: 303 }
    );
  } catch (error) {
    console.error('[auth/magic-link]', error);
    if (expectsJson) {
      return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 });
    }
    return NextResponse.redirect(
      buildRedirect(req, '/login', { error: 'server' }),
      { status: 303 }
    );
  }
}
