import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';

const ACTIVE_ORDER_STATUSES = new Set(['REQUESTED', 'VALIDATED', 'BOOKED', 'PAID', 'CONFIRMED']);

export async function getReservedSessionCounts(
  supabase: SupabaseClient<Database>,
  sessionIds: string[]
) {
  const counts = new Map<string, number>();

  if (sessionIds.length === 0) {
    return counts;
  }

  const { data: orderItems } = await supabase
    .from('order_items')
    .select('session_id,order_id')
    .in('session_id', sessionIds);

  const safeOrderItems = orderItems ?? [];
  const orderIds = Array.from(new Set(safeOrderItems.map((item) => item.order_id)));

  if (orderIds.length === 0) {
    return counts;
  }

  const { data: orders } = await supabase
    .from('orders')
    .select('id,status')
    .in('id', orderIds);

  const activeOrderIds = new Set(
    (orders ?? [])
      .filter((order) => ACTIVE_ORDER_STATUSES.has(order.status))
      .map((order) => order.id)
  );

  for (const item of safeOrderItems) {
    if (!activeOrderIds.has(item.order_id)) continue;
    counts.set(item.session_id, (counts.get(item.session_id) ?? 0) + 1);
  }

  return counts;
}
