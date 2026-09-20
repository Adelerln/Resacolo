import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createAndNotifyAdminInboundRequest } from '@/lib/admin-inbound-requests.server';
import { getServerSupabaseClient } from '@/lib/supabase/server';
import { formatTurnstileUserError, getClientIp, verifyTurnstileToken } from '@/lib/turnstile.server';

export const runtime = 'nodejs';

const partnerContactSchema = z.object({
  institution: z
    .string()
    .trim()
    .min(2, 'Indiquez le nom de l’institution (2 caractères minimum).')
    .max(180),
  name: z.string().trim().min(2, 'Indiquez votre nom (2 caractères minimum).').max(120),
  email: z.string().trim().email('Indiquez une adresse e-mail valide.').max(180),
  phone: z
    .string()
    .trim()
    .max(50)
    .optional()
    .default('')
    .refine((value) => !value || value.replace(/\s/g, '').length >= 8, {
      message: 'Indiquez un numéro de téléphone valide, ou laissez le champ vide.'
    }),
  formula: z.enum(['Formule Sérénité', 'Formule Identité'], {
    errorMap: () => ({ message: 'Choisissez une formule CSE.' })
  }),
  message: z
    .string()
    .trim()
    .min(10, 'Le message doit contenir au moins 10 caractères.')
    .max(4000),
  turnstileToken: z.string().trim().min(1, 'Merci de valider le captcha avant l’envoi.')
});

export async function POST(request: Request) {
  try {
    const input = partnerContactSchema.parse(await request.json());

    const verification = await verifyTurnstileToken(input.turnstileToken, getClientIp(request), request);
    if (!verification.success) {
      const unavailable = verification.errorCodes.some(
        (code) => code === 'missing_secret' || code === 'verification_unavailable'
      );
      return NextResponse.json(
        {
          error: formatTurnstileUserError(verification.errorCodes),
          errorCodes: verification.errorCodes
        },
        { status: unavailable ? 503 : 400 }
      );
    }

    const supabase = getServerSupabaseClient();
    const nameParts = input.name.trim().split(/\s+/);
    const firstName = nameParts[0] ?? input.name;
    const lastName = nameParts.slice(1).join(' ').trim() || null;

    const requestId = await createAndNotifyAdminInboundRequest(supabase, {
      kind: 'PARTNER',
      organizationName: input.institution,
      contactFirstName: firstName,
      contactLastName: lastName,
      contactEmail: input.email,
      contactPhone: input.phone || null,
      formula: input.formula,
      message: input.message,
      rawPayload: {
        institution: input.institution,
        name: input.name,
        email: input.email,
        phone: input.phone,
        formula: input.formula,
        message: input.message
      }
    });

    return NextResponse.json({ ok: true, requestId });
  } catch (error) {
    if (error instanceof z.ZodError) {
      const firstIssue = error.issues[0]?.message;
      return NextResponse.json(
        {
          error: firstIssue && firstIssue !== 'Required' ? firstIssue : 'Formulaire invalide.',
          issues: error.issues
        },
        { status: 400 }
      );
    }

    const message = error instanceof Error ? error.message : String(error);
    console.error('[partner-contact] erreur', error);

    if (message.includes('enregistrée') && message.includes("e-mail d'alerte")) {
      const requestIdMatch = message.match(/\(([0-9a-f-]{36})\)/i);
      return NextResponse.json(
        {
          error: message,
          requestId: requestIdMatch?.[1] ?? null
        },
        { status: 502 }
      );
    }

    return NextResponse.json(
      {
        error: 'Impossible de traiter la demande actuellement.'
      },
      { status: 500 }
    );
  }
}
