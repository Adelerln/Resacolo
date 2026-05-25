import { NextResponse } from 'next/server';
import { checkoutParticipantsBodySchema } from '@/lib/checkout/schemas';
import { getApiErrorMessage } from '@/lib/checkout/api';

export const runtime = 'nodejs';

export async function PATCH(req: Request) {
  try {
    const body = checkoutParticipantsBodySchema.parse(await req.json());
    return NextResponse.json({ participants: body.participants });
  } catch (error) {
    return NextResponse.json({ error: getApiErrorMessage(error) }, { status: 400 });
  }
}
