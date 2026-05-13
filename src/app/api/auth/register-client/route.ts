import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isPasswordPolicyValid, PASSWORD_POLICY_MESSAGE } from '@/lib/auth/password-policy';
import { upsertFamilyProfileFromRegistration } from '@/lib/account-profile/server';
import { getApiErrorMessage } from '@/lib/checkout/api';
import type { Database } from '@/types/supabase';

export const runtime = 'nodejs';

const stringFromUnknown = z.preprocess((value) => (value == null ? '' : value), z.string());
const trimmedString = () => stringFromUnknown.pipe(z.string().trim());
const trimmedStringMin = (min: number, message: string) =>
  stringFromUnknown.pipe(z.string().trim().min(min, message));
const trimmedEmail = (message: string) => stringFromUnknown.pipe(z.string().trim().email(message));

function joinNameParts(firstName: string, lastName: string) {
  return [firstName.trim(), lastName.trim()].filter(Boolean).join(' ').trim();
}

const registerClientFullSchema = z
  .object({
    firstName: trimmedStringMin(2, 'Prénom requis.'),
    lastName: trimmedStringMin(2, 'Nom requis.'),
    email: trimmedEmail('Adresse email invalide.'),
    phone: trimmedStringMin(8, 'Numéro de téléphone invalide.'),
    addressLine1: trimmedStringMin(3, 'Adresse postale requise.'),
    addressLine2: trimmedString().optional().default(''),
    postalCode: trimmedStringMin(4, 'Code postal requis.'),
    city: trimmedStringMin(2, 'Ville requise.'),
    password: trimmedStringMin(8, PASSWORD_POLICY_MESSAGE).refine(
      (value) => isPasswordPolicyValid(value),
      PASSWORD_POLICY_MESSAGE
    ),
    parent2FirstName: trimmedString().optional().default(''),
    parent2LastName: trimmedString().optional().default(''),
    parent2Status: z.enum(['pere', 'mere', 'grand-parent', 'autre']).optional().or(z.literal('')).default(''),
    parent2StatusOther: trimmedString().optional().default(''),
    parent2Phone: trimmedString().optional().default(''),
    parent2Email: trimmedString()
      .optional()
      .default('')
      .refine((value) => !value || /.+@.+\..+/.test(value), 'Email parent 2 invalide.'),
    cguAccepted: z
      .union([z.literal('on'), z.literal('true'), z.literal(true)])
      .transform(() => true),
    redirectTo: trimmedString().optional()
  })
  .superRefine((data, ctx) => {
  const hasParent2 =
    Boolean(data.parent2FirstName) ||
    Boolean(data.parent2LastName) ||
    Boolean(data.parent2Phone) ||
    Boolean(data.parent2Email) ||
    Boolean(data.parent2Status) ||
    Boolean(data.parent2StatusOther);

  if (!hasParent2) {
    return;
  }

  if (!data.parent2LastName) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['parent2LastName'],
      message: 'Nom du parent 2 requis.'
    });
  }

  if (!data.parent2FirstName) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['parent2FirstName'],
      message: 'Prénom du parent 2 requis.'
    });
  }

  if (data.parent2Status === 'autre' && !data.parent2StatusOther) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['parent2StatusOther'],
      message: 'Précisez le statut du parent 2.'
    });
  }
  });

// Inscription "light" (checkout) : on ne demande que les identifiants.
// Les infos de contact peuvent être complétées ensuite (checkout / préférences).
const registerClientCheckoutSchema = z.object({
  firstName: trimmedStringMin(2, 'Prénom requis.'),
  lastName: trimmedStringMin(2, 'Nom requis.'),
  email: trimmedEmail('Adresse email invalide.'),
  password: trimmedStringMin(8, PASSWORD_POLICY_MESSAGE).refine(
    (value) => isPasswordPolicyValid(value),
    PASSWORD_POLICY_MESSAGE
  ),
  redirectTo: trimmedString().optional()
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
        : Object.fromEntries(
            Array.from((await req.formData()).entries()).map(([key, value]) => [key, String(value ?? '')])
          );
    } catch {
      if (isFormRequest) {
        return redirectFormError('Corps de requête invalide.', safeRedirectTo);
      }
      return NextResponse.json({ error: 'Corps de requête invalide.' }, { status: 400 });
    }

    const input = isFormRequest ? registerClientFullSchema.parse(body) : registerClientCheckoutSchema.parse(body);
    const fullParsed = isFormRequest
      ? ({ success: true, data: input } as const)
      : registerClientFullSchema.safeParse(body);
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

    try {
      const parent2Name =
        fullParsed.success
          ? joinNameParts(fullParsed.data.parent2FirstName, fullParsed.data.parent2LastName)
          : '';

      await upsertFamilyProfileFromRegistration({
        userId: data.user.id,
        firstName: input.firstName,
        lastName: input.lastName,
        email,
        phone: fullParsed.success ? fullParsed.data.phone : '',
        addressLine1: fullParsed.success ? fullParsed.data.addressLine1 : '',
        addressLine2: fullParsed.success ? fullParsed.data.addressLine2 : '',
        postalCode: fullParsed.success ? fullParsed.data.postalCode : '',
        city: fullParsed.success ? fullParsed.data.city : '',
        parent2Name,
        parent2Status:
          fullParsed.success && fullParsed.data.parent2Status !== '' ? fullParsed.data.parent2Status : undefined,
        parent2StatusOther: fullParsed.success ? fullParsed.data.parent2StatusOther : '',
        parent2Phone: fullParsed.success ? fullParsed.data.parent2Phone : '',
        parent2Email: fullParsed.success ? fullParsed.data.parent2Email : ''
      });
    } catch (profileError) {
      if (isFormRequest) {
        return redirectFormError(getApiErrorMessage(profileError), safeRedirectTo);
      }
      return NextResponse.json({ error: getApiErrorMessage(profileError) }, { status: 500 });
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
