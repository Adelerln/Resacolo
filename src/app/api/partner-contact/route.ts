import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createAndNotifyAdminInboundRequest } from '@/lib/admin-inbound-requests.server';
import { getRagEnv } from '@/lib/rag/env';
import { sendSmtpEmail } from '@/lib/rag/smtp';
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
    const { data: settings, error: settingsError } = await supabase
      .from('partner_contact_settings')
      .select('partner_request_email')
      .eq('id', 'default')
      .maybeSingle();

    if (settingsError) {
      throw new Error(`Chargement du destinataire impossible : ${settingsError.message}`);
    }

    const recipient = settings?.partner_request_email?.trim();
    if (!recipient) {
      return NextResponse.json(
        { error: "L'envoi des demandes de partenariat n'est pas encore configuré." },
        { status: 503 }
      );
    }

    if (!getRagEnv().smtp) {
      return NextResponse.json(
        { error: "L'envoi des demandes de partenariat est momentanément indisponible." },
        { status: 503 }
      );
    }

    const inquiryMessage = [
      `Institution : ${input.institution}`,
      `Formule : ${input.formula}`,
      '',
      input.message
    ].join('\n');
    const { data: inquiry, error: inquiryError } = await supabase
      .from('inquiries')
      .insert({
        inquiry_type: 'GENERAL',
        status: 'NEW',
        source: 'CONTACT_FORM',
        email: input.email,
        first_name: input.name,
        last_name: null,
        subject: `Demande de partenariat — ${input.institution}`,
        message: inquiryMessage,
        organizer_id: null
      })
      .select('id')
      .single();

    if (inquiryError || !inquiry) {
      throw new Error(inquiryError?.message ?? 'Enregistrement de la demande impossible.');
    }

    try {
      await sendSmtpEmail({
        to: recipient,
        subject: `[Resacolo] Nouvelle demande de partenariat — ${input.institution}`,
        replyTo: input.email,
        text: [
          `Référence de la demande : ${inquiry.id}`,
          `Institution : ${input.institution}`,
          `Nom : ${input.name}`,
          `Email : ${input.email}`,
          `Formule : ${input.formula}`,
          '',
          'Message :',
          input.message
        ].join('\n')
      });
    } catch (emailError) {
      console.error('[partner-contact] envoi email échoué', { inquiryId: inquiry.id, error: emailError });
      return NextResponse.json(
        {
          error: `Votre demande a été enregistrée sous la référence ${inquiry.id}, mais l'envoi du mail a échoué. Contactez-nous en indiquant cette référence.`,
          inquiryId: inquiry.id
        },
        { status: 502 }
      );
    }

    return NextResponse.json({ ok: true, inquiryId: inquiry.id });
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
