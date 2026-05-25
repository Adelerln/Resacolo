import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireOrganizerApiAccess } from '@/lib/organizer-backoffice-access.server';
import { prisma } from '@/lib/db';
import { StayService } from '@/lib/domain/services/stayService';

export const runtime = 'nodejs';

const staySchema = z.object({
  organizerTenantId: z.string(),
  seasonId: z.string(),
  title: z.string().min(2),
  description: z.string().optional(),
  ageMin: z.number().int().optional(),
  ageMax: z.number().int().optional(),
  location: z.string().optional()
});

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const organizerTenantId = searchParams.get('organizerTenantId');
  const seasonId = searchParams.get('seasonId');
  const access = await requireOrganizerApiAccess({
    requestedOrganizerId: organizerTenantId,
    requiredSection: 'stays'
  });
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }
  const { selectedOrganizerId } = access.context;

  const stays = await prisma.stay.findMany({
    where: {
      organizerTenantId: selectedOrganizerId,
      seasonId: seasonId ?? undefined
    },
    orderBy: { createdAt: 'desc' }
  });

  return NextResponse.json(stays);
}

export async function POST(req: Request) {
  const body = await req.json();
  const input = staySchema.parse(body);
  const access = await requireOrganizerApiAccess({
    requestedOrganizerId: input.organizerTenantId,
    requiredSection: 'stays'
  });
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }
  const { selectedOrganizerId } = access.context;
  const service = new StayService();
  const stay = await service.create({
    ...input,
    organizerTenantId: selectedOrganizerId
  });
  return NextResponse.json(stay, { status: 201 });
}
