import { prisma } from '@/lib/db';

export type PerformanceDailyInput = {
  date: Date;
  seasonId: string;
  stayId?: string | null;
  sessionId?: string | null;
  partnerTenantId?: string | null;
  organizerTenantId?: string | null;
  requestsCount?: number;
  qualifiedCount?: number;
  transmittedCount?: number;
  finalizedCount?: number;
  lostCount?: number;
  capacityTotal?: number;
  capacityReserved?: number;
};

export class PerformanceService {
  async recordDailySnapshot(input: PerformanceDailyInput) {
    return prisma.performanceDaily.upsert({
      where: {
        date_seasonId_stayId_sessionId_partnerTenantId_organizerTenantId: {
          date: input.date,
          seasonId: input.seasonId,
          stayId: input.stayId ?? null,
          sessionId: input.sessionId ?? null,
          partnerTenantId: input.partnerTenantId ?? null,
          organizerTenantId: input.organizerTenantId ?? null
        }
      },
      create: {
        date: input.date,
        seasonId: input.seasonId,
        stayId: input.stayId ?? null,
        sessionId: input.sessionId ?? null,
        partnerTenantId: input.partnerTenantId ?? null,
        organizerTenantId: input.organizerTenantId ?? null,
        requestsCount: input.requestsCount ?? 0,
        qualifiedCount: input.qualifiedCount ?? 0,
        transmittedCount: input.transmittedCount ?? 0,
        finalizedCount: input.finalizedCount ?? 0,
        lostCount: input.lostCount ?? 0,
        capacityTotal: input.capacityTotal ?? 0,
        capacityReserved: input.capacityReserved ?? 0
      },
      update: {
        requestsCount: input.requestsCount ?? 0,
        qualifiedCount: input.qualifiedCount ?? 0,
        transmittedCount: input.transmittedCount ?? 0,
        finalizedCount: input.finalizedCount ?? 0,
        lostCount: input.lostCount ?? 0,
        capacityTotal: input.capacityTotal ?? 0,
        capacityReserved: input.capacityReserved ?? 0
      }
    });
  }

  async listBySeason(seasonId: string) {
    return prisma.performanceDaily.findMany({
      where: { seasonId },
      orderBy: { date: 'desc' }
    });
  }
}
