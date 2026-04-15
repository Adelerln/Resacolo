import { NextResponse } from 'next/server';
import { z } from 'zod';
import { answerQuestionWithRag, getOrCreateChatSession, logChatEvent, logChatMessage } from '@/lib/rag/chatbot';
import { isRagInfraMissingError } from '@/lib/rag/errors';
import { retrieveFallbackChunks } from '@/lib/rag/fallback';
import { isPublicChatbotEnabled } from '@/lib/rag/env';
import { processRagIndexQueue } from '@/lib/rag/indexer';
import { retrieveRagChunks } from '@/lib/rag/retrieval';

export const runtime = 'nodejs';

const schema = z.object({
  question: z.string().trim().min(2).max(2000),
  sessionId: z.string().trim().uuid().optional()
});

function keepStayOnlyChunks<T extends { sourceType: string }>(chunks: T[]) {
  return chunks.filter((chunk) => chunk.sourceType === 'stay');
}

export async function POST(request: Request) {
  if (!isPublicChatbotEnabled()) {
    return NextResponse.json({ error: 'Chatbot indisponible.' }, { status: 404 });
  }

  try {
    const body = schema.parse(await request.json());
    let sessionId: string | null = body.sessionId ?? null;
    let ragInfraMissing = false;

    try {
      sessionId = await getOrCreateChatSession(request, body.sessionId);
    } catch (sessionError) {
      if (!isRagInfraMissingError(sessionError)) {
        throw sessionError;
      }
      ragInfraMissing = true;
      console.warn('[api/chatbot/query] session fallback: rag infra missing');
    }

    // Keep the index warm with pending near-real-time updates.
    processRagIndexQueue(5).catch((error) => {
      console.warn('[api/chatbot/query] queue processing failed', error);
    });

    if (sessionId) {
      await logChatMessage({
        sessionId,
        role: 'user',
        content: body.question
      }).catch((error) => {
        if (isRagInfraMissingError(error)) {
          ragInfraMissing = true;
          return;
        }
        throw error;
      });
      await logChatEvent({
        sessionId,
        eventType: 'message_sent',
        payload: { question_length: body.question.length }
      }).catch(() => {
        ragInfraMissing = true;
      });
    }

    let chunks;
    try {
      chunks = await retrieveRagChunks(body.question, { limit: 10 });
    } catch (retrievalError) {
      if (!isRagInfraMissingError(retrievalError)) {
        throw retrievalError;
      }
      ragInfraMissing = true;
      chunks = await retrieveFallbackChunks(body.question, 8);
    }

    let stayChunks = keepStayOnlyChunks(chunks);
    if (stayChunks.length === 0) {
      // Hard fallback to stay-only catalog retrieval when generic RAG returns no stay docs.
      stayChunks = await retrieveFallbackChunks(body.question, 8);
    }

    const response = await answerQuestionWithRag(body.question, stayChunks);
    const answer = response.answer;

    if (sessionId) {
      await logChatMessage({
        sessionId,
        role: 'assistant',
        content: answer,
        confidence: response.confidence,
        citations: response.citations,
        handoffSuggested: response.handoffSuggested
      }).catch(() => {
        ragInfraMissing = true;
      });
      await logChatEvent({
        sessionId,
        eventType: 'answer_rendered',
        payload: {
          confidence: response.confidence,
          citations_count: response.citations.length,
          handoff_suggested: response.handoffSuggested,
          rag_infra_missing: ragInfraMissing
        }
      }).catch(() => {
        ragInfraMissing = true;
      });
    }

    return NextResponse.json({
      answer,
      citations: response.citations.map((citation) => ({
        title: citation.title,
        url: citation.url,
        excerpt: citation.excerpt,
        sourceType: citation.sourceType
      })),
      confidence: response.confidence,
      handoffSuggested: response.handoffSuggested,
      sessionId,
      ragFallback: ragInfraMissing
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Payload invalide.', issues: error.issues }, { status: 400 });
    }

    console.error('[api/chatbot/query] failure', error);
    return NextResponse.json(
      {
        error:
          "Je n'ai pas pu traiter votre question pour le moment. Vous pouvez réessayer ou demander un transfert vers l'équipe."
      },
      { status: 500 }
    );
  }
}
