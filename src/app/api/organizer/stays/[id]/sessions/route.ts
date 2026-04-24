import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireOrganizerApiAccess } from '@/lib/organizer-backoffice-access.server';
import { prisma } from '@/lib/db';
import { SessionService } from '@/lib/domain/services/sessionService';

export const runtime = 'nodejs';

const sessionSchema = z.object({
  seasonId: z.string(),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  capacityTotal: z.number().int().nonnegative()
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const stayOwnership = await prisma.stay.findUnique({
    where: { id },
    select: { organizerTenantId: true }
  });
  if (!stayOwnership) {
    return NextResponse.json({ error: 'Stay not found' }, { status: 404 });
  }
  const access = await requireOrganizerApiAccess({
    requestedOrganizerId: stayOwnership.organizerTenantId,
    requiredSection: 'stays'
  });
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const body = await req.json();
  const input = sessionSchema.parse(body);
  const service = new SessionService();
  const session = await service.create({
    stayId: id,
    seasonId: input.seasonId,
    startDate: new Date(input.startDate),
    endDate: new Date(input.endDate),
    capacityTotal: input.capacityTotal
  });
  return NextResponse.json(session, { status: 201 });
}
