import { NextResponse } from 'next/server';
import { z } from 'zod';
import { notifyContactFormRecipients } from '@/lib/contact-form-notifications.server';
import { buildContactInquiryInsert } from '@/lib/inquiries';
import { getServerSupabaseClient } from '@/lib/supabase/server';
import { formatTurnstileUserError, getClientIp, verifyTurnstileToken } from '@/lib/turnstile.server';

export const runtime = 'nodejs';

const contactSchema = z.object({
  recipient: z.string().trim().min(1).max(200),
  firstName: z.string().trim().min(1).max(120),
  lastName: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(180),
  phone: z.string().trim().max(50).optional().default(''),
  message: z.string().trim().min(10).max(4000),
  turnstileToken: z.string().trim().min(1)
});

export async function POST(request: Request) {
  try {
    const input = contactSchema.parse(await request.json());

    const verification = await verifyTurnstileToken(input.turnstileToken, getClientIp(request), request);
    if (!verification.success) {
      return NextResponse.json(
        {
          error: formatTurnstileUserError(verification.errorCodes),
          errorCodes: verification.errorCodes
        },
        { status: 400 }
      );
    }

    const supabase = getServerSupabaseClient();
    const { data, error } = await supabase
      .from('inquiries')
      .insert(
        buildContactInquiryInsert({
          recipient: input.recipient,
          firstName: input.firstName,
          lastName: input.lastName,
          email: input.email,
          phone: input.phone,
          message: input.message
        })
      )
      .select('id')
      .single();

    if (error || !data) {
      throw new Error(error?.message ?? 'Création inquiry impossible.');
    }

    // Best-effort : la demande reste visible dans Mnemos même si l'e-mail échoue.
    try {
      await notifyContactFormRecipients({
        supabase,
        inquiryId: data.id,
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email,
        phone: input.phone,
        recipient: input.recipient,
        message: input.message
      });
    } catch (notifyError) {
      console.error('[contact] notification email skipped', notifyError);
    }

    return NextResponse.json({ ok: true, inquiryId: data.id });
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

    console.error('[contact] erreur', error);
    return NextResponse.json(
      {
        error: 'Impossible de traiter la demande actuellement.'
      },
      { status: 500 }
    );
  }
}
