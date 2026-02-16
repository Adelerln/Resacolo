import { NextResponse } from 'next/server';
import { z } from 'zod';
import { RequestPipelineService } from '@/lib/domain/services/requestPipelineService';

export const runtime = 'nodejs';

const stageUpdateSchema = z.object({
  stageId: z.string()
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const body = await req.json();
  const input = stageUpdateSchema.parse(body);
  const service = new RequestPipelineService();
  const updated = await service.setStage(params.id, input.stageId);
  if (!updated) {
    return NextResponse.json({ error: 'Request not found' }, { status: 404 });
  }
  return NextResponse.json(updated);
}
