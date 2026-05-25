import crypto from 'node:crypto';
import { createOpenAIClient } from '@/lib/openai';
import { getRagEnv } from '@/lib/rag/env';
import { redactPIIText } from '@/lib/rag/pii';
import type { RagCitation, RetrievedChunk } from '@/lib/rag/types';
import { getServerSupabaseClient } from '@/lib/supabase/server';
import type { Json } from '@/types/supabase';

const NO_ANSWER_TEXT =
  "Je n'ai pas assez d'éléments fiables sur les séjours pour répondre précisément. Je peux transmettre votre demande à l'équipe Resacolo.";

function sanitizeExcerpt(value: string) {
  const oneLine = value.replace(/\s+/g, ' ').trim();
  const clipped = oneLine.length > 220 ? `${oneLine.slice(0, 217)}...` : oneLine;
  return redactPIIText(clipped);
}

function normalizeForMatch(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function sanitizeAssistantAnswer(value: string) {
  return redactPIIText(value).replace(/\*/g, '').replace(/[ \t]+\n/g, '\n').trim();
}

function selectCitationsMentionedInAnswer(answer: string, citations: RagCitation[]) {
  const normalizedAnswer = normalizeForMatch(answer);
  if (!normalizedAnswer) return [];

  const selected = citations.filter((citation) => {
    const normalizedTitle = normalizeForMatch(citation.title);
    if (!normalizedTitle) return false;
    return normalizedAnswer.includes(normalizedTitle);
  });

  if (selected.length > 0) return selected;
  return [];
}

function makePublicSourceUrl(chunk: Pick<RetrievedChunk, 'sourceUrl' | 'documentId'>) {
  if (chunk.sourceUrl && chunk.sourceUrl.trim()) return chunk.sourceUrl;
  return `/assistant/sources/${chunk.documentId}`;
}

function buildCitations(chunks: RetrievedChunk[]): RagCitation[] {
  const output: RagCitation[] = [];
  const seen = new Set<string>();

  for (const chunk of chunks) {
    const key = `${chunk.documentId}:${chunk.sourceRef}`;
    if (seen.has(key)) continue;
    seen.add(key);
    output.push({
      title: chunk.title,
      url: makePublicSourceUrl(chunk),
      excerpt: sanitizeExcerpt(chunk.content),
      sourceType: chunk.sourceType,
      sourceRef: chunk.sourceRef
    });
    if (output.length >= 4) break;
  }

  return output;
}

function computeConfidence(chunks: RetrievedChunk[]) {
  if (!chunks.length) return 0;
  const best = chunks[0].score;
  const average =
    chunks.reduce((total, chunk) => total + chunk.score, 0) / Math.max(1, Math.min(chunks.length, 5));
  return Math.max(0, Math.min(1, best * 0.7 + average * 0.3));
}

function resolveClientIp(request: Request) {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]?.trim() ?? null;
  return request.headers.get('cf-connecting-ip');
}

function hashIp(ip: string | null) {
  if (!ip) return null;
  const salt = process.env.AUTH_SECRET ?? 'resacolo-chatbot';
  return crypto.createHmac('sha256', salt).update(ip).digest('hex');
}

export async function getOrCreateChatSession(request: Request, incomingSessionId?: string | null) {
  const supabase = getServerSupabaseClient();
  const trimmedSessionId = incomingSessionId?.trim() || null;
  if (trimmedSessionId) {
    const { data: existing } = await supabase
      .from('chat_sessions')
      .select('id')
      .eq('id', trimmedSessionId)
      .maybeSingle();
    if (existing?.id) {
      await supabase
        .from('chat_sessions')
        .update({ last_activity_at: new Date().toISOString() })
        .eq('id', existing.id);
      return existing.id;
    }
  }

  const { data, error } = await supabase
    .from('chat_sessions')
    .insert({
      user_agent: request.headers.get('user-agent'),
      locale: request.headers.get('accept-language')?.split(',')[0] ?? 'fr-FR',
      ip_hash: hashIp(resolveClientIp(request)),
      metadata: {}
    })
    .select('id')
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? 'Impossible de créer la session chatbot.');
  }
  return data.id;
}

