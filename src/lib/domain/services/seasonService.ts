import { prisma } from '@/lib/db';

export type SeasonInput = {
  name: string;
  startsAt: Date;
  endsAt: Date;
  status?: string | null;
};

export class SeasonService {
  async list() {
    return prisma.season.findMany({ orderBy: { startsAt: 'desc' } });
  }

  async create(input: SeasonInput) {
    return prisma.season.create({ data: input });
  }

  async update(id: string, input: Partial<SeasonInput>) {
    return prisma.season.update({ where: { id }, data: input });
  }
}
