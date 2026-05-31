import { randomUUID } from 'crypto';
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { checkoutSessionBodySchema } from '@/lib/checkout/schemas';
import { saveCheckoutCartSnapshot } from '@/lib/checkout/cart-tracking';
import { repriceCart } from '@/lib/checkout/pricing';
import { getApiErrorMessage } from '@/lib/checkout/api';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const body = checkoutSessionBodySchema.parse(await req.json());
    const pricing = await repriceCart(body.items);
    const checkoutId = randomUUID();
    const session = await getSession();

    await saveCheckoutCartSnapshot({
      checkoutId,
      clientUserId: session?.isClient ? session.userId : null,
      organizerId: body.items[0]?.organizerId ?? null,
      items: body.items,
      pricing,
      lastStep: 'session'
    });

    return NextResponse.json({
      checkoutId,
      pricing
    });
  } catch (error) {
    return NextResponse.json({ error: getApiErrorMessage(error) }, { status: 400 });
  }
}
