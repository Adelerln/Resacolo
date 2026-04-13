import { NextResponse } from 'next/server';
import { checkoutManualConfirmBodySchema } from '@/lib/checkout/schemas';
import { getApiErrorMessage } from '@/lib/checkout/api';
import { markOrderPaid } from '@/lib/checkout/payment';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const body = checkoutManualConfirmBodySchema.parse(await req.json());

    const result = await markOrderPaid({
      orderId: body.orderId,
      paymentId: body.paymentId,
      providerPayload: {
        provider: 'MONETICO_MOCK',
        confirmedAt: new Date().toISOString()
      },
      paymentStatus: 'SUCCEEDED'
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: getApiErrorMessage(error) }, { status: 400 });
  }
}
