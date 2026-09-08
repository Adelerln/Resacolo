import { NextResponse } from 'next/server';
import {
  getAxeptaPaymentByPayId,
  getAxeptaPaymentByTransId,
  isAxeptaSuccessResponseCode,
  isAxeptaSuccessfulStatus
} from '@/lib/checkout/axepta';
import { isBalancePaymentPayload } from '@/lib/order-balance-payment';
import { failOrderPayment, markOrderPaid } from '@/lib/checkout/payment';
import { getServerSupabaseClient } from '@/lib/supabase/server';
import type { Json } from '@/types/supabase';

export const runtime = 'nodejs';

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

async function findPaymentsByTransId(transId: string) {
  const supabase = getServerSupabaseClient();
  const { data, error } = await supabase
    .from('payments')
    .select('id,order_id,status,raw_payload,monetico_transaction_id,monetico_reference')
    .eq('monetico_transaction_id', transId);
  if (error) throw new Error(error.message);
  return data ?? [];
}

function resolveIsBalanceFlow(input: {
  source: string | null;
  payments: Array<{ raw_payload: Json | null }>;
}) {
  if (input.source === 'balance') return true;
  return input.payments.some((payment) => isBalancePaymentPayload(payment.raw_payload));
}

function balanceRetryUrl(origin: string, orderId: string, params?: Record<string, string>) {
  const target = new URL(`/mon-compte/reservations/${orderId}/paiement`, origin);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value) target.searchParams.set(key, value);
    }
  }
  return target;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const payId = url.searchParams.get('PayId')?.trim() || url.searchParams.get('payId')?.trim() || null;
  const transId = url.searchParams.get('transId')?.trim() || null;
  const orderId = url.searchParams.get('orderId')?.trim() || null;
  const source = url.searchParams.get('source')?.trim().toLowerCase() || null;

  try {
    const verified = payId
      ? await getAxeptaPaymentByPayId(payId)
      : transId
        ? await getAxeptaPaymentByTransId(transId)
        : null;

    if (!verified) {
      if (source === 'balance' && orderId) {
        return NextResponse.redirect(
          balanceRetryUrl(url.origin, orderId, { failed: '1', error: 'axepta-missing-id' })
        );
      }
      const failed = new URL('/checkout/paiement', url.origin);
      failed.searchParams.set('failed', '1');
      if (orderId) failed.searchParams.set('orderId', orderId);
      failed.searchParams.set('error', 'axepta-missing-id');
      return NextResponse.redirect(failed);
    }

    const payments = await findPaymentsByTransId(verified.transId || transId || '');
    const isBalanceFlow = resolveIsBalanceFlow({ source, payments });
    const success =
      isAxeptaSuccessfulStatus(verified.status) && isAxeptaSuccessResponseCode(verified.responseCode);

    for (const payment of payments) {
      const previous = asRecord(payment.raw_payload) ?? {};
      const axepta = asRecord(previous.axepta) ?? {};
      const nextPayload = {
        ...previous,
        axepta: {
          ...axepta,
          payId: verified.payId,
          transId: verified.transId,
          status: verified.status,
          responseCode: verified.responseCode,
          lastReturnAt: new Date().toISOString(),
          providerUpdate: verified.raw
        }
      } as Json;

      await getServerSupabaseClient()
        .from('payments')
        .update({
          raw_payload: nextPayload,
          monetico_reference: verified.payId || payment.monetico_reference,
          monetico_transaction_id: verified.transId || payment.monetico_transaction_id
        })
        .eq('id', payment.id);

      // Return URL must never be the only source of truth, but we still sync after getByPayId.
      if (success && payment.status !== 'SUCCEEDED') {
        await markOrderPaid({
          orderId: payment.order_id,
          paymentId: payment.id,
          providerPayload: {
            provider: 'AXEPTA',
            source: 'return',
            payId: verified.payId,
            transId: verified.transId,
            status: verified.status,
            responseCode: verified.responseCode
          }
        });
      } else if (!success && payment.status !== 'SUCCEEDED') {
        await failOrderPayment({
          orderId: payment.order_id,
          paymentId: payment.id,
          providerPayload: {
            provider: 'AXEPTA',
            source: 'return',
            payId: verified.payId,
            transId: verified.transId,
            status: verified.status,
            responseCode: verified.responseCode
          }
        });
      }
    }

    const confirmationOrderId = orderId || payments[0]?.order_id;
    if (!confirmationOrderId) {
      return NextResponse.redirect(
        new URL(
          isBalanceFlow ? '/mon-compte/reservations?error=axepta-order-missing' : '/checkout/paiement?error=axepta-order-missing',
          url.origin
        )
      );
    }

    if (!success) {
      if (isBalanceFlow) {
        return NextResponse.redirect(
          balanceRetryUrl(url.origin, confirmationOrderId, {
            failed: '1',
            transId: verified.transId || transId || ''
          })
        );
      }
      const failed = new URL('/checkout/paiement', url.origin);
      failed.searchParams.set('failed', '1');
      failed.searchParams.set('orderId', confirmationOrderId);
      if (verified.transId || transId) {
        failed.searchParams.set('transId', verified.transId || transId || '');
      }
      return NextResponse.redirect(failed);
    }

    if (isBalanceFlow) {
      return NextResponse.redirect(
        new URL(`/mon-compte/reservations?open=${encodeURIComponent(confirmationOrderId)}&paid=1`, url.origin)
      );
    }

    return NextResponse.redirect(
      new URL(`/checkout/confirmation/${confirmationOrderId}?mode=axepta-live`, url.origin)
    );
  } catch (error) {
    console.error('axepta return handler failed', error);
    if (source === 'balance' && orderId) {
      return NextResponse.redirect(
        balanceRetryUrl(url.origin, orderId, {
          failed: '1',
          error: 'axepta-verify-failed',
          transId: transId || ''
        })
      );
    }
    const failed = new URL('/checkout/paiement', url.origin);
    failed.searchParams.set('failed', '1');
    if (orderId) failed.searchParams.set('orderId', orderId);
    if (transId) failed.searchParams.set('transId', transId);
    failed.searchParams.set('error', 'axepta-verify-failed');
    return NextResponse.redirect(failed);
  }
}
