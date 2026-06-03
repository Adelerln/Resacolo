import { NextResponse } from 'next/server';
import { checkoutManualConfirmBodySchema } from '@/lib/checkout/schemas';
import { getApiErrorMessage } from '@/lib/checkout/api';
import { getMoneticoMode } from '@/lib/checkout/monetico';
import { markOrderPaid } from '@/lib/checkout/payment';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    if (getMoneticoMode() === 'live') {
      return NextResponse.json({ error: 'Confirmation manuelle indisponible en mode Monetico live.' }, { status: 400 });
    }

    const body = checkoutManualConfirmBodySchema.parse(await req.json());
    const payments = 'payments' in body ? body.payments : [body];

    if (payments.length === 0 || payments.some((payment) => !payment.orderId || !payment.paymentId)) {
      return NextResponse.json({ error: 'Paiement de confirmation invalide.' }, { status: 400 });
    }

    const results = await Promise.all(
      payments.map((payment) =>
        markOrderPaid({
          orderId: payment.orderId,
          paymentId: payment.paymentId,
          providerPayload: {
            provider: 'MONETICO_MOCK',
            confirmedAt: new Date().toISOString()
          },
          paymentStatus: 'SUCCEEDED'
        })
      )
    );

    return NextResponse.json({
      isBatch: payments.length > 1,
      orderId: results[0]?.orderId ?? null,
      status: results[0]?.status ?? null,
      results
    });
  } catch (error) {
    return NextResponse.json({ error: getApiErrorMessage(error) }, { status: 400 });
  }
}
