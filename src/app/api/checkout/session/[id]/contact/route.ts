import { NextResponse } from 'next/server';
import { checkoutContactBodySchema } from '@/lib/checkout/schemas';
import { getApiErrorMessage } from '@/lib/checkout/api';
import { saveCheckoutCartSnapshot } from '@/lib/checkout/cart-tracking';

export const runtime = 'nodejs';

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: checkoutId } = await params;
    const body = checkoutContactBodySchema.parse(await req.json());
    await saveCheckoutCartSnapshot({
      checkoutId,
      contact: body.contact,
      lastStep: 'contact'
    });
    return NextResponse.json({ contact: body.contact });
  } catch (error) {
    return NextResponse.json({ error: getApiErrorMessage(error) }, { status: 400 });
  }
}
