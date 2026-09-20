import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  CONTACT_SUBJECT_VALUES,
  formatContactInquirySubject,
  getContactSubjectOption
} from '@/app/contact/contact-data';
import { notifyContactFormRecipients } from '@/lib/contact-form-notifications.server';
import { buildContactInquiryInsert } from '@/lib/inquiries';
import { getRagEnv } from '@/lib/rag/env';
import { sendSmtpEmail } from '@/lib/rag/smtp';
import { getServerSupabaseClient } from '@/lib/supabase/server';
import { formatTurnstileUserError, getClientIp, verifyTurnstileToken } from '@/lib/turnstile.server';

export const runtime = 'nodejs';

const CONTACT_EMAIL_RECIPIENTS = ['jeanne@thalie.org', 'adele.rolin@gmail.com'] as const;

const contactSchema = z
  .object({
    firstName: z.string().trim().min(1).max(120),
    lastName: z.string().trim().min(1).max(120),
    email: z.string().trim().email().max(180),
    phone: z.string().trim().max(50).optional().default(''),
    subject: z.enum(CONTACT_SUBJECT_VALUES),
    organizerName: z.string().trim().max(200).optional().default(''),
    message: z.string().trim().min(1).max(4000),
    turnstileToken: z.string().trim().min(1)
  })
  .superRefine((value, ctx) => {
    const option = getContactSubjectOption(value.subject);
    if (option?.requiresOrganizer && !value.organizerName.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['organizerName'],
        message: 'Indiquez le nom de l’organisateur concerné.'
      });
    }
  });

function formatContactValidationError(issues: z.ZodIssue[]): string {
  const field = issues[0]?.path[0];
  switch (field) {
    case 'firstName':
      return 'Vérifiez votre prénom.';
    case 'lastName':
      return 'Vérifiez votre nom.';
    case 'email':
      return 'Saisissez une adresse e-mail valide.';
    case 'phone':
      return 'Le numéro de téléphone est trop long.';
    case 'subject':
      return 'Choisissez l’objet de votre demande.';
    case 'organizerName':
      return issues[0]?.message || 'Indiquez le nom de l’organisateur concerné.';
    case 'message':
      return issues[0]?.code === 'too_big'
        ? 'Votre message ne peut pas dépasser 4 000 caractères.'
        : 'Veuillez saisir un message.';
    case 'turnstileToken':
      return 'Merci de valider le captcha avant l’envoi.';
    default:
      return 'Formulaire invalide. Vérifiez les champs renseignés.';
  }
}

export async function POST(request: Request) {
  try {
    const input = contactSchema.parse(await request.json());
    const inquirySubject = formatContactInquirySubject({
      subjectValue: input.subject,
      organizerName: input.organizerName
    });

    const verification = await verifyTurnstileToken(input.turnstileToken, getClientIp(request), request);
    if (!verification.success) {
      const unavailable = verification.errorCodes.some((code) =>
        code === 'missing_secret' || code === 'verification_unavailable'
      );
      return NextResponse.json(
        {
          error: formatTurnstileUserError(verification.errorCodes),
          errorCodes: verification.errorCodes
        },
        { status: unavailable ? 503 : 400 }
      );
    }

    if (!getRagEnv().smtp) {
      return NextResponse.json(
        { error: "L'envoi des messages est momentanément indisponible." },
        { status: 503 }
      );
    }

    const supabase = getServerSupabaseClient();
    const { data, error } = await supabase
      .from('inquiries')
      .insert(
        buildContactInquiryInsert({
          firstName: input.firstName,
          lastName: input.lastName,
          email: input.email,
          phone: input.phone,
          subject: inquirySubject,
          message: input.message
        })
      )
      .select('id')
      .single();

    if (error || !data) {
      throw new Error(error?.message ?? 'Création inquiry impossible.');
    }

    try {
      await Promise.all(
        CONTACT_EMAIL_RECIPIENTS.map((to) =>
          sendSmtpEmail({
            to,
            subject: `[Resacolo] Contact — ${inquirySubject}`,
            replyTo: input.email,
            text: [
              `Référence de la demande : ${data.id}`,
              `Nom : ${input.firstName} ${input.lastName}`,
              `Email : ${input.email}`,
              `Téléphone : ${input.phone || 'Non renseigné'}`,
              `Objet : ${inquirySubject}`,
              input.organizerName.trim() ? `Organisateur : ${input.organizerName.trim()}` : null,
              '',
              'Message :',
              input.message
            ]
              .filter((line) => line !== null)
              .join('\n')
          })
        )
      );
    } catch (emailError) {
      console.error('[contact] envoi email échoué', { inquiryId: data.id, error: emailError });
      return NextResponse.json(
        {
          error: `Votre demande a été enregistrée sous la référence ${data.id}, mais l'envoi du mail a échoué. Écrivez directement à jeanne@thalie.org ou adele.rolin@gmail.com en indiquant cette référence.`,
          inquiryId: data.id
        },
        { status: 502 }
      );
    }

    // Best-effort : notification configurée côté admin (ne bloque pas la réponse).
    try {
      await notifyContactFormRecipients({
        supabase,
        inquiryId: data.id,
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email,
        phone: input.phone,
        subject: inquirySubject,
        recipient: 'Formulaire de contact',
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
          error: formatContactValidationError(error.issues),
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
