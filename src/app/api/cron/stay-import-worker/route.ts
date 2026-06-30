import { NextResponse } from 'next/server';
import { processOneQueuedStayImportJob } from '@/lib/stay-import-jobs';

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function GET() {
  try {
    const result = await processOneQueuedStayImportJob();
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('[stay-import-worker-cron] unexpected error', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Erreur cron worker.'
      },
      { status: 500 }
    );
  }
}
