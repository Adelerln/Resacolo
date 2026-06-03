import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { CHECKOUT_CLIENT_COOKIE_NAME } from '@/lib/checkout/clientIdentity';
import { getSession } from '@/lib/auth/session';
import { getServerSupabaseClient } from '@/lib/supabase/server';
import { isMissingAnyColumnError } from '@/lib/supabase-schema-errors';
import { computeOrderClientBalance } from '@/lib/order-balance-payment';
import { inferOrderRequestKind, reconcileOrderStatusWithBalance, resolveFamilyPaymentModeLabel } from '@/lib/order-workflow';

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

async function readOrderRow(orderId: string, ownerUserId: string | null) {
  const supabase = getServerSupabaseClient();

  let query = supabase
    .from('orders')
    .select('id,status,paid_at,partially_paid_at,client_user_id,request_kind')
    .eq('id', orderId);

  if (ownerUserId) {
    query = query.eq('client_user_id', ownerUserId);
  }

  let { data: order, error: orderError } = await query.maybeSingle();

  if (orderError && isMissingAnyColumnError(orderError, ['partially_paid_at', 'request_kind'])) {
    let legacyQuery = supabase
      .from('orders')
      .select('id,status,paid_at,client_user_id')
      .eq('id', orderId);
    if (ownerUserId) {
      legacyQuery = legacyQuery.eq('client_user_id', ownerUserId);
    }
    const legacyResult = await legacyQuery.maybeSingle();
    order = legacyResult.data
      ? { ...legacyResult.data, partially_paid_at: null, request_kind: null }
      : null;
    orderError = legacyResult.error;
  }

  return { order, orderError };
}

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: orderId } = await params;
  if (!orderId || !isUuid(orderId)) {
    return NextResponse.json({ error: 'Identifiant de commande invalide.' }, { status: 400 });
  }

  const ownerUserId = await resolveOrderOwnerUserId();
  const { order, orderError } = await readOrderRow(orderId, ownerUserId);

  if (orderError) {
    console.error('orders/[id]: lecture commande échouée', orderError);
    return NextResponse.json({ error: 'Impossible de charger la commande.' }, { status: 500 });
  }

  if (!order) {
    return NextResponse.json({ error: 'Commande introuvable.' }, { status: 404 });
  }

  const supabase = getServerSupabaseClient();
  const [{ data: payments }, { data: orderItems }] = await Promise.all([
    supabase
      .from('payments')
      .select('id,status,amount_cents,currency,updated_at,raw_payload')
      .eq('order_id', orderId)
      .order('updated_at', { ascending: false }),
    supabase.from('order_items').select('total_price_cents,session_id').eq('order_id', orderId)
  ]);

  const payment = payments?.[0] ?? null;
  const paymentRawPayload =
    payment?.raw_payload && typeof payment.raw_payload === 'object' && !Array.isArray(payment.raw_payload)
      ? (payment.raw_payload as Record<string, unknown>)
      : null;
  const onlinePaidCents = (payments ?? [])
    .filter((entry) => entry.status === 'SUCCEEDED')
    .reduce((sum, entry) => sum + (entry.amount_cents ?? 0), 0);
  let remainingBalanceCents = 0;
  let effectiveStatus = order.status;
  try {
    const balance = await computeOrderClientBalance(orderId);
    remainingBalanceCents = balance.remainingBalanceCents;
    effectiveStatus = reconcileOrderStatusWithBalance({
      status: order.status,
      remainingBalanceCents,
      onlinePaidCents,
      externalPaidCents: balance.order.external_paid_cents ?? 0
    });
  } catch {
    // Fallback: keep raw DB status when balance cannot be computed.
  }
  const totalCents = (orderItems ?? []).reduce((sum, item) => sum + item.total_price_cents, 0) || payment?.amount_cents || 0;
  const firstOrderItem = (orderItems ?? [])[0] ?? null;

  let organizerContactEmail: string | null = null;
  let organizerName: string | null = null;
  if (firstOrderItem?.session_id) {
    const { data: sessionRow } = await supabase
      .from('sessions')
      .select('stay_id')
      .eq('id', firstOrderItem.session_id)
      .maybeSingle();

    if (sessionRow?.stay_id) {
      const { data: stayRow } = await supabase
        .from('stays')
        .select('organizer_id')
        .eq('id', sessionRow.stay_id)
        .maybeSingle();

      if (stayRow?.organizer_id) {
        const { data: organizerRow } = await supabase
          .from('organizers')
          .select('name,contact_email')
          .eq('id', stayRow.organizer_id)
          .maybeSingle();
        organizerContactEmail = organizerRow?.contact_email ?? null;
        organizerName = organizerRow?.name ?? null;
      }
    }
  }

  return NextResponse.json({
    orderId: order.id,
    status: effectiveStatus,
    remainingBalanceCents,
    paidAt: order.paid_at ?? order.partially_paid_at,
    paymentStatus: payment?.status ?? null,
    requestKind: inferOrderRequestKind({
      requestKind: order.request_kind ?? null,
      paymentRawPayload: paymentRawPayload
    }),
    paymentModeLabel: resolveFamilyPaymentModeLabel(paymentRawPayload),
    totalCents,
    currency: payment?.currency ?? 'EUR',
    organizerContactEmail,
    organizerName
  });
}
