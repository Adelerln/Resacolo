import { randomUUID } from 'crypto';
import { NextResponse } from 'next/server';
import { checkoutSessionBodySchema } from '@/lib/checkout/schemas';
import { repriceCart } from '@/lib/checkout/pricing';
import { getApiErrorMessage } from '@/lib/checkout/api';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const body = checkoutSessionBodySchema.parse(await req.json());
    const pricing = await repriceCart(body.items);

    return NextResponse.json({
      checkoutId: randomUUID(),
      pricing
    });
  } catch (error) {
    return NextResponse.json({ error: getApiErrorMessage(error) }, { status: 400 });
  }
}
