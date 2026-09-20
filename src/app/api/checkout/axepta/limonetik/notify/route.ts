import { NextResponse } from 'next/server';
import {
  isLimonetikPaymentSuccess,
  parseAxeptaLimonetikResponse,
  parseLimonetikUserData
} from '@/lib/checkout/axepta-limonetik';
import { failOrderPayment, markOrderPaid } from '@/lib/checkout/payment';
import { getServerSupabaseClient } from '@/lib/supabase/server';
import type { Json } from '@/types/supabase';

export const runtime = 'nodejs';

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

async function applyNotify(parsed: ReturnType<typeof parseAxeptaLimonetikResponse>) {
  const userData = parseLimonetikUserData(parsed.userData);
  const supabase = getServerSupabaseClient();

  let payments =
    userData.paymentId
      ? (
          await supabase
            .from('payments')
            .select('id,order_id,status,raw_payload,monetico_transaction_id,monetico_reference')
            .eq('id', userData.paymentId)
        ).data ?? []
      : [];

  if (payments.length === 0 && parsed.transId) {
    payments =
      (
        await supabase
          .from('payments')
          .select('id,order_id,status,raw_payload,monetico_transaction_id,monetico_reference')
          .eq('monetico_transaction_id', parsed.transId)
      ).data ?? [];
  }

  if (payments.length === 0) {
    return { ok: false as const, reason: 'PAYMENT_NOT_FOUND' };
  }

  const success = parsed.macValid && isLimonetikPaymentSuccess(parsed.status, parsed.code);

  for (const payment of payments) {
    const previous = asRecord(payment.raw_payload) ?? {};
    const axepta = asRecord(previous.axepta) ?? {};
    const nextPayload = {
      ...previous,
      axepta: {
        ...axepta,
        provider: 'axepta-limonetik',
        payType: 'cvconnect',
        payId: parsed.payId,
        transId: parsed.transId,
        status: parsed.status,
        code: parsed.code,
        description: parsed.description,
        lastNotifyAt: new Date().toISOString(),
        providerUpdate: parsed.raw
      }
    } as Json;

    await supabase
      .from('payments')
      .update({
        raw_payload: nextPayload,
        monetico_reference: parsed.payId || payment.monetico_reference,
        monetico_transaction_id: parsed.transId || payment.monetico_transaction_id
      })
      .eq('id', payment.id);

    if (success && payment.status !== 'SUCCEEDED') {
      await markOrderPaid({
        orderId: payment.order_id,
        paymentId: payment.id,
        providerPayload: {
          provider: 'AXEPTA_LIMONETIK',
          source: 'notify',
          payId: parsed.payId,
          transId: parsed.transId,
          status: parsed.status,
          code: parsed.code
        }
      });
    } else if (!success && payment.status !== 'SUCCEEDED') {
      await failOrderPayment({
        orderId: payment.order_id,
        paymentId: payment.id,
        providerPayload: {
          provider: 'AXEPTA_LIMONETIK',
          source: 'notify',
          payId: parsed.payId,
          transId: parsed.transId,
          status: parsed.status,
          code: parsed.code
        }
      });
    }
  }

  return { ok: true as const, success, paymentCount: payments.length };
}

async function parseBody(request: Request) {
  const contentType = request.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    const json = (await request.json()) as Record<string, string>;
    return parseAxeptaLimonetikResponse({
      dataHex: json.Data || json.data || null,
      len: json.Len || json.len || null,
      query: json
    });
  }

  const formData = await request.formData().catch(() => null);
  const query: Record<string, string> = Object.fromEntries(new URL(request.url).searchParams.entries());
  if (formData) {
    for (const [key, value] of formData.entries()) {
      if (typeof value === 'string') query[key] = value;
    }
  }
  return parseAxeptaLimonetikResponse({
    dataHex: query.Data || query.data || null,
    len: query.Len || query.len || null,
    query
  });
}

export async function POST(request: Request) {
  try {
    const parsed = await parseBody(request);
    const result = await applyNotify(parsed);
    if (!result.ok) {
      console.error('[axepta/limonetik/notify] payment not found', parsed);
    }
    // Axepta expects HTTP 200 even when shop-side mapping fails, to avoid endless retries storms.
    return NextResponse.json({ received: true, ...result }, { status: 200 });
  } catch (error) {
    console.error('[axepta/limonetik/notify] failed', error);
    return NextResponse.json({ received: false, error: 'notify-failed' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const parsed = parseAxeptaLimonetikResponse({
      dataHex: url.searchParams.get('Data') || url.searchParams.get('data'),
      len: url.searchParams.get('Len') || url.searchParams.get('len'),
      query: Object.fromEntries(url.searchParams.entries())
    });
    const result = await applyNotify(parsed);
    return NextResponse.json({ received: true, ...result }, { status: 200 });
  } catch (error) {
    console.error('[axepta/limonetik/notify] GET failed', error);
    return NextResponse.json({ received: false, error: 'notify-failed' }, { status: 500 });
  }
}
