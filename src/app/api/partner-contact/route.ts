import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createAndNotifyAdminInboundRequest } from '@/lib/admin-inbound-requests.server';
import { getServerSupabaseClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

const partnerContactSchema = z.object({
  institution: z.string().trim().min(2).max(180),
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(180),
  formula: z.enum(['Formule Sérénité', 'Formule Identité']),
  message: z.string().trim().min(10).max(4000)
});

export async function POST(request: Request) {
  try {
    const input = partnerContactSchema.parse(await request.json());
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
      formula: input.formula,
      message: input.message,
      rawPayload: input
    });

    return NextResponse.json({ ok: true, requestId });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: 'Formulaire invalide.',
          issues: error.issues
        },
        { status: 400 }
      );
    }

    console.error('[partner-contact] erreur', error);
    return NextResponse.json(
      {
        error: 'Impossible de traiter la demande actuellement.'
      },
      { status: 500 }
    );
  }
}
