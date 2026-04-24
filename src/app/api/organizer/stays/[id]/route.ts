import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireOrganizerApiAccess } from '@/lib/organizer-backoffice-access.server';
import { prisma } from '@/lib/db';
import { StayService, type StayInput } from '@/lib/domain/services/stayService';

export const runtime = 'nodejs';

const stayUpdateSchema = z.object({
  title: z.string().min(2).optional(),
  description: z.string().optional(),
  ageMin: z.number().int().optional(),
  ageMax: z.number().int().optional(),
  location: z.string().optional(),
  themesJson: z.unknown().optional(),
  tagsJson: z.unknown().optional()
});

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
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

  const service = new StayService();
  const stay = await service.get(id);
  if (!stay) {
    return NextResponse.json({ error: 'Stay not found' }, { status: 404 });
  }
  return NextResponse.json(stay);
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
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
  const input = stayUpdateSchema.parse(body);
  const service = new StayService();
  const stay = await service.update(id, input as Partial<StayInput>);
  return NextResponse.json(stay);
}
