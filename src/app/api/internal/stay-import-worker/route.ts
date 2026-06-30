import { NextResponse } from 'next/server';
import {
  isAuthorizedStayImportWorkerRequest,
  processOneQueuedStayImportJob
} from '@/lib/stay-import-jobs';

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function POST(req: Request) {
  if (!isAuthorizedStayImportWorkerRequest(req.headers)) {
    return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 });
  }

  try {
    const result = await processOneQueuedStayImportJob();
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('[stay-import-worker] unexpected error', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Erreur du worker.'
      },
      { status: 500 }
    );
  }
}
