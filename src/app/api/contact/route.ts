import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerSupabaseClient } from '@/lib/supabase/server';
import { getClientIp, verifyTurnstileToken } from '@/lib/turnstile.server';

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

function buildInquiryType(recipient: string) {
  return recipient.startsWith('organizer:') ? 'ORGANIZER_CONTACT' : 'TECH_SUPPORT';
}

function buildSubject(recipient: string) {
  if (recipient.startsWith('organizer:')) {
    return 'Contact organisateur depuis formulaire public';
  }
  return 'Contact assistance technique';
}

function buildMessageBody(recipient: string, message: string) {
  return [`Destinataire: ${recipient}`, '', message].join('\n');
}

export async function POST(request: Request) {
  try {
    const input = contactSchema.parse(await request.json());

    const verification = await verifyTurnstileToken(input.turnstileToken, getClientIp(request));
    if (!verification.success) {
      return NextResponse.json(
        {
          error: 'Captcha invalide ou expiré. Merci de réessayer.',
          errorCodes: verification.errorCodes
        },
        { status: 400 }
      );
    }

    const supabase = getServerSupabaseClient();
    const { data, error } = await supabase
      .from('inquiries')
      .insert({
        inquiry_type: buildInquiryType(input.recipient),
        status: 'NEW',
        contact_email: input.email,
        contact_name: `${input.firstName} ${input.lastName}`.trim(),
        contact_phone: input.phone || null,
        subject: buildSubject(input.recipient),
        message: buildMessageBody(input.recipient, input.message)
      })
      .select('id')
      .single();

    if (error || !data) {
      throw new Error(error?.message ?? 'Création inquiry impossible.');
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
