import { NextResponse } from 'next/server';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { RequestPipelineService } from '@/lib/domain/services/requestPipelineService';

export const runtime = 'nodejs';

const requestSchema = z.object({
  stayId: z.string(),
  sessionId: z.string(),
  seasonId: z.string(),
  partnerTenantId: z.string(),
  applicantJson: z.unknown().optional(),
  currentStageId: z.string().optional()
});

export async function POST(req: Request) {
  const body = await req.json();
  const input = requestSchema.parse(body);
  const pipeline = new RequestPipelineService();

  const stages = input.currentStageId
    ? []
    : await pipeline.listStages('GLOBAL');
  const currentStageId = input.currentStageId ?? stages[0]?.id;

  if (!currentStageId) {
    return NextResponse.json({ error: 'No request stage configured' }, { status: 400 });
  }

  const created = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const request = await tx.request.create({
      data: {
        stayId: input.stayId,
        sessionId: input.sessionId,
        seasonId: input.seasonId,
        partnerTenantId: input.partnerTenantId,
        currentStageId,
        applicantJson: input.applicantJson ?? null
      }
    });

    await tx.requestEvent.create({
      data: {
        requestId: request.id,
        seasonId: request.seasonId,
        eventType: 'CREATED',
        newStageId: currentStageId,
        payloadJson: input.applicantJson ?? null
      }
    });

    return request;
  });

  return NextResponse.json(created, { status: 201 });
}
