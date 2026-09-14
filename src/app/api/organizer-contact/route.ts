import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createAndNotifyAdminInboundRequest } from '@/lib/admin-inbound-requests.server';
import { getServerSupabaseClient } from '@/lib/supabase/server';

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
  message: z.string().trim().min(10).max(4000)
});

export async function POST(request: Request) {
  try {
    const input = organizerContactSchema.parse(await request.json());
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
      rawPayload: input
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

    console.error('[organizer-contact] erreur', error);
    return NextResponse.json(
      {
        error: 'Impossible de traiter la demande actuellement.'
      },
      { status: 500 }
    );
  }
}
