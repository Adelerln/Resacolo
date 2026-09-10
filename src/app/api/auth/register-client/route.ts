import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isPasswordPolicyValid, PASSWORD_POLICY_MESSAGE } from '@/lib/auth/password-policy';
import { upsertFamilyProfileFromRegistration } from '@/lib/account-profile/server';
import { getApiErrorMessage } from '@/lib/checkout/api';
import { buildEmailConfirmRedirectUrl } from '@/lib/auth/urls';
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

function humanizeAuthError(error: unknown) {
  const raw =
    typeof error === 'string'
      ? error.trim()
      : getApiErrorMessage(error);

  const normalized = raw.replace(/\s+/g, ' ').trim();
  if (
    !normalized ||
    normalized === '{}' ||
    normalized === '[]' ||
    normalized === '[object Object]' ||
    normalized === 'undefined' ||
    normalized === 'null'
  ) {
    return 'Impossible de créer le compte pour le moment. Réessayez dans quelques instants.';
  }
  return normalized.slice(0, 300);
}

function isEmailDeliveryError(error: { message?: string | null } | null | undefined) {
  const message = String(error?.message ?? '').toLowerCase();
  return (
    message.includes('error sending') ||
    message.includes('confirmation email') ||
    message.includes('smtp') ||
    message.includes('rate limit') ||
    message.includes('error sending confirmation email')
  );
}

async function createUserViaAdmin(input: {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  name: string;
}) {
  const adminSupabase = getServerSupabaseClient();
  const { data, error } = await adminSupabase.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: false,
    user_metadata: {
      first_name: input.firstName,
      last_name: input.lastName,
      full_name: input.name,
      name: input.name
    }
  });

  if (error || !data.user?.id) {
    throw error ?? new Error('Impossible de créer le compte.');
  }

  return data.user;
}

async function sendSignupConfirmationEmail(input: {
  email: string;
  emailRedirectTo: string;
  supabase: ReturnType<typeof createRouteHandlerClient<Database>>;
}) {
  const { error } = await input.supabase.auth.resend({
    type: 'signup',
    email: input.email,
    options: { emailRedirectTo: input.emailRedirectTo }
  });
  return error;
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

  function redirectFormError(errorMessage: unknown, redirectTo: string) {
    const url = new URL('/login/familles/creer-compte', req.url);
    url.searchParams.set('error', humanizeAuthError(errorMessage));
    url.searchParams.set('redirectTo', redirectTo);
    return NextResponse.redirect(url, { status: 303 });
  }

  function redirectEmailVerification(email: string, redirectTo: string) {
    const url = new URL('/login/familles/verifier-email', req.url);
    url.searchParams.set('email', email);
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
    const emailRedirectTo = buildEmailConfirmRedirectUrl(req);

    const cookieStore = await cookies();
    const cookieAccess = (() => cookieStore) as unknown as typeof cookies;
    const supabase = createRouteHandlerClient<Database>({
      cookies: cookieAccess
    });

    let userId: string | null = null;
    let hasSession = false;
    let emailSendWarning: string | null = null;

    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email,
      password: input.password,
      options: {
        emailRedirectTo,
        data: {
          first_name: input.firstName,
          last_name: input.lastName,
          full_name: name,
          name
        }
      }
    });

    if (signUpError) {
      console.error('[register-client] signUp error', {
        message: signUpError.message,
        status: (signUpError as { status?: number }).status,
        code: (signUpError as { code?: string }).code,
        name: signUpError.name
      });
      if (isEmailDeliveryError(signUpError)) {
        console.warn('[register-client] signUp email delivery failed, fallback admin create', signUpError.message);
        try {
          const adminUser = await createUserViaAdmin({
            email,
            password: input.password,
            firstName: input.firstName,
            lastName: input.lastName,
            name
          });
          userId = adminUser.id;
          const resendError = await sendSignupConfirmationEmail({ email, emailRedirectTo, supabase });
          if (resendError) {
            console.warn('[register-client] resend after admin create failed', resendError.message);
            emailSendWarning = resendError.message;
          }
        } catch (fallbackError) {
          const message = humanizeAuthError(fallbackError);
          if (isFormRequest) return redirectFormError(message, safeRedirectTo);
          return NextResponse.json({ error: message }, { status: 500 });
        }
      } else {
        const isExistingAccount = String(signUpError.message ?? '')
          .toLowerCase()
          .includes('already registered');
        const message = isExistingAccount
          ? 'Un compte existe déjà avec cette adresse email.'
          : humanizeAuthError(signUpError);
        if (isFormRequest) return redirectFormError(message, safeRedirectTo);
        return NextResponse.json({ error: message }, { status: isExistingAccount ? 409 : 500 });
      }
    } else {
      // Compte déjà existant (réponse « soft » Supabase).
      if (signUpData.user && (signUpData.user.identities?.length ?? 0) === 0) {
        const message = 'Un compte existe déjà avec cette adresse email.';
        if (isFormRequest) return redirectFormError(message, safeRedirectTo);
        return NextResponse.json({ error: message }, { status: 409 });
      }

      userId = signUpData.user?.id ?? null;
      hasSession = Boolean(signUpData.session);
    }

    if (!userId) {
      const message = 'Impossible de créer le compte.';
      if (isFormRequest) return redirectFormError(message, safeRedirectTo);
      return NextResponse.json({ error: message }, { status: 500 });
    }

    try {
      const parent2Name = fullInput
        ? joinNameParts(fullInput.parent2FirstName, fullInput.parent2LastName)
        : '';

      await upsertFamilyProfileFromRegistration({
        userId,
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
      // Ne bloque pas la confirmation e-mail : le profil pourra être complété plus tard.
      console.error('[register-client] profile upsert failed', humanizeAuthError(profileError));
    }

    if (isFormRequest) {
      if (hasSession) {
        return NextResponse.redirect(new URL(safeRedirectTo, req.url), { status: 303 });
      }
      return redirectEmailVerification(email, safeRedirectTo);
    }

    return NextResponse.json({
      ok: true,
      user: { id: userId, email, name },
      requiresEmailConfirmation: !hasSession,
      emailSendWarning
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
      return redirectFormError(humanizeAuthError(error), safeRedirectTo);
    }
    return NextResponse.json({ error: humanizeAuthError(error) }, { status: 500 });
  }
}
