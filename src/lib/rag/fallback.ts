import { getStays } from '@/lib/stays';
import type { RetrievedChunk } from '@/lib/rag/types';
import type { Json } from '@/types/supabase';

function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function scoreFromTerms(haystack: string, terms: string[]) {
  if (!terms.length) return 0;
  let hits = 0;
  for (const term of terms) {
    if (haystack.includes(term)) hits += 1;
  }
  return hits / terms.length;
}

export async function retrieveFallbackChunks(question: string, limit = 8): Promise<RetrievedChunk[]> {
  const stays = await getStays();
  const terms = normalize(question)
    .split(' ')
    .map((term) => term.trim())
    .filter((term) => term.length >= 2)
    .slice(0, 12);

  const scored = stays
    .map((stay) => {
      const haystack = normalize(
        [
          stay.title,
          stay.summary,
          stay.description,
          stay.organizer.name,
          stay.location,
          stay.region,
          stay.activitiesText ?? '',
          stay.programText ?? ''
        ].join(' ')
      );
      const termScore = scoreFromTerms(haystack, terms);
      const keywordBoost = haystack.includes('sejour') || haystack.includes('colonie') ? 0.05 : 0;
      const score = Math.max(0, Math.min(1, termScore + keywordBoost));
      return { stay, score };
    })
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, limit);

  return scored.map(({ stay, score }) => ({
    chunkId: `fallback:${stay.id}`,
    documentId: stay.id,
    sourceRef: `stay:${stay.id}`,
    sourceType: 'stay',
    sourceUrl: `/sejours/${stay.canonicalSlug}`,
    title: stay.title,
    content: [stay.summary, stay.description, stay.organizer.name, stay.location || stay.region]
      .filter(Boolean)
      .join('\n'),
    metadata: {
      source_table: 'stays_fallback',
      organizer: stay.organizer.name
    } as Json,
    score
  }));
}
