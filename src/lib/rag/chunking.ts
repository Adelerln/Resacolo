export type RagChunk = {
  index: number;
  content: string;
  tokenCount: number;
};

const DEFAULT_MAX_CHARS = 1200;
const DEFAULT_OVERLAP_CHARS = 180;

function normalizeWhitespace(value: string) {
  return value.replace(/\u00a0/g, ' ').replace(/\s+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

function estimateTokens(value: string) {
  return Math.max(1, Math.round(value.length / 4));
}

function tail(text: string, maxChars: number) {
  if (text.length <= maxChars) return text;
  return text.slice(text.length - maxChars);
}

export function chunkText(
  input: string,
  options?: {
    maxChars?: number;
    overlapChars?: number;
  }
): RagChunk[] {
  const maxChars = options?.maxChars ?? DEFAULT_MAX_CHARS;
  const overlapChars = options?.overlapChars ?? DEFAULT_OVERLAP_CHARS;
  const normalized = normalizeWhitespace(input);
  if (!normalized) return [];

  const paragraphs = normalized
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  let current = '';

  for (const paragraph of paragraphs) {
    if (current.length === 0) {
      current = paragraph;
      continue;
    }

    const candidate = `${current}\n\n${paragraph}`;
    if (candidate.length <= maxChars) {
      current = candidate;
      continue;
    }

    chunks.push(current);
    const carry = tail(current, overlapChars);
    current = `${carry}\n\n${paragraph}`.trim();
    if (current.length <= maxChars) continue;

    while (current.length > maxChars) {
      chunks.push(current.slice(0, maxChars));
      current = current.slice(maxChars - overlapChars).trim();
    }
  }

  if (current) {
    chunks.push(current);
  }

  return chunks.map((content, index) => ({
    index,
    content,
    tokenCount: estimateTokens(content)
  }));
}
