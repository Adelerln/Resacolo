import { prisma } from '@/lib/db';
import type { SessionStatus } from '@prisma/client';

export type SessionInput = {
  stayId: string;
  seasonId: string;
  startDate: Date;
  endDate: Date;
  capacityTotal: number;
};

export class SessionService {
  async create(input: SessionInput) {
    const status = this.calculateStatus(input.capacityTotal, 0);
    return prisma.staySession.create({
      data: { ...input, status }
    });
  }

  async updateCapacity(sessionId: string, capacityReserved: number) {
    const session = await prisma.staySession.findUnique({ where: { id: sessionId } });
    if (!session) return null;
    const status = this.calculateStatus(session.capacityTotal, capacityReserved);
    return prisma.staySession.update({
      where: { id: sessionId },
      data: { capacityReserved, status }
    });
  }

  calculateStatus(total: number, reserved: number): SessionStatus {
    if (reserved >= total) return 'CLOSED';
    if (total > 0 && reserved / total >= 0.9) return 'NEAR_FULL';
    return 'OPEN';
  }
}
