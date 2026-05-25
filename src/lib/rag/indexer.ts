import crypto from 'node:crypto';
import { createOpenAIClient } from '@/lib/openai';
import { chunkText } from '@/lib/rag/chunking';
import { getRagEnv } from '@/lib/rag/env';
import { collectAllRagDocuments, collectRagDocumentsForSourceRefs } from '@/lib/rag/extractors';
import { redactPIIText } from '@/lib/rag/pii';
import { getServerSupabaseClient } from '@/lib/supabase/server';
import type { RagDocumentInput } from '@/lib/rag/types';
import type { Json } from '@/types/supabase';

const EMBEDDING_BATCH_SIZE = 32;
const DELETE_BATCH_SIZE = 100;

type IndexResult = {
  processed: number;
  updated: number;
  skipped: number;
  failed: number;
};

type QueueResult = {
  pulled: number;
  processed: number;
  failed: number;
  deleted: number;
};

function toPgVector(values: number[]) {
  return `[${values.join(',')}]`;
}

function hashContent(value: string) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function toIsoNow() {
  return new Date().toISOString();
}

function withBackoff(minutesAttempt: number) {
  const now = Date.now();
  const delayMs = Math.min(60, Math.max(1, minutesAttempt)) * 60_000;
  return new Date(now + delayMs).toISOString();
}

function chunkArray<T>(items: T[], size: number) {
  const groups: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    groups.push(items.slice(index, index + size));
  }
  return groups;
}

async function upsertDocumentAndGetId(input: {
  sourceRef: string;
  sourceType: string;
  sourceId: string;
  sourceUrl?: string | null;
  title: string;
  metadata: Json;
  contentHash: string;
}) {
  const supabase = getServerSupabaseClient();
  const now = toIsoNow();
  const { data, error } = await supabase
    .from('rag_documents')
    .upsert(
      {
        source_ref: input.sourceRef,
        source_type: input.sourceType,
        source_id: input.sourceId,
        source_url: input.sourceUrl ?? null,
        title: input.title,
        metadata: input.metadata,
        content_hash: input.contentHash,
        pii_redacted: true,
        updated_at: now
      },
      { onConflict: 'source_ref' }
    )
    .select('id,content_hash')
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? 'Impossible de créer/mettre à jour rag_documents.');
  }

  return data;
}

async function clearDocumentChunks(documentId: string) {
  const supabase = getServerSupabaseClient();
  const { error } = await supabase.from('rag_chunks').delete().eq('document_id', documentId);
  if (error) {
    throw new Error(error.message);
  }
}

async function insertChunksAndEmbeddings(documentId: string, content: string) {
  const supabase = getServerSupabaseClient();
  const openai = createOpenAIClient();
  const { embedModel } = getRagEnv();
  const now = toIsoNow();

  const chunkCandidates = chunkText(content);
  const chunks = chunkCandidates.length > 0 ? chunkCandidates : chunkText('Aucun contenu exploitable.');

  const inserted: Array<{ id: string; content: string }> = [];
  for (const chunk of chunks) {
    const { data, error } = await supabase
      .from('rag_chunks')
      .insert({
        document_id: documentId,
        chunk_index: chunk.index,
        content: chunk.content,
        content_hash: hashContent(chunk.content),
        token_count: chunk.tokenCount,
        metadata: { chunk_index: chunk.index } as Json,
        updated_at: now
      })
      .select('id,content')
      .single();

    if (error || !data) {
      throw new Error(error?.message ?? 'Insertion rag_chunks impossible.');
    }
    inserted.push({ id: data.id, content: data.content });
  }

  const batches = chunkArray(inserted, EMBEDDING_BATCH_SIZE);
  for (const batch of batches) {
    const embeddingResponse = await openai.embeddings.create({
      model: embedModel,
      input: batch.map((item) => item.content)
    });

    const rows = batch.map((item, index) => {
      const embedding = embeddingResponse.data[index]?.embedding;
      if (!embedding?.length) {
        throw new Error('Embedding OpenAI manquant pour un chunk.');
      }
      return {
        chunk_id: item.id,
        model: embedModel,
        embedding: toPgVector(embedding),
        updated_at: now
      };
    });

    const { error } = await supabase.from('rag_embeddings').upsert(rows, { onConflict: 'chunk_id' });
    if (error) {
      throw new Error(error.message);
    }
  }
}

