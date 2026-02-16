import { NextResponse } from 'next/server';
import { z } from 'zod';
import { SessionService } from '@/lib/domain/services/sessionService';

export const runtime = 'nodejs';

const sessionSchema = z.object({
  seasonId: z.string(),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  capacityTotal: z.number().int().positive()
});

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const body = await req.json();
  const input = sessionSchema.parse(body);
  const service = new SessionService();
  const session = await service.create({
    stayId: params.id,
    seasonId: input.seasonId,
    startDate: new Date(input.startDate),
    endDate: new Date(input.endDate),
    capacityTotal: input.capacityTotal
  });
  return NextResponse.json(session, { status: 201 });
}
