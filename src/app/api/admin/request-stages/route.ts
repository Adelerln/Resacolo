import { NextResponse } from 'next/server';
import { z } from 'zod';
import { RequestPipelineService } from '@/lib/domain/services/requestPipelineService';

export const runtime = 'nodejs';

const stageSchema = z.object({
  key: z.string(),
  label: z.string(),
  order: z.number().int(),
  scope: z.enum(['GLOBAL', 'PARTNER', 'ORGANIZER']).optional(),
  tenantId: z.string().nullable().optional(),
  isTerminal: z.boolean().optional()
});

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const scope = (searchParams.get('scope') as 'GLOBAL' | 'PARTNER' | 'ORGANIZER') ?? 'GLOBAL';
  const tenantId = searchParams.get('tenantId');
  const service = new RequestPipelineService();
  const stages = await service.listStages(scope, tenantId);
  return NextResponse.json(stages);
}

export async function POST(req: Request) {
  const body = await req.json();
  const input = stageSchema.parse(body);
  const service = new RequestPipelineService();
  const stage = await service.createStage({
    key: input.key,
    label: input.label,
    order: input.order,
    scope: input.scope ?? 'GLOBAL',
    tenantId: input.tenantId ?? null,
    isTerminal: input.isTerminal ?? false
  });
  return NextResponse.json(stage, { status: 201 });
}
