import { NextResponse } from 'next/server';
import { z } from 'zod';
import { SeasonService } from '@/lib/domain/services/seasonService';

export const runtime = 'nodejs';

const seasonSchema = z.object({
  name: z.string().min(2),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  status: z.string().optional()
});

export async function GET() {
  const service = new SeasonService();
  const seasons = await service.list();
  return NextResponse.json(seasons);
}

export async function POST(req: Request) {
  const body = await req.json();
  const input = seasonSchema.parse(body);
  const service = new SeasonService();
  const season = await service.create({
    name: input.name,
    startsAt: new Date(input.startsAt),
    endsAt: new Date(input.endsAt),
    status: input.status
  });
  return NextResponse.json(season, { status: 201 });
}
