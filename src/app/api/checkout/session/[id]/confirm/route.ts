import { NextResponse } from 'next/server';
import { checkoutManualConfirmBodySchema } from '@/lib/checkout/schemas';
import { getApiErrorMessage } from '@/lib/checkout/api';
import { getActivePaymentProviderMode, getPaymentProvider } from '@/lib/checkout/payment-provider';
import { markOrderPaid } from '@/lib/checkout/payment';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    if (getActivePaymentProviderMode() === 'live') {
      return NextResponse.json(
        { error: 'Confirmation manuelle indisponible en mode paiement live.' },
        { status: 400 }
      );
    }

    const body = checkoutManualConfirmBodySchema.parse(await req.json());
    const payments = 'payments' in body ? body.payments : [body];

    if (payments.length === 0 || payments.some((payment) => !payment.orderId || !payment.paymentId)) {
      return NextResponse.json({ error: 'Paiement de confirmation invalide.' }, { status: 400 });
    }

    const provider = getPaymentProvider() === 'axepta' ? 'AXEPTA_MOCK' : 'MONETICO_MOCK';

    const results = await Promise.all(
      payments.map((payment) =>
        markOrderPaid({
          orderId: payment.orderId,
          paymentId: payment.paymentId,
          providerPayload: {
            provider,
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
