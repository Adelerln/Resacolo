import { NextResponse } from 'next/server';
import { isRagTokenAuthorized } from '@/lib/rag/auth';
import { processRagIndexQueue, purgeOldChatbotData, runFullRagReindex } from '@/lib/rag/indexer';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  if (!isRagTokenAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const [full, queue, purgedSessions] = await Promise.all([
      runFullRagReindex(),
      processRagIndexQueue(50),
      purgeOldChatbotData(30).catch(() => 0)
    ]);

    return NextResponse.json({
      ok: true,
      full,
      queue,
      purgedSessions
    });
  } catch (error) {
    console.error('[api/cron/rag-full-reindex] failure', error);
    return NextResponse.json({ error: 'Cron reindex impossible.' }, { status: 500 });
  }
}
