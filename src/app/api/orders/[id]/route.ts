import { NextResponse } from 'next/server';
import { getServerSupabaseClient } from '@/lib/supabase/server';
import { isMissingColumnError } from '@/lib/supabase-schema-errors';

export const runtime = 'nodejs';

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: orderId } = await params;
  const supabase = getServerSupabaseClient();

  const [paymentsResult, orderItemsResult] = await Promise.all([
    supabase
      .from('payments')
      .select('id,status,amount_cents,currency,updated_at')
      .eq('order_id', orderId)
      .order('updated_at', { ascending: false })
      .limit(1),
    supabase
      .from('order_items')
      .select('total_price_cents,session_id')
      .eq('order_id', orderId)
  ]);

  let { data: order, error: orderError } = await supabase
    .from('orders')
    .select('id,status,paid_at,partially_paid_at')
    .eq('id', orderId)
    .maybeSingle();

  if (orderError && isMissingColumnError(orderError, 'partially_paid_at')) {
    const legacyOrderResult = await supabase
      .from('orders')
      .select('id,status,paid_at')
      .eq('id', orderId)
      .maybeSingle();

    order = legacyOrderResult.data
      ? {
          ...legacyOrderResult.data,
          partially_paid_at: null
        }
      : null;
    orderError = legacyOrderResult.error;
  }

  if (orderError || !order) {
    return NextResponse.json({ error: 'Commande introuvable.' }, { status: 404 });
  }

  const payment = paymentsResult.data?.[0] ?? null;
  const totalCents =
    (orderItemsResult.data ?? []).reduce((sum, item) => sum + item.total_price_cents, 0) || payment?.amount_cents || 0;
  const firstOrderItem = (orderItemsResult.data ?? [])[0] ?? null;

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
    status: order.status,
    paidAt: order.paid_at ?? order.partially_paid_at,
    paymentStatus: payment?.status ?? null,
    totalCents,
    currency: payment?.currency ?? 'EUR',
    organizerContactEmail,
    organizerName
  });
}
