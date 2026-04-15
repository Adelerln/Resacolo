import type { Json } from '@/types/supabase';

export type RagSourceType =
  | 'organizer'
  | 'stay'
  | 'collectivity'
  | 'inquiry'
  | 'support_request'
  | 'partner_tenant'
  | 'partner_config'
  | 'assortment'
  | 'request'
  | 'unknown';

export type RagDocumentInput = {
  sourceRef: string;
  sourceType: RagSourceType;
  sourceId: string;
  sourceUrl?: string | null;
  title: string;
  metadata: Json;
  content: string;
};

export type RagCitation = {
  title: string;
  url: string;
  excerpt: string;
  sourceType: string;
  sourceRef: string;
};

export type RetrievedChunk = {
  chunkId: string;
  documentId: string;
  sourceRef: string;
  sourceType: string;
  sourceUrl: string | null;
  title: string;
  content: string;
  metadata: Json;
  score: number;
};
