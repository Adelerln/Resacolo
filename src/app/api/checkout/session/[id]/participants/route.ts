import { NextResponse } from 'next/server';
import { checkoutParticipantsBodySchema } from '@/lib/checkout/schemas';
import { getApiErrorMessage } from '@/lib/checkout/api';
import { saveCheckoutCartSnapshot } from '@/lib/checkout/cart-tracking';

export const runtime = 'nodejs';

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: checkoutId } = await params;
    const body = checkoutParticipantsBodySchema.parse(await req.json());
    await saveCheckoutCartSnapshot({
      checkoutId,
      participants: body.participants,
      lastStep: 'participants'
    });
    return NextResponse.json({ participants: body.participants });
  } catch (error) {
    return NextResponse.json({ error: getApiErrorMessage(error) }, { status: 400 });
  }
}
