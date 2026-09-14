import { NextResponse } from 'next/server';
import {
  parseAxeptaLimonetikResponse,
  parseLimonetikUserData
} from '@/lib/checkout/axepta-limonetik';
import { failOrderPayment } from '@/lib/checkout/payment';
import { getServerSupabaseClient } from '@/lib/supabase/server';
import type { Json } from '@/types/supabase';

export const runtime = 'nodejs';

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

async function handleFailure(request: Request, formData?: FormData | null) {
  const url = new URL(request.url);
  const query = Object.fromEntries(url.searchParams.entries());
  if (formData) {
    for (const [key, value] of formData.entries()) {
      if (typeof value === 'string') query[key] = value;
    }
  }

  const parsed = parseAxeptaLimonetikResponse({
    dataHex: query.Data || query.data || null,
    len: query.Len || query.len || null,
    query
  });
  const userData = parseLimonetikUserData(parsed.userData);

  if (userData.paymentId && userData.orderId) {
    const supabase = getServerSupabaseClient();
    const { data: payment } = await supabase
      .from('payments')
      .select('id,order_id,status,raw_payload')
      .eq('id', userData.paymentId)
      .maybeSingle();

    if (payment && payment.status !== 'SUCCEEDED') {
      const previous = asRecord(payment.raw_payload) ?? {};
      const axepta = asRecord(previous.axepta) ?? {};
      await supabase
        .from('payments')
        .update({
          raw_payload: {
            ...previous,
            axepta: {
              ...axepta,
              provider: 'axepta-limonetik',
              status: parsed.status,
              code: parsed.code,
              description: parsed.description,
              lastLimonetikFailureAt: new Date().toISOString(),
              providerUpdate: parsed.raw
            }
          } as Json
        })
        .eq('id', payment.id);

      await failOrderPayment({
        orderId: payment.order_id,
        paymentId: payment.id,
        providerPayload: {
          provider: 'AXEPTA_LIMONETIK',
          source: 'failure',
          status: parsed.status,
          code: parsed.code
        }
      });
    }
  }

  const failed = new URL('/checkout/paiement', url.origin);
  failed.searchParams.set('failed', '1');
  if (userData.orderId) failed.searchParams.set('orderId', userData.orderId);
  if (userData.checkoutId) failed.searchParams.set('checkoutId', userData.checkoutId);
  failed.searchParams.set('error', 'limonetik-cancelled-or-failed');
  return NextResponse.redirect(failed);
}

export async function GET(request: Request) {
  try {
    return await handleFailure(request);
  } catch (error) {
    console.error('[axepta/limonetik/failure] failed', error);
    return NextResponse.redirect(new URL('/checkout/paiement?failed=1&error=limonetik-failure', request.url));
  }
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData().catch(() => null);
    return await handleFailure(request, formData);
  } catch (error) {
    console.error('[axepta/limonetik/failure] POST failed', error);
    return NextResponse.redirect(new URL('/checkout/paiement?failed=1&error=limonetik-failure', request.url));
  }
}