export async function indexRagDocuments(
  documents: RagDocumentInput[],
  options?: { force?: boolean }
): Promise<IndexResult> {
  const supabase = getServerSupabaseClient();
  const result: IndexResult = {
    processed: 0,
    updated: 0,
    skipped: 0,
    failed: 0
  };

  for (const document of documents) {
    result.processed += 1;
    const redactedContent = redactPIIText(document.content);
    const contentHash = hashContent(redactedContent);

    try {
      const { data: existing } = await supabase
        .from('rag_documents')
        .select('id,content_hash')
        .eq('source_ref', document.sourceRef)
        .maybeSingle();

      if (existing && !options?.force && existing.content_hash === contentHash) {
        result.skipped += 1;
        continue;
      }

      const docRow = await upsertDocumentAndGetId({
        sourceRef: document.sourceRef,
        sourceType: document.sourceType,
        sourceId: document.sourceId,
        sourceUrl: document.sourceUrl,
        title: document.title,
        metadata: (document.metadata ?? {}) as Json,
        contentHash
      });

      await clearDocumentChunks(docRow.id);
      await insertChunksAndEmbeddings(docRow.id, redactedContent);
      result.updated += 1;
    } catch (error) {
      result.failed += 1;
      console.error('[rag/indexer] document indexing failed', {
        sourceRef: document.sourceRef,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  return result;
}

export async function runFullRagReindex() {
  const supabase = getServerSupabaseClient();
  const documents = await collectAllRagDocuments();
  const indexResult = await indexRagDocuments(documents);

  const knownRefs = new Set(documents.map((doc) => doc.sourceRef));
  const { data: existingDocs } = await supabase.from('rag_documents').select('id,source_ref');
  const staleRefs = (existingDocs ?? [])
    .map((doc) => doc.source_ref)
    .filter((sourceRef) => !knownRefs.has(sourceRef));

  let deleted = 0;
  for (const refs of chunkArray(staleRefs, DELETE_BATCH_SIZE)) {
    const { error, count } = await supabase
      .from('rag_documents')
      .delete({ count: 'exact' })
      .in('source_ref', refs);
    if (error) {
      console.error('[rag/indexer] stale delete failed', error.message);
      continue;
    }
    deleted += count ?? 0;
  }

  return {
    ...indexResult,
    deleted
  };
}

export async function enqueueRagSourceRef(sourceRef: string, reason = 'manual') {
  const supabase = getServerSupabaseClient();
  const [sourceType, ...rest] = sourceRef.split(':');
  const sourceId = rest.join(':').trim();
  if (!sourceType || !sourceId) {
    throw new Error(`sourceRef invalide: "${sourceRef}"`);
  }

  const now = toIsoNow();
  const { error } = await supabase.from('rag_index_queue').upsert(
    {
      source_ref: sourceRef,
      source_type: sourceType,
      source_id: sourceId,
      reason,
      status: 'PENDING',
      next_attempt_at: now,
      last_error: null,
      locked_at: null,
      processed_at: null,
      updated_at: now
    },
    { onConflict: 'source_ref' }
  );

  if (error) {
    throw new Error(error.message);
  }
}

async function markQueueDone(id: string) {
  const supabase = getServerSupabaseClient();
  const now = toIsoNow();
  await supabase
    .from('rag_index_queue')
    .update({
      status: 'DONE',
      attempts: 0,
      processed_at: now,
      locked_at: null,
      updated_at: now,
      last_error: null
    })
    .eq('id', id);
}

async function markQueueError(id: string, attempts: number, message: string) {
  const supabase = getServerSupabaseClient();
  await supabase
    .from('rag_index_queue')
    .update({
      status: 'PENDING',
      attempts: attempts + 1,
      next_attempt_at: withBackoff(attempts + 1),
      last_error: message.slice(0, 1000),
      locked_at: null,
      updated_at: toIsoNow()
    })
    .eq('id', id);
}

export async function processRagIndexQueue(limit = 25): Promise<QueueResult> {
  const supabase = getServerSupabaseClient();
  const now = toIsoNow();
  const { data: queueRows, error } = await supabase
    .from('rag_index_queue')
    .select('*')
    .eq('status', 'PENDING')
    .lte('next_attempt_at', now)
    .order('priority', { ascending: true })
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error) {
    throw new Error(error.message);
  }

  const rows = queueRows ?? [];
  const result: QueueResult = {
    pulled: rows.length,
    processed: 0,
    failed: 0,
    deleted: 0
  };

  for (const row of rows) {
    const { error: lockError } = await supabase
      .from('rag_index_queue')
      .update({
        status: 'PROCESSING',
        locked_at: now,
        updated_at: now
      })
      .eq('id', row.id)
      .eq('status', 'PENDING');

    if (lockError) {
      result.failed += 1;
      continue;
    }

    try {
      const payload =
        row.payload && typeof row.payload === 'object' && !Array.isArray(row.payload)
          ? (row.payload as Record<string, unknown>)
          : {};
      const isDeleteEvent = payload.deleted === true;

      if (isDeleteEvent) {
        await supabase.from('rag_documents').delete().eq('source_ref', row.source_ref);
        result.deleted += 1;
      } else {
        const docs = await collectRagDocumentsForSourceRefs([row.source_ref]);
        if (!docs.length) {
          await supabase.from('rag_documents').delete().eq('source_ref', row.source_ref);
          result.deleted += 1;
        } else {
          const indexed = await indexRagDocuments(docs, { force: true });
          result.processed += indexed.updated;
          if (indexed.failed > 0 && indexed.updated === 0) {
            throw new Error(`Indexation échouée pour ${row.source_ref}`);
          }
        }
      }

      await markQueueDone(row.id);
    } catch (processError) {
      result.failed += 1;
      await markQueueError(
        row.id,
        row.attempts,
        processError instanceof Error ? processError.message : String(processError)
      );
    }
  }

  return result;
}

export async function purgeOldChatbotData(retentionDays = 30) {
  const supabase = getServerSupabaseClient();
  const { data, error } = await supabase.rpc('purge_old_chatbot_data', {
    retention_days: retentionDays
  });

  if (error) {
    throw new Error(error.message);
  }
  return Number(data ?? 0);
}
