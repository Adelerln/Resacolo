import { prisma } from '@/lib/db';
import type { RequestStageScope } from '@prisma/client';

export type RequestStageInput = {
  key: string;
  label: string;
  order: number;
  scope?: RequestStageScope;
  tenantId?: string | null;
  isTerminal?: boolean;
};

export class RequestPipelineService {
  async listStages(scope: RequestStageScope = 'GLOBAL', tenantId?: string | null) {
    const stages = await prisma.requestStage.findMany({
      where: { scope, tenantId: tenantId ?? null },
      orderBy: { order: 'asc' }
    });

    if (stages.length === 0 && scope !== 'GLOBAL') {
      return prisma.requestStage.findMany({
        where: { scope: 'GLOBAL' },
        orderBy: { order: 'asc' }
      });
    }
    return stages;
  }

  async createStage(input: RequestStageInput) {
    return prisma.requestStage.create({
      data: {
        key: input.key,
        label: input.label,
        order: input.order,
        scope: input.scope ?? 'GLOBAL',
        tenantId: input.tenantId ?? null,
        isTerminal: input.isTerminal ?? false
      }
    });
  }

  async updateStage(id: string, input: Partial<RequestStageInput>) {
    return prisma.requestStage.update({
      where: { id },
      data: {
        key: input.key,
        label: input.label,
        order: input.order,
        scope: input.scope,
        tenantId: input.tenantId ?? undefined,
        isTerminal: input.isTerminal
      }
    });
  }

  async setStage(requestId: string, newStageId: string, actorUserId?: string, payload?: unknown) {
    return prisma.$transaction(async (tx) => {
      const request = await tx.request.findUnique({ where: { id: requestId } });
      if (!request) return null;

      const updated = await tx.request.update({
        where: { id: requestId },
        data: { currentStageId: newStageId }
      });

      await tx.requestEvent.create({
        data: {
          requestId,
          seasonId: request.seasonId,
          eventType: 'STAGE_CHANGED',
          oldStageId: request.currentStageId,
          newStageId,
          actorUserId: actorUserId ?? null,
          payloadJson: payload ?? null
        }
      });

      return updated;
    });
  }
}
