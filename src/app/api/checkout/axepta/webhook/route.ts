import { NextResponse } from 'next/server';
import {
  getAxeptaPaymentByPayId,
  isAxeptaSuccessResponseCode,
  isAxeptaSuccessfulStatus,
  parseAxeptaWebhookPayload,
  verifyAxeptaWebhookSignature
} from '@/lib/checkout/axepta';
import { failOrderPayment, markOrderPaid } from '@/lib/checkout/payment';
import { getServerSupabaseClient } from '@/lib/supabase/server';
import type { Json } from '@/types/supabase';

export const runtime = 'nodejs';

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

async function findPaymentsByAxeptaIds(input: { payId: string | null; transId: string | null }) {
  const supabase = getServerSupabaseClient();

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

  return [];
}

async function applyAxeptaPaymentResult(input: {
  payId: string | null;
  transId: string | null;
  status: string | null;
  responseCode: string | null;
  raw: Record<string, unknown>;
}) {
  const payments = await findPaymentsByAxeptaIds({
    payId: input.payId,
    transId: input.transId
  });
  if (payments.length === 0) {
    return { ok: false as const, reason: 'PAYMENT_NOT_FOUND' };
  }

  const success =
    isAxeptaSuccessfulStatus(input.status) && isAxeptaSuccessResponseCode(input.responseCode);

  for (const payment of payments) {
    const previous = asRecord(payment.raw_payload) ?? {};
    const axepta = asRecord(previous.axepta) ?? {};
    const nextPayload = {
      ...previous,
      axepta: {
        ...axepta,
        payId: input.payId,
        transId: input.transId,
        status: input.status,
        responseCode: input.responseCode,
        lastWebhookAt: new Date().toISOString(),
        providerUpdate: input.raw
      }
    } as Json;

    if (success) {
      if (payment.status !== 'SUCCEEDED') {
        await markOrderPaid({
          orderId: payment.order_id,
          paymentId: payment.id,
          providerPayload: {
            provider: 'AXEPTA',
            payId: input.payId,
            transId: input.transId,
            status: input.status,
            responseCode: input.responseCode
          }
        });
      }
      await getServerSupabaseClient()
        .from('payments')
        .update({
          raw_payload: nextPayload,
          monetico_reference: input.payId || payment.monetico_reference,
          monetico_transaction_id: input.transId || payment.monetico_transaction_id
        })
        .eq('id', payment.id);
    } else if (payment.status !== 'SUCCEEDED') {
      await failOrderPayment({
        orderId: payment.order_id,
        paymentId: payment.id,
        providerPayload: {
          provider: 'AXEPTA',
          payId: input.payId,
          transId: input.transId,
          status: input.status,
          responseCode: input.responseCode
        }
      });
      await getServerSupabaseClient()
        .from('payments')
        .update({ raw_payload: nextPayload })
        .eq('id', payment.id);
    }
  }

  return { ok: true as const, success, paymentCount: payments.length };
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const timestamp = request.headers.get('x-paygate-timestamp');
  const signature = request.headers.get('x-paygate-signature');

  if (
    !verifyAxeptaWebhookSignature({
      timestampHeader: timestamp,
      signatureHeader: signature,
      rawBody
    })
  ) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  let payload;
  try {
    payload = parseAxeptaWebhookPayload(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // Always re-check authoritative status via getByPayId when possible.
  let status = payload.status;
  let responseCode = payload.responseCode;
  let payId = payload.payId;
  let verifiedRaw: Record<string, unknown> = payload.raw;

  if (payload.payId) {
    try {
      const verified = await getAxeptaPaymentByPayId(payload.payId);
      status = verified.status;
      responseCode = verified.responseCode;
      payId = verified.payId;
      verifiedRaw = verified.raw;
    } catch (error) {
      console.error('axepta webhook getByPayId failed', error);
    }
  }

  const result = await applyAxeptaPaymentResult({
    payId,
    transId: payload.transId,
    status,
    responseCode,
    raw: verifiedRaw
  });

  if (!result.ok) {
    console.error('axepta webhook: payment not found', {
      payId,
      transId: payload.transId
    });
  }

  return NextResponse.json({ received: true }, { status: 200 });
}
