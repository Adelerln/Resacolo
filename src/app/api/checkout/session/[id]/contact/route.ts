import { NextResponse } from 'next/server';
import { checkoutContactBodySchema } from '@/lib/checkout/schemas';
import { getApiErrorMessage } from '@/lib/checkout/api';

export const runtime = 'nodejs';

export async function PATCH(req: Request) {
  try {
    const body = checkoutContactBodySchema.parse(await req.json());
    return NextResponse.json({ contact: body.contact });
  } catch (error) {
    return NextResponse.json({ error: getApiErrorMessage(error) }, { status: 400 });
  }
}
