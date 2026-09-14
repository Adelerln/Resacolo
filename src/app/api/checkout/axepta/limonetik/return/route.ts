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

async function findPayments(input: {
  transId: string | null;
  payId: string | null;
  paymentId: string | null;
  orderId: string | null;
}) {
  const supabase = getServerSupabaseClient();

  if (input.paymentId) {
    const { data, error } = await supabase
      .from('payments')
      .select('id,order_id,status,raw_payload,monetico_transaction_id,monetico_reference')
      .eq('id', input.paymentId);
    if (error) throw new Error(error.message);
    if (data && data.length > 0) return data;
  }

  if (input.transId) {
    const { data, error } = await supabase
      .from('payments')
      .select('id,order_id,status,raw_payload,monetico_transaction_id,monetico_reference')
      .eq('monetico_transaction_id', input.transId);
    if (error) throw new Error(error.message);
    if (data && data.length > 0) return data;
  }

  if (input.payId) {
    const { data, error } = await supabase
      .from('payments')
      .select('id,order_id,status,raw_payload,monetico_transaction_id,monetico_reference')
      .eq('monetico_reference', input.payId);
    if (error) throw new Error(error.message);
    if (data && data.length > 0) return data;
  }

  if (input.orderId) {
    const { data, error } = await supabase
      .from('payments')
      .select('id,order_id,status,raw_payload,monetico_transaction_id,monetico_reference')
      .eq('order_id', input.orderId)
      .order('created_at', { ascending: false })
      .limit(5);
    if (error) throw new Error(error.message);
    return (data ?? []).filter((row) => {
      const raw = asRecord(row.raw_payload);
      const axepta = asRecord(raw?.axepta);
      return axepta?.provider === 'axepta-limonetik';
    });
  }

  return [];
}

async function applyLimonetikResult(input: {
  parsed: ReturnType<typeof parseAxeptaLimonetikResponse>;
  source: 'return' | 'failure' | 'notify';
}) {
  const userData = parseLimonetikUserData(input.parsed.userData);
  const payments = await findPayments({
    transId: input.parsed.transId,
    payId: input.parsed.payId,
    paymentId: userData.paymentId,
    orderId: userData.orderId
  });

  if (payments.length === 0) {
    return {
      ok: false as const,
      reason: 'PAYMENT_NOT_FOUND' as const,
      orderId: userData.orderId,
      success: false
    };
  }

  const success =
    input.source !== 'failure' &&
    input.parsed.macValid &&
    isLimonetikPaymentSuccess(input.parsed.status, input.parsed.code);

  for (const payment of payments) {
    const previous = asRecord(payment.raw_payload) ?? {};
    const axepta = asRecord(previous.axepta) ?? {};
    const nextPayload = {
      ...previous,
      axepta: {
        ...axepta,
        provider: 'axepta-limonetik',
        payType: 'cvconnect',
        payId: input.parsed.payId,
        transId: input.parsed.transId,
        status: input.parsed.status,
        code: input.parsed.code,
        description: input.parsed.description,
        lastLimonetikAt: new Date().toISOString(),
        source: input.source,
        providerUpdate: input.parsed.raw
      }
    } as Json;

    await getServerSupabaseClient()
      .from('payments')
      .update({
        raw_payload: nextPayload,
        monetico_reference: input.parsed.payId || payment.monetico_reference,
        monetico_transaction_id: input.parsed.transId || payment.monetico_transaction_id
      })
      .eq('id', payment.id);

    if (success && payment.status !== 'SUCCEEDED') {
      await markOrderPaid({
        orderId: payment.order_id,
        paymentId: payment.id,
        providerPayload: {
          provider: 'AXEPTA_LIMONETIK',
          source: input.source,
          payId: input.parsed.payId,
          transId: input.parsed.transId,
          status: input.parsed.status,
          code: input.parsed.code
        }
      });
    } else if (!success && payment.status !== 'SUCCEEDED') {
      await failOrderPayment({
        orderId: payment.order_id,
        paymentId: payment.id,
        providerPayload: {
          provider: 'AXEPTA_LIMONETIK',
          source: input.source,
          payId: input.parsed.payId,
          transId: input.parsed.transId,
          status: input.parsed.status,
          code: input.parsed.code
        }
      });
    }
  }

  return {
    ok: true as const,
    success,
    orderId: userData.orderId || payments[0]?.order_id || null,
    paymentCount: payments.length
  };
}

function parseRequestParams(request: Request, formData?: FormData | null) {
  const url = new URL(request.url);
  const query = Object.fromEntries(url.searchParams.entries());
  if (formData) {
    for (const [key, value] of formData.entries()) {
      if (typeof value === 'string') query[key] = value;
    }
  }
  const dataHex = query.Data || query.data || null;
  const len = query.Len || query.len || null;
  return parseAxeptaLimonetikResponse({
    dataHex,
    len,
    query
  });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  try {
    const parsed = parseRequestParams(request);
    const result = await applyLimonetikResult({ parsed, source: 'return' });
    const orderId = result.orderId;
    if (!result.ok || !result.success || !orderId) {
      const failed = new URL('/checkout/paiement', url.origin);
      failed.searchParams.set('failed', '1');
      if (orderId) failed.searchParams.set('orderId', orderId);
      failed.searchParams.set('error', result.ok ? 'limonetik-failed' : 'limonetik-payment-missing');
      return NextResponse.redirect(failed);
    }
    return NextResponse.redirect(
      new URL(`/checkout/confirmation/${orderId}?mode=axepta-limonetik`, url.origin)
    );
  } catch (error) {
    console.error('[axepta/limonetik/return] failed', error);
    const failed = new URL('/checkout/paiement', url.origin);
    failed.searchParams.set('failed', '1');
    failed.searchParams.set('error', 'limonetik-return-error');
    return NextResponse.redirect(failed);
  }
}

export async function POST(request: Request) {
  // Some Axepta setups POST back to URLSuccess.
  const formData = await request.formData().catch(() => null);
  const url = new URL(request.url);
  try {
    const parsed = parseRequestParams(request, formData);
    const result = await applyLimonetikResult({ parsed, source: 'return' });
    const orderId = result.orderId;
    if (!result.ok || !result.success || !orderId) {
      const failed = new URL('/checkout/paiement', url.origin);
      failed.searchParams.set('failed', '1');
      if (orderId) failed.searchParams.set('orderId', orderId);
      failed.searchParams.set('error', 'limonetik-failed');
      return NextResponse.redirect(failed);
    }
    return NextResponse.redirect(
      new URL(`/checkout/confirmation/${orderId}?mode=axepta-limonetik`, url.origin)
    );
  } catch (error) {
    console.error('[axepta/limonetik/return] POST failed', error);
    const failed = new URL('/checkout/paiement', url.origin);
    failed.searchParams.set('failed', '1');
    failed.searchParams.set('error', 'limonetik-return-error');
    return NextResponse.redirect(failed);
  }
}
