import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { after, NextResponse } from 'next/server';
import { z } from 'zod';
import { isPasswordPolicyValid, PASSWORD_POLICY_MESSAGE } from '@/lib/auth/password-policy';
import { upsertFamilyProfileFromRegistration } from '@/lib/account-profile/server';
import { getApiErrorMessage } from '@/lib/checkout/api';
import { buildEmailConfirmRedirectUrl } from '@/lib/auth/urls';
import { getServerSupabaseClient } from '@/lib/supabase/server';
import type { Database } from '@/types/supabase';
import type { User } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const maxDuration = 60;

const stringFromUnknown = z.preprocess((value) => (value == null ? '' : value), z.string());
const trimmedString = () => stringFromUnknown.pipe(z.string().trim());
const trimmedStringMin = (min: number, message: string) =>
  stringFromUnknown.pipe(z.string().trim().min(min, message));
const trimmedEmail = (message: string) => stringFromUnknown.pipe(z.string().trim().email(message));

function joinNameParts(firstName: string, lastName: string) {
  return [firstName.trim(), lastName.trim()].filter(Boolean).join(' ').trim();
}

function humanizeAuthError(error: unknown) {
  const raw = typeof error === 'string' ? error.trim() : getApiErrorMessage(error);
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

/** Opt-in only. Never auto-confirm by NODE_ENV — even localhost must validate e-mail. */
function shouldAutoConfirmEmail() {
  return process.env.AUTH_AUTO_CONFIRM_EMAIL === '1';
}

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error(`${label} timeout after ${ms}ms`)), ms);
      })
    ]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

function buildSignupMetadata(input: { firstName: string; lastName: string; name: string }) {
  return {
    first_name: input.firstName,
    last_name: input.lastName,
    full_name: input.name,
    name: input.name
  };
}

async function createUserViaAdmin(input: {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  name: string;
  emailConfirm: boolean;
}): Promise<User> {
  const adminSupabase = getServerSupabaseClient();
  const { data, error } = await adminSupabase.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: input.emailConfirm,
    user_metadata: buildSignupMetadata(input)
  });

  if (error || !data.user?.id) {
    throw error ?? new Error('Impossible de créer le compte.');
  }

  return data.user;
}

async function findAuthUserByEmail(email: string): Promise<User | null> {
  const adminSupabase = getServerSupabaseClient();
  const normalized = email.toLowerCase();
  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await adminSupabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) {
      console.warn('[register-client] listUsers failed:', error.message);
      return null;
    }
    const match = data.users.find((user) => user.email?.toLowerCase() === normalized) ?? null;
    if (match) return match;
    if (data.users.length < 200) break;
  }
  return null;
}

function isExistingUserError(error: unknown) {
  const raw = humanizeAuthError(error).toLowerCase();
  return (
    raw.includes('already') ||
    raw.includes('registered') ||
    raw.includes('exists') ||
    raw.includes('duplicate')
  );
}

async function trySendSignupConfirmation(input: {
  email: string;
  emailRedirectTo: string;
  supabase: ReturnType<typeof createRouteHandlerClient<Database>>;
  timeoutMs?: number;
}) {
  const timeoutMs = input.timeoutMs ?? 45000;
  try {
    const { error } = await withTimeout(
      input.supabase.auth.resend({
        type: 'signup',
        email: input.email,
        options: { emailRedirectTo: input.emailRedirectTo }
      }),
      timeoutMs,
      'signup-resend'
    );
    if (error) {
      console.warn('[register-client] confirmation email not sent:', error.message);
      return error.message;
    }
    console.info('[register-client] confirmation email requested for', input.email);
    return null;
  } catch (error) {
    console.warn('[register-client] confirmation email timed out/failed:', humanizeAuthError(error));
    return humanizeAuthError(error);
  }
}

/**
 * Creates an unconfirmed user quickly. Email is sent in the background so the
 * HTTP response is not blocked by slow Supabase SMTP (often 15–40s).
 */
async function createUnconfirmedUser(input: {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  name: string;
}): Promise<User> {
  try {
    return await createUserViaAdmin({
      email: input.email,
      password: input.password,
      firstName: input.firstName,
      lastName: input.lastName,
      name: input.name,
      emailConfirm: false
    });
  } catch (createError) {
    if (isExistingUserError(createError)) {
      const existing = await findAuthUserByEmail(input.email);
      if (existing?.email_confirmed_at) {
        throw new Error('Un compte existe déjà avec cette adresse email.');
      }
      if (!existing) {
        throw new Error('Un compte existe déjà avec cette adresse email.');
      }
      return existing;
    }
    throw createError;
  }
}

