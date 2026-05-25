import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getOrCreateChatSession, logChatEvent } from '@/lib/rag/chatbot';
import { isRagInfraMissingError } from '@/lib/rag/errors';
import { getRagEnv, isPublicChatbotEnabled } from '@/lib/rag/env';
import { redactPIIText } from '@/lib/rag/pii';
import { sendEscalationEmail } from '@/lib/rag/smtp';
import { getServerSupabaseClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

const schema = z.object({
  sessionId: z.string().uuid().optional(),
  question: z.string().trim().min(2).max(2000).optional(),
  conversationExcerpt: z.string().trim().max(12000).optional(),
  contactEmail: z.string().trim().email().max(200).optional(),
  contactName: z.string().trim().max(120).optional()
});

export async function POST(request: Request) {
  if (!isPublicChatbotEnabled()) {
    return NextResponse.json({ error: 'Chatbot indisponible.' }, { status: 404 });
  }

  try {
    const body = schema.parse(await request.json());
    let sessionId: string | null = body.sessionId ?? null;
    try {
      sessionId = await getOrCreateChatSession(request, body.sessionId);
    } catch (sessionError) {
      if (!isRagInfraMissingError(sessionError)) {
        throw sessionError;
      }
      sessionId = body.sessionId ?? null;
    }
    const supabase = getServerSupabaseClient();
    const contactEmail = body.contactEmail ?? 'chatbot-public@resacolo.local';
    const subject = body.question ? `Handoff chatbot - ${body.question.slice(0, 80)}` : 'Handoff chatbot';

    const message = redactPIIText(
      [
        `Session: ${sessionId}`,
        body.question ? `Question: ${body.question}` : null,
        body.conversationExcerpt ? `Extrait:\n${body.conversationExcerpt}` : null
      ]
        .filter(Boolean)
        .join('\n\n')
    );

    const { data: inquiry, error: inquiryError } = await supabase
      .from('inquiries')
      .insert({
        inquiry_type: 'CHATBOT_HANDOFF',
        status: 'NEW',
        contact_email: contactEmail,
        contact_name: body.contactName ?? null,
        subject,
        message
      })
      .select('id')
      .single();

    if (inquiryError || !inquiry) {
      throw new Error(inquiryError?.message ?? 'Création inquiry impossible.');
    }

    const env = getRagEnv();
    let emailSent = false;
    let emailError: string | null = null;
    if (env.escalationEmail) {
      try {
        await sendEscalationEmail({
          to: env.escalationEmail,
          subject: `[Resacolo Chatbot] ${subject}`,
          text: `${message}\n\nInquiry ID: ${inquiry.id}`
        });
        emailSent = true;
      } catch (error) {
        emailError = error instanceof Error ? error.message : String(error);
        console.error('[api/chatbot/handoff] smtp send failed', emailError);
      }
    }

    if (sessionId) {
      await logChatEvent({
        sessionId,
        eventType: 'handoff_triggered',
        payload: {
          inquiry_id: inquiry.id,
          email_sent: emailSent,
          email_error: emailError
        }
      }).catch(() => {
        // no-op: handoff already persisted in inquiries
      });
    }

    return NextResponse.json({
      ok: true,
      inquiryId: inquiry.id,
      emailSent,
      fallbackDbOnly: !emailSent
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Payload invalide.', issues: error.issues }, { status: 400 });
    }

    console.error('[api/chatbot/handoff] failure', error);
    return NextResponse.json(
      { error: 'Impossible de transférer la demande pour le moment.' },
      { status: 500 }
    );
  }
}