export async function logChatMessage(input: {
  sessionId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  confidence?: number | null;
  citations?: RagCitation[];
  handoffSuggested?: boolean;
  metadata?: Record<string, unknown>;
}) {
  const supabase = getServerSupabaseClient();
  const { error } = await supabase.from('chat_messages').insert({
    session_id: input.sessionId,
    role: input.role,
    content: redactPIIText(input.content),
    confidence: input.confidence ?? null,
    citations: (input.citations ?? []) as unknown as Json,
    handoff_suggested: input.handoffSuggested ?? false,
    metadata: (input.metadata ?? {}) as Json
  });
  if (error) {
    throw new Error(error.message);
  }

  await supabase
    .from('chat_sessions')
    .update({ last_activity_at: new Date().toISOString() })
    .eq('id', input.sessionId);
}

export async function logChatEvent(input: {
  sessionId?: string | null;
  eventType: string;
  payload?: Record<string, unknown>;
}) {
  const supabase = getServerSupabaseClient();
  const { error } = await supabase.from('chat_events').insert({
    session_id: input.sessionId ?? null,
    event_type: input.eventType,
    payload: (input.payload ?? {}) as Json
  });
  if (error) {
    throw new Error(error.message);
  }
}

async function generateModelAnswer(question: string, chunks: RetrievedChunk[]) {
  const openai = createOpenAIClient();
  const { chatModel } = getRagEnv();
  const context = chunks
    .slice(0, 8)
    .map((chunk, index) => {
      return [
        `Source ${index + 1}:`,
        `Titre: ${chunk.title}`,
        `Type: ${chunk.sourceType}`,
        `Référence: ${chunk.sourceRef}`,
        `Extrait: ${chunk.content}`
      ].join('\n');
    })
    .join('\n\n');

  const completion = await openai.chat.completions.create({
    model: chatModel,
    temperature: 0.2,
    messages: [
      {
        role: 'system',
        content:
          "Tu es l'assistant Resacolo dédié uniquement aux séjours. Réponds en français, de façon concise, sans inventer, en t'appuyant uniquement sur le contexte fourni. Si la question sort du périmètre des séjours, dis-le explicitement. N'utilise jamais de Markdown: pas de puces, pas de texte en gras, pas d'astérisques."
      },
      {
        role: 'user',
        content: [
          `Question utilisateur: ${question}`,
          '',
          'Contexte fiable à utiliser:',
          context,
          '',
          "Contraintes: si le contexte n'est pas suffisant, dis-le explicitement."
        ].join('\n')
      }
    ]
  });

  const answer = completion.choices[0]?.message?.content?.trim();
  return answer ? sanitizeAssistantAnswer(answer) : NO_ANSWER_TEXT;
}

export async function answerQuestionWithRag(question: string, chunks: RetrievedChunk[]) {
  const citations = buildCitations(chunks);
  const confidence = computeConfidence(chunks);
  const handoffSuggested = confidence < 0.35 || chunks.length === 0;

  if (handoffSuggested) {
    return {
      answer: sanitizeAssistantAnswer(NO_ANSWER_TEXT),
      citations: [],
      confidence,
      handoffSuggested
    };
  }

  try {
    const answer = await generateModelAnswer(question, chunks);
    const citedLinks = selectCitationsMentionedInAnswer(answer, citations);
    return {
      answer,
      citations: citedLinks,
      confidence,
      handoffSuggested: false
    };
  } catch (error) {
    console.error('[rag/chatbot] model answer failed', error);
    return {
      answer: sanitizeAssistantAnswer(NO_ANSWER_TEXT),
      citations: [],
      confidence: Math.min(confidence, 0.25),
      handoffSuggested: true
    };
  }
}
