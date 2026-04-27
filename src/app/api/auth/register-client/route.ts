import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isPasswordPolicyValid, PASSWORD_POLICY_MESSAGE } from '@/lib/auth/password-policy';
import { getApiErrorMessage } from '@/lib/checkout/api';
import { getServerSupabaseClient } from '@/lib/supabase/server';
import type { Database } from '@/types/supabase';

export const runtime = 'nodejs';

const registerClientSchema = z.object({
  firstName: z.string().trim().min(2, 'Prénom requis.'),
  lastName: z.string().trim().min(2, 'Nom requis.'),
  email: z.string().trim().email('Adresse email invalide.'),
  password: z
    .string()
    .min(8, PASSWORD_POLICY_MESSAGE)
    .refine((value) => isPasswordPolicyValid(value), PASSWORD_POLICY_MESSAGE),
  redirectTo: z.string().optional()
});

export async function POST(req: Request) {
  const contentType = req.headers.get('content-type') ?? '';
  const isFormRequest =
    contentType.includes('application/x-www-form-urlencoded') ||
    contentType.includes('multipart/form-data');

  function sanitizeRelativePath(value: string | undefined, fallback: string) {
    if (!value) return fallback;
    const trimmed = value.trim();
    if (!trimmed.startsWith('/') || trimmed.startsWith('//')) return fallback;
    return trimmed;
  }

  function redirectFormError(errorMessage: string, redirectTo: string) {
    const url = new URL('/login/familles/creer-compte', req.url);
    url.searchParams.set('error', errorMessage);
    url.searchParams.set('redirectTo', redirectTo);
    return NextResponse.redirect(url, { status: 303 });
  }

  let safeRedirectTo = '/mon-compte';

  try {
    let body: unknown;
    try {
      body = contentType.includes('application/json')
        ? await req.json()
        : Object.fromEntries(await req.formData());
    } catch {
      if (isFormRequest) {
        return redirectFormError('Corps de requête invalide.', safeRedirectTo);
      }
      return NextResponse.json({ error: 'Corps de requête invalide.' }, { status: 400 });
    }

    const input = registerClientSchema.parse(body);
    safeRedirectTo = sanitizeRelativePath(input.redirectTo, '/mon-compte');
    const email = input.email.toLowerCase();
    const name = `${input.firstName} ${input.lastName}`.trim();
    const cookieStore = await cookies();
    const cookieAccess = (() => cookieStore) as unknown as typeof cookies;
    const supabase = createRouteHandlerClient<Database>({
      cookies: cookieAccess
    });
    const { data, error } = await supabase.auth.signUp({
      email,
      password: input.password,
      options: {
        data: {
          first_name: input.firstName,
          last_name: input.lastName,
          full_name: name,
          name
        }
      }
    });

    if (error || !data.user?.id) {
      const isExistingAccount = error?.message?.toLowerCase().includes('already registered');
      const message =
        isExistingAccount
          ? 'Un compte existe déjà avec cette adresse email.'
          : error?.message ?? 'Impossible de créer le compte.';
      if (isFormRequest) {
        return redirectFormError(message, safeRedirectTo);
      }
      return NextResponse.json({ error: message }, { status: isExistingAccount ? 409 : 500 });
    }

    const serverSupabase = getServerSupabaseClient();
    const { error: clientError } = await serverSupabase.from('clients').upsert(
      {
        user_id: data.user.id,
        full_name: name || null,
        phone: null,
        collectivity_id: null
      },
      { onConflict: 'user_id' }
    );

    if (clientError) {
      if (isFormRequest) {
        return redirectFormError(clientError.message, safeRedirectTo);
      }
      return NextResponse.json({ error: clientError.message }, { status: 500 });
    }

    if (isFormRequest) {
      const redirectUrl = data.session
        ? new URL(safeRedirectTo, req.url)
        : new URL(`/login/familles?registered=1&redirectTo=${encodeURIComponent(safeRedirectTo)}`, req.url);
      return NextResponse.redirect(redirectUrl, { status: 303 });
    }

    return NextResponse.json({
      ok: true,
      user: {
        id: data.user.id,
        email: data.user.email,
        name
      },
      requiresEmailConfirmation: !data.session
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      if (isFormRequest) {
        return redirectFormError(getApiErrorMessage(error), safeRedirectTo);
      }
      return NextResponse.json({ error: getApiErrorMessage(error) }, { status: 400 });
    }
    console.error('[register-client]', error);
    if (isFormRequest) {
      return redirectFormError(getApiErrorMessage(error), safeRedirectTo);
    }
    return NextResponse.json({ error: getApiErrorMessage(error) }, { status: 500 });
  }
}
