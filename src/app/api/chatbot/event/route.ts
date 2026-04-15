import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getOrCreateChatSession, logChatEvent } from '@/lib/rag/chatbot';
import { isRagInfraMissingError } from '@/lib/rag/errors';
import { isPublicChatbotEnabled } from '@/lib/rag/env';

export const runtime = 'nodejs';

const schema = z.object({
  sessionId: z.string().uuid().optional(),
  eventType: z.enum([
    'chat_opened',
    'message_sent',
    'answer_rendered',
    'citation_clicked',
    'handoff_triggered'
  ]),
  payload: z.record(z.string(), z.unknown()).optional()
});

export async function POST(request: Request) {
  if (!isPublicChatbotEnabled()) {
    return NextResponse.json({ ok: false }, { status: 404 });
  }

  try {
    const body = schema.parse(await request.json());
    let sessionId: string | null = body.sessionId ?? null;
    if (!sessionId) {
      try {
        sessionId = await getOrCreateChatSession(request, undefined);
      } catch (sessionError) {
        if (!isRagInfraMissingError(sessionError)) {
          throw sessionError;
        }
        return NextResponse.json({ ok: true, sessionId: null, noop: true });
      }
    }

    await logChatEvent({
      sessionId,
      eventType: body.eventType,
      payload: body.payload
    }).catch((error) => {
      if (!isRagInfraMissingError(error)) {
        throw error;
      }
    });

    return NextResponse.json({ ok: true, sessionId });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Payload invalide.', issues: error.issues }, { status: 400 });
    }
    console.error('[api/chatbot/event] failure', error);
    return NextResponse.json({ error: 'Impossible d’enregistrer cet événement.' }, { status: 500 });
  }
}
