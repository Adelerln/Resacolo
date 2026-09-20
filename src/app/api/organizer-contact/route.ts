import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createAndNotifyAdminInboundRequest } from '@/lib/admin-inbound-requests.server';
import { getServerSupabaseClient } from '@/lib/supabase/server';
import { formatTurnstileUserError, getClientIp, verifyTurnstileToken } from '@/lib/turnstile.server';

export const runtime = 'nodejs';

const organizerContactSchema = z.object({
  organizationName: z.string().trim().min(2).max(180),
  atoutFrance: z.string().trim().min(2).max(40),
  sdjes: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[0-9]{3}ORG[0-9]{4}$/, 'Format SDJES invalide (ex. 123ORG4567).'),
  websiteUrl: z
    .string()
    .trim()
    .max(300)
    .optional()
    .default('')
    .refine((value) => !value || /^https?:\/\//i.test(value), {
      message: 'Le site web doit commencer par http:// ou https://.'
    }),
  lastName: z.string().trim().min(1).max(120),
  firstName: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(180),
  phone: z.string().trim().max(50).optional().default(''),
  message: z.string().trim().min(10).max(4000),
  turnstileToken: z.string().trim().min(1, 'Merci de valider le captcha avant l’envoi.')
});

export async function POST(request: Request) {
  try {
    const input = organizerContactSchema.parse(await request.json());

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

    const requestId = await createAndNotifyAdminInboundRequest(supabase, {
      kind: 'ORGANIZER',
      organizationName: input.organizationName,
      contactFirstName: input.firstName,
      contactLastName: input.lastName,
      contactEmail: input.email,
      contactPhone: input.phone || null,
      atoutFrance: input.atoutFrance,
      sdjes: input.sdjes,
      websiteUrl: input.websiteUrl || null,
      message: input.message,
      rawPayload: {
        organizationName: input.organizationName,
        atoutFrance: input.atoutFrance,
        sdjes: input.sdjes,
        websiteUrl: input.websiteUrl,
        lastName: input.lastName,
        firstName: input.firstName,
        email: input.email,
        phone: input.phone,
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
    console.error('[organizer-contact] erreur', error);

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
