import { getRagEnv } from '@/lib/rag/env';

export function isRagTokenAuthorized(request: Request) {
  const expected = getRagEnv().reindexToken;
  if (!expected) return false;

  const auth = request.headers.get('authorization');
  const bearer = auth?.startsWith('Bearer ') ? auth.slice(7).trim() : null;
  const headerToken = request.headers.get('x-rag-token')?.trim() ?? null;
  const urlToken = new URL(request.url).searchParams.get('token')?.trim() ?? null;

  return bearer === expected || headerToken === expected || urlToken === expected;
}
