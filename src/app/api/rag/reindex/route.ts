import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isRagTokenAuthorized } from '@/lib/rag/auth';
import { processRagIndexQueue, purgeOldChatbotData, runFullRagReindex } from '@/lib/rag/indexer';

export const runtime = 'nodejs';

const schema = z.object({
  mode: z.enum(['full', 'queue']).default('queue'),
  limit: z.number().int().min(1).max(200).default(30),
  retentionDays: z.number().int().min(7).max(180).default(30)
});

export async function POST(request: Request) {
  if (!isRagTokenAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const rawBody = await request.json().catch(() => ({}));
    const body = schema.parse(rawBody);

    if (body.mode === 'full') {
      const [full, queue, deletedSessions] = await Promise.all([
        runFullRagReindex(),
        processRagIndexQueue(body.limit),
        purgeOldChatbotData(body.retentionDays).catch(() => 0)
      ]);
      return NextResponse.json({
        ok: true,
        mode: 'full',
        full,
        queue,
        purgedSessions: deletedSessions
      });
    }

    const queue = await processRagIndexQueue(body.limit);
    return NextResponse.json({
      ok: true,
      mode: 'queue',
      queue
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Payload invalide.', issues: error.issues }, { status: 400 });
    }
    console.error('[api/rag/reindex] failure', error);
    return NextResponse.json({ error: 'Reindex impossible.' }, { status: 500 });
  }
}
