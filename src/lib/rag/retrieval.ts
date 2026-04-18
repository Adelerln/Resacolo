import { createOpenAIClient } from '@/lib/openai';
import { getRagEnv } from '@/lib/rag/env';
import { getServerSupabaseClient } from '@/lib/supabase/server';
import type { RetrievedChunk } from '@/lib/rag/types';
import type { Json } from '@/types/supabase';

type VectorHit = {
  chunk_id: string;
  content: string;
  document_id: string;
  metadata: Record<string, unknown>;
  similarity: number;
  source_ref: string;
  source_type: string;
  source_url: string | null;
  title: string;
};

type TextHit = {
  chunk_id: string;
  content: string;
  document_id: string;
  metadata: Record<string, unknown>;
  rank: number;
  source_ref: string;
  source_type: string;
  source_url: string | null;
  title: string;
};

function toPgVector(values: number[]) {
  return `[${values.join(',')}]`;
}

function clampScore(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

async function embedQuery(question: string) {
  const openai = createOpenAIClient();
  const { embedModel } = getRagEnv();
  const response = await openai.embeddings.create({
    model: embedModel,
    input: question
  });
  const embedding = response.data[0]?.embedding;
  if (!embedding?.length) {
    throw new Error('Embedding indisponible pour la question.');
  }
  return embedding;
}

export async function retrieveRagChunks(question: string, options?: { limit?: number }) {
  const supabase = getServerSupabaseClient();
  const limit = Math.max(1, Math.min(20, options?.limit ?? 8));
  const embedding = await embedQuery(question);

  const [{ data: vectorRows, error: vectorError }, { data: textRows, error: textError }] =
    await Promise.all([
      supabase.rpc('match_rag_chunks', {
        query_embedding: toPgVector(embedding),
        match_count: limit * 2
      }),
      supabase.rpc('search_rag_chunks', {
        query_text: question,
        match_count: limit * 2
      })
    ]);

  if (vectorError) {
    throw new Error(vectorError.message);
  }
  if (textError) {
    throw new Error(textError.message);
  }

  const byChunk = new Map<string, RetrievedChunk>();

  for (const row of (vectorRows ?? []) as VectorHit[]) {
    const score = clampScore(row.similarity);
    byChunk.set(row.chunk_id, {
      chunkId: row.chunk_id,
      documentId: row.document_id,
      sourceRef: row.source_ref,
      sourceType: row.source_type,
      sourceUrl: row.source_url,
      title: row.title,
      content: row.content,
      metadata: (row.metadata ?? {}) as Json,
      score
    });
  }

  for (const row of (textRows ?? []) as TextHit[]) {
    const current = byChunk.get(row.chunk_id);
    const textBoost = clampScore(row.rank / 2.5) * 0.35;
    if (current) {
      current.score = clampScore(current.score + textBoost);
      continue;
    }

    byChunk.set(row.chunk_id, {
      chunkId: row.chunk_id,
      documentId: row.document_id,
      sourceRef: row.source_ref,
      sourceType: row.source_type,
      sourceUrl: row.source_url,
      title: row.title,
      content: row.content,
      metadata: (row.metadata ?? {}) as Json,
      score: textBoost
    });
  }

  return Array.from(byChunk.values())
    .sort((left, right) => right.score - left.score)
    .slice(0, limit);
}
