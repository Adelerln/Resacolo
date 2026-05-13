import { NextResponse } from 'next/server';
import { getServerSupabaseClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: orderId } = await params;
  const supabase = getServerSupabaseClient();

  const [{ data: order, error: orderError }, { data: payments }, { data: orderItems }] = await Promise.all([
    supabase
      .from('orders')
      .select('id,status,paid_at')
      .eq('id', orderId)
      .maybeSingle(),
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

  if (orderError || !order) {
    return NextResponse.json({ error: 'Commande introuvable.' }, { status: 404 });
  }

  const payment = payments?.[0] ?? null;
  const totalCents = payment?.amount_cents ?? (orderItems ?? []).reduce((sum, item) => sum + item.total_price_cents, 0);
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
    status: order.status,
    paidAt: order.paid_at,
    paymentStatus: payment?.status ?? null,
    totalCents,
    currency: payment?.currency ?? 'EUR',
    organizerContactEmail,
    organizerName
  });
}
