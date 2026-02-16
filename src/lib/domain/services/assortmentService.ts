import { prisma } from '@/lib/db';

type AssortmentItemType = 'STAY' | 'ORGANIZER' | 'THEME' | 'TAG';

export type AssortmentInput = {
  partnerTenantId: string;
  seasonId: string;
  name: string;
};

export type AssortmentItemInput = {
  type: AssortmentItemType;
  targetRef: string;
  include?: boolean;
  priority?: number;
};

export class AssortmentService {
  async create(input: AssortmentInput) {
    return prisma.assortment.create({ data: input });
  }

  async addItem(assortmentId: string, input: AssortmentItemInput) {
    return prisma.assortmentItem.create({
      data: {
        assortmentId,
        type: input.type,
        targetRef: input.targetRef,
        include: input.include ?? true,
        priority: input.priority ?? 0
      }
    });
  }

  async listByPartner(partnerTenantId: string, seasonId: string) {
    return prisma.assortment.findMany({
      where: { partnerTenantId, seasonId, status: 'ACTIVE' },
      include: { items: true }
    });
  }

  async listCatalogStays(partnerTenantId: string, seasonId: string) {
    const assortments = await this.listByPartner(partnerTenantId, seasonId);
    const stayIds = assortments
      .flatMap((a: { items: Array<{ type: AssortmentItemType; include: boolean; targetRef: string }> }) => a.items)
      .filter((item: { type: AssortmentItemType; include: boolean }) => item.type === 'STAY' && item.include)
      .map((item: { targetRef: string }) => item.targetRef);

    if (stayIds.length === 0) return [];

    return prisma.stay.findMany({
      where: { id: { in: stayIds }, seasonId, status: 'PUBLISHED' }
    });
  }
}
