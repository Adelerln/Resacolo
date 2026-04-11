import { NextResponse } from 'next/server';
import { getServerSupabaseClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const supabase = getServerSupabaseClient();

  const [{ data: order, error: orderError }, { data: payments }, { data: orderItems }] = await Promise.all([
    supabase
      .from('orders')
      .select('id,status,paid_at')
      .eq('id', params.id)
      .maybeSingle(),
    supabase
      .from('payments')
      .select('id,status,amount_cents,currency,updated_at')
      .eq('order_id', params.id)
      .order('updated_at', { ascending: false })
      .limit(1),
    supabase
      .from('order_items')
      .select('total_price_cents')
      .eq('order_id', params.id)
  ]);

  if (orderError || !order) {
    return NextResponse.json({ error: 'Commande introuvable.' }, { status: 404 });
  }

  const payment = payments?.[0] ?? null;
  const totalCents = payment?.amount_cents ?? (orderItems ?? []).reduce((sum, item) => sum + item.total_price_cents, 0);

  return NextResponse.json({
    orderId: order.id,
    status: order.status,
    paidAt: order.paid_at,
    paymentStatus: payment?.status ?? null,
    totalCents,
    currency: payment?.currency ?? 'EUR'
  });
}
