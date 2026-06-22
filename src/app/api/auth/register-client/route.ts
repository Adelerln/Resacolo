import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isPasswordPolicyValid, PASSWORD_POLICY_MESSAGE } from '@/lib/auth/password-policy';
import { upsertFamilyProfileFromRegistration } from '@/lib/account-profile/server';
import { getApiErrorMessage } from '@/lib/checkout/api';
import { getServerSupabaseClient } from '@/lib/supabase/server';
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

function isDevEmailConfirmationFailure(error: { message?: string | null } | null | undefined) {
  if (process.env.NODE_ENV === 'production') return false;
  const message = String(error?.message ?? '').toLowerCase();
  return message.includes('error sending confirmation email');
}

async function createConfirmedDevUserAndSession(input: {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  name: string;
  supabase: ReturnType<typeof createRouteHandlerClient<Database>>;
}) {
  const adminSupabase = getServerSupabaseClient();
  const { data: created, error: createError } = await adminSupabase.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
    user_metadata: {
      first_name: input.firstName,
      last_name: input.lastName,
      full_name: input.name,
      name: input.name
    }
  });

  if (createError || !created.user?.id) {
    throw createError ?? new Error('Impossible de créer le compte en local.');
  }

  const { data: signedIn, error: signInError } = await input.supabase.auth.signInWithPassword({
    email: input.email,
    password: input.password
  });

  if (signInError) {
    throw signInError;
  }

  return {
    user: created.user,
    session: signedIn.session
  };
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

    const fullInput = isFormRequest ? registerClientFullSchema.parse(body) : null;
    const checkoutInput = isFormRequest ? null : registerClientCheckoutSchema.parse(body);
    const input = fullInput ?? checkoutInput!;
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

    const authResult =
      isDevEmailConfirmationFailure(error)
        ? await createConfirmedDevUserAndSession({
            email,
            password: input.password,
            firstName: input.firstName,
            lastName: input.lastName,
            name,
            supabase
          })
        : data;

    if ((error && !isDevEmailConfirmationFailure(error)) || !authResult?.user?.id) {
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
      const parent2Name = fullInput
        ? joinNameParts(fullInput.parent2FirstName, fullInput.parent2LastName)
        : '';

      await upsertFamilyProfileFromRegistration({
        userId: authResult.user.id,
        firstName: input.firstName,
        lastName: input.lastName,
        email,
        phone: fullInput?.phone ?? '',
        addressLine1: fullInput?.addressLine1 ?? '',
        addressLine2: fullInput?.addressLine2 ?? '',
        postalCode: fullInput?.postalCode ?? '',
        city: fullInput?.city ?? '',
        parent2Name,
        parent2Status:
          fullInput && fullInput.parent2Status !== '' ? fullInput.parent2Status : undefined,
        parent2StatusOther: fullInput?.parent2StatusOther ?? '',
        parent2Phone: fullInput?.parent2Phone ?? '',
        parent2Email: fullInput?.parent2Email ?? ''
      });
    } catch (profileError) {
      if (isFormRequest) {
        return redirectFormError(getApiErrorMessage(profileError), safeRedirectTo);
      }
      return NextResponse.json({ error: getApiErrorMessage(profileError) }, { status: 500 });
    }

    if (isFormRequest) {
      const redirectUrl = authResult.session
        ? new URL(safeRedirectTo, req.url)
        : new URL(`/login/familles?registered=1&redirectTo=${encodeURIComponent(safeRedirectTo)}`, req.url);
      return NextResponse.redirect(redirectUrl, { status: 303 });
    }

    return NextResponse.json({
      ok: true,
      user: {
        id: authResult.user.id,
        email: authResult.user.email,
        name
      },
      requiresEmailConfirmation: !authResult.session
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
