import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isPasswordPolicyValid, PASSWORD_POLICY_MESSAGE } from '@/lib/auth/password-policy';
import { hashPassword } from '@/lib/auth/password';
import { setSessionCookie } from '@/lib/auth/session';
import { getApiErrorMessage } from '@/lib/checkout/api';
import { prisma } from '@/lib/db';

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

    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser?.passwordHash) {
      if (isFormRequest) {
        return redirectFormError('Un compte existe déjà avec cette adresse email.', safeRedirectTo);
      }
      return NextResponse.json({ error: 'Un compte existe déjà avec cette adresse email.' }, { status: 409 });
    }

    const name = `${input.firstName} ${input.lastName}`.trim();
    const passwordHash = hashPassword(input.password);

    const user = existingUser
      ? await prisma.user.update({
          where: { id: existingUser.id },
          data: {
            name: name || existingUser.name,
            passwordHash,
            status: existingUser.status ?? 'ACTIVE'
          }
        })
      : await prisma.user.create({
          data: {
            email,
            name,
            passwordHash,
            status: 'ACTIVE'
          }
        });

    await setSessionCookie({
      userId: user.id,
      email: user.email,
      name: user.name,
      role: 'CLIENT',
      tenantId: null
    });

    if (isFormRequest) {
      return NextResponse.redirect(new URL(safeRedirectTo, req.url), { status: 303 });
    }

    return NextResponse.json({
      ok: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name
      }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      if (isFormRequest) {
        return redirectFormError(getApiErrorMessage(error), safeRedirectTo);
      }
      return NextResponse.json({ error: getApiErrorMessage(error) }, { status: 400 });
    }
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code: unknown }).code === 'P2002'
    ) {
      if (isFormRequest) {
        return redirectFormError('Un compte existe déjà avec cette adresse email.', safeRedirectTo);
      }
      return NextResponse.json({ error: 'Un compte existe déjà avec cette adresse email.' }, { status: 409 });
    }
    console.error('[register-client]', error);
    if (isFormRequest) {
      return redirectFormError(getApiErrorMessage(error), safeRedirectTo);
    }
    return NextResponse.json({ error: getApiErrorMessage(error) }, { status: 500 });
  }
}
