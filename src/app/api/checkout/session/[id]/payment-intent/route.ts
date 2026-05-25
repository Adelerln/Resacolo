import { NextResponse } from 'next/server';
import { checkoutPaymentIntentBodySchema } from '@/lib/checkout/schemas';
import { prepareCheckoutPayment } from '@/lib/checkout/payment';
import { getOrCreateClientUserId } from '@/lib/checkout/clientIdentity';
import { getApiErrorMessage } from '@/lib/checkout/api';

export const runtime = 'nodejs';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: checkoutId } = await params;
    const body = checkoutPaymentIntentBodySchema.parse(await req.json());
    const clientUserId = await getOrCreateClientUserId();

    const result = await prepareCheckoutPayment({
      checkoutId,
      clientUserId,
      items: body.items,
      contact: body.contact,
      participants: body.participants
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = getApiErrorMessage(error);
    if (message.toLowerCase().includes('connexion famille requise')) {
      return NextResponse.json({ error: message }, { status: 401 });
    }
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
