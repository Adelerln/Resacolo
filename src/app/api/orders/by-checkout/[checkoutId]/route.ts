import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { CHECKOUT_CLIENT_COOKIE_NAME } from '@/lib/checkout/clientIdentity';
import { getSession } from '@/lib/auth/session';
import { getServerSupabaseClient } from '@/lib/supabase/server';
import { isMissingAnyColumnError } from '@/lib/supabase-schema-errors';
import { computeOrderClientBalance } from '@/lib/order-balance-payment';
import { inferOrderRequestKind, resolveFamilyPaymentModeLabel } from '@/lib/order-workflow';

export const runtime = 'nodejs';

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

async function resolveOrderOwnerUserId() {
  const session = await getSession();
  if (session?.isClient && session.userId) {
    return session.userId;
  }

  const store = await cookies();
  const guestId = store.get(CHECKOUT_CLIENT_COOKIE_NAME)?.value?.trim();
  if (guestId && isUuid(guestId)) {
    return guestId;
  }

  return null;
}

export async function GET(_: Request, { params }: { params: Promise<{ checkoutId: string }> }) {
  const { checkoutId } = await params;
  const ownerUserId = await resolveOrderOwnerUserId();
  const supabase = getServerSupabaseClient();

  let paymentsQuery = supabase
    .from('payments')
    .select('order_id,status,amount_cents,currency,updated_at,raw_payload,orders!inner(id,status,paid_at,partially_paid_at,client_user_id,request_kind)')
    .filter('raw_payload->>checkoutId', 'eq', checkoutId)
    .order('updated_at', { ascending: false });

  if (ownerUserId) {
    paymentsQuery = paymentsQuery.eq('orders.client_user_id', ownerUserId);
  }

  let { data: payments, error } = await paymentsQuery;

  if (error && isMissingAnyColumnError(error, ['partially_paid_at', 'request_kind'])) {
    let legacyQuery = supabase
      .from('payments')
      .select('order_id,status,amount_cents,currency,updated_at,raw_payload,orders!inner(id,status,paid_at,client_user_id)')
      .filter('raw_payload->>checkoutId', 'eq', checkoutId)
      .order('updated_at', { ascending: false });
    if (ownerUserId) {
      legacyQuery = legacyQuery.eq('orders.client_user_id', ownerUserId);
    }
    const legacyResult = await legacyQuery;
    payments = (legacyResult.data ?? []).map((payment) => ({
      ...payment,
      orders: {
        ...payment.orders,
        partially_paid_at: null,
        request_kind: null
      }
    }));
    error = legacyResult.error;
  }

  if (error) {
    console.error('orders/by-checkout: lecture paiements échouée', { checkoutId, ownerUserId, error });
    return NextResponse.json({ error: 'Impossible de charger les commandes du checkout.' }, { status: 500 });
  }

  type PaymentRow = NonNullable<typeof payments>[number];
  const latestPaymentsByOrderId = new Map<string, PaymentRow>();
  for (const payment of payments ?? []) {
    if (payment.order_id && !latestPaymentsByOrderId.has(payment.order_id)) {
      latestPaymentsByOrderId.set(payment.order_id, payment);
    }
  }

  const orderIds = Array.from(latestPaymentsByOrderId.keys());
  if (orderIds.length === 0) {
    return NextResponse.json({ orders: [] });
  }

  const { data: orderItems } = await supabase
    .from('order_items')
    .select('order_id,total_price_cents')
    .in('order_id', orderIds);

  const totalByOrderId = new Map<string, number>();
  for (const item of orderItems ?? []) {
    totalByOrderId.set(item.order_id, (totalByOrderId.get(item.order_id) ?? 0) + (item.total_price_cents ?? 0));
  }

  return NextResponse.json({
    orders: await Promise.all(
      Array.from(latestPaymentsByOrderId.values()).map(async (payment) => {
      const rawPayload =
        payment.raw_payload && typeof payment.raw_payload === 'object' && !Array.isArray(payment.raw_payload)
          ? (payment.raw_payload as Record<string, unknown>)
          : {};
      let remainingBalanceCents = 0;
      try {
        const balance = await computeOrderClientBalance(payment.orders.id);
        remainingBalanceCents = balance.remainingBalanceCents;
      } catch {
        remainingBalanceCents = 0;
      }
      return {
        orderId: payment.orders.id,
        status: payment.orders.status,
        paidAt: payment.orders.paid_at ?? payment.orders.partially_paid_at ?? null,
        paymentStatus: payment.status ?? null,
        requestKind: inferOrderRequestKind({
          requestKind: payment.orders.request_kind,
          paymentRawPayload: rawPayload
        }),
        paymentModeLabel: resolveFamilyPaymentModeLabel(rawPayload),
        remainingBalanceCents,
        totalCents: totalByOrderId.get(payment.orders.id) ?? payment.amount_cents ?? 0,
        currency: payment.currency ?? 'EUR',
        organizerName: typeof rawPayload.organizerName === 'string' ? rawPayload.organizerName : null
      };
    })
    )
  });
}
