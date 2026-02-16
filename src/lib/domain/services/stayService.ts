import { prisma } from '@/lib/db';
import { evaluateStayQuality } from '@/lib/domain/quality/stayQuality';

export type StayInput = {
  organizerTenantId: string;
  seasonId: string;
  title: string;
  description?: string | null;
  ageMin?: number | null;
  ageMax?: number | null;
  location?: string | null;
  themesJson?: unknown;
  tagsJson?: unknown;
};

export class StayService {
  async create(input: StayInput, actorUserId?: string) {
    const stay = await prisma.stay.create({
      data: {
        ...input,
        createdBy: actorUserId,
        updatedBy: actorUserId
      }
    });

    await this.recalculateQuality(stay.id);
    return stay;
  }

  async update(id: string, input: Partial<StayInput>, actorUserId?: string) {
    const stay = await prisma.stay.update({
      where: { id },
      data: { ...input, updatedBy: actorUserId }
    });

    await this.recalculateQuality(stay.id);
    return stay;
  }

  async get(id: string) {
    return prisma.stay.findUnique({
      where: { id },
      include: { sessions: true, media: true }
    });
  }

  async recalculateQuality(stayId: string) {
    const stay = await prisma.stay.findUnique({
      where: { id: stayId },
      include: { sessions: true, media: true }
    });
    if (!stay) return null;

    const result = evaluateStayQuality({
      title: stay.title,
      description: stay.description,
      ageMin: stay.ageMin,
      ageMax: stay.ageMax,
      location: stay.location,
      themesCount: Array.isArray(stay.themesJson) ? stay.themesJson.length : 0,
      mediaCount: stay.media.length,
      sessions: stay.sessions
    });

    return prisma.stay.update({
      where: { id: stayId },
      data: {
        qualityScore: result.score,
        qualityWarningsJson: result.warnings
      }
    });
  }
}