function scheduleConfirmationEmail(input: {
  email: string;
  emailRedirectTo: string;
  supabase: ReturnType<typeof createRouteHandlerClient<Database>>;
}) {
  after(async () => {
    const warning = await trySendSignupConfirmation({
      ...input,
      timeoutMs: 45000
    });
    if (warning) {
      console.warn('[register-client] background confirmation email warning:', warning);
    }
  });
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

    if (!data.parent2Status) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['parent2Status'],
        message: 'Statut du parent 2 requis.'
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

  function redirectEmailVerification(email: string, redirectTo: string, warning?: string | null) {
    const url = new URL('/login/familles/verifier-email', req.url);
    url.searchParams.set('email', email);
    url.searchParams.set('redirectTo', redirectTo);
    if (warning) {
      url.searchParams.set('mailWarning', '1');
    }
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
    const autoConfirm = shouldAutoConfirmEmail();

    const cookieStore = await cookies();
    const cookieAccess = (() => cookieStore) as unknown as typeof cookies;
    const supabase = createRouteHandlerClient<Database>({
      cookies: cookieAccess
    });

    let user: User;
    try {
      if (autoConfirm) {
        // Opt-in only (AUTH_AUTO_CONFIRM_EMAIL=1): skip SMTP and confirm immediately.
        user = await createUserViaAdmin({
          email,
          password: input.password,
          firstName: input.firstName,
          lastName: input.lastName,
          name,
          emailConfirm: true
        });
      } else {
        user = await createUnconfirmedUser({
          email,
          password: input.password,
          firstName: input.firstName,
          lastName: input.lastName,
          name
        });
        // SMTP Supabase est souvent lent (15–40s) : ne pas bloquer la réponse HTTP.
        scheduleConfirmationEmail({
          email,
          emailRedirectTo,
          supabase
        });
      }
    } catch (createError) {
      const raw = humanizeAuthError(createError).toLowerCase();
      const isExisting =
        raw.includes('already') ||
        raw.includes('registered') ||
        raw.includes('exists') ||
        raw.includes('duplicate');
      const message = isExisting
        ? 'Un compte existe déjà avec cette adresse email.'
        : humanizeAuthError(createError);
      if (isFormRequest) return redirectFormError(message, safeRedirectTo);
      return NextResponse.json({ error: message }, { status: isExisting ? 409 : 500 });
    }

    try {
      const parent2Name = fullInput
        ? joinNameParts(fullInput.parent2FirstName, fullInput.parent2LastName)
        : '';

      await upsertFamilyProfileFromRegistration({
        userId: user.id,
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
      console.error('[register-client] profile upsert failed', humanizeAuthError(profileError));
    }

    if (autoConfirm) {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password: input.password
      });
      if (signInError) {
        console.warn('[register-client] auto-confirm sign-in failed', signInError.message);
        if (isFormRequest) {
          const url = new URL('/login/familles', req.url);
          url.searchParams.set('registered', '1');
          url.searchParams.set('redirectTo', safeRedirectTo);
          return NextResponse.redirect(url, { status: 303 });
        }
        return NextResponse.json({
          ok: true,
          user: { id: user.id, email, name },
          requiresEmailConfirmation: false
        });
      }

      if (isFormRequest) {
        const redirectResponse = NextResponse.redirect(new URL(safeRedirectTo, req.url), {
          status: 303
        });
        redirectResponse.headers.set('Cache-Control', 'no-store');
        for (const cookie of cookieStore.getAll()) {
          const cookieName = cookie.name;
          if (
            cookieName.includes('sb-') ||
            cookieName.includes('supabase') ||
            cookieName.startsWith('resacolo_')
          ) {
            redirectResponse.cookies.set(cookieName, cookie.value);
          }
        }
        return redirectResponse;
      }

      return NextResponse.json({
        ok: true,
        user: { id: user.id, email, name },
        requiresEmailConfirmation: false
      });
    }

    if (isFormRequest) {
      return redirectEmailVerification(email, safeRedirectTo);
    }

    return NextResponse.json({
      ok: true,
      user: { id: user.id, email, name },
      requiresEmailConfirmation: true
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
