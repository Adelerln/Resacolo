import { NextResponse } from 'next/server';
import {
  getMoneticoMode,
  isMoneticoSuccessCode,
  verifyMoneticoCallbackMac
} from '@/lib/checkout/monetico';
import {
  failOrderPayment,
  findPaymentsByMoneticoReference,
  markOrderPaid
} from '@/lib/checkout/payment';

export const runtime = 'nodejs';

function normalizePayload(
  searchParams: URLSearchParams,
  formData: FormData | null
) {
  const result: Record<string, string> = {};
  for (const [key, value] of searchParams.entries()) {
    result[key] = value;
  }
  if (formData) {
    for (const [key, value] of formData.entries()) {
      result[key] = String(value);
    }
  }
  return result;
}

async function handleCallback(payload: Record<string, string>) {
  const mode = getMoneticoMode();
  if (mode === 'live' && !verifyMoneticoCallbackMac(payload)) {
    return new NextResponse('MAC INVALID', { status: 400 });
  }

  const reference = (payload.reference ?? '').trim();
  if (!reference) {
    return new NextResponse('MISSING REFERENCE', { status: 400 });
  }

  const paymentRows = await findPaymentsByMoneticoReference(reference);
  if (paymentRows.length === 0) {
    return new NextResponse('PAYMENT NOT FOUND', { status: 404 });
  }

  const isSuccess = isMoneticoSuccessCode(payload['code-retour']);
  if (isSuccess) {
    await Promise.all(
      paymentRows
        .filter((paymentRow) => paymentRow.id && paymentRow.order_id && paymentRow.status !== 'SUCCEEDED')
        .map((paymentRow) =>
          markOrderPaid({
            orderId: paymentRow.order_id,
            paymentId: paymentRow.id,
            providerPayload: payload,
            paymentStatus: 'SUCCEEDED'
          })
        )
    );
    return new NextResponse('OK', { status: 200 });
  }

  await Promise.all(
    paymentRows
      .filter((paymentRow) => paymentRow.id && paymentRow.order_id && paymentRow.status !== 'FAILED')
      .map((paymentRow) =>
        failOrderPayment({
          orderId: paymentRow.order_id,
          paymentId: paymentRow.id,
          providerPayload: payload
        })
      )
  );
  return new NextResponse('OK', { status: 200 });
}

export async function POST(req: Request) {
  try {
    const contentType = req.headers.get('content-type') ?? '';
    let formData: FormData | null = null;
    if (contentType.includes('multipart/form-data') || contentType.includes('application/x-www-form-urlencoded')) {
      formData = await req.formData();
    }

    const payload = normalizePayload(new URL(req.url).searchParams, formData);
    return await handleCallback(payload);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur callback Monetico.' },
      { status: 400 }
    );
  }
}

export async function GET(req: Request) {
  try {
    const payload = normalizePayload(new URL(req.url).searchParams, null);
    return await handleCallback(payload);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur callback Monetico.' },
      { status: 400 }
    );
  }
}
