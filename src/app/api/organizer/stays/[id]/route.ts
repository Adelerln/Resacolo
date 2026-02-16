import { NextResponse } from 'next/server';
import { z } from 'zod';
import { StayService } from '@/lib/domain/services/stayService';

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

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const service = new StayService();
  const stay = await service.get(params.id);
  if (!stay) {
    return NextResponse.json({ error: 'Stay not found' }, { status: 404 });
  }
  return NextResponse.json(stay);
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const body = await req.json();
  const input = stayUpdateSchema.parse(body);
  const service = new StayService();
  const stay = await service.update(params.id, input);
  return NextResponse.json(stay);
}
