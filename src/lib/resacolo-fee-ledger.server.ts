import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';

type LedgerInsert = Database['public']['Tables']['resacolo_fee_ledger']['Insert'];

/** Commission ResaColo au moment du paiement (une ligne par order_item, idempotent). */
export async function recordCommissionFeesOnOrderPaid(
  supabase: SupabaseClient<Database>,
  orderId: string,
  paidAtIso: string
): Promise<void> {
  const { data: order } = await supabase.from('orders').select('collectivity_id').eq('id', orderId).maybeSingle();
  if (!order) return;

  const channel: LedgerInsert['channel'] = order.collectivity_id ? 'PARTNER' : 'CLIENT';

  const { data: items } = await supabase
    .from('order_items')
    .select('id, organizer_id, total_price_cents')
    .eq('order_id', orderId);
  if (!items?.length) return;

  const { data: existingRows } = await supabase
    .from('resacolo_fee_ledger')
    .select('order_item_id')
    .eq('order_id', orderId)
    .eq('fee_kind', 'COMMISSION')
    .gt('amount_cents', 0);
  const already = new Set((existingRows ?? []).map((r) => r.order_item_id).filter(Boolean) as string[]);

  const orgIds = Array.from(new Set(items.map((i) => i.organizer_id)));
  const { data: billings } = await supabase
    .from('organizer_billing_settings')
    .select('organizer_id, commission_percent')
    .in('organizer_id', orgIds);
  const rateByOrg = new Map((billings ?? []).map((b) => [b.organizer_id, Number(b.commission_percent) || 0]));

  const inserts: LedgerInsert[] = [];
  for (const item of items) {
    if (already.has(item.id)) continue;
    const rate = rateByOrg.get(item.organizer_id) ?? 0;
    const amount = Math.round(item.total_price_cents * (rate / 100));
    if (amount <= 0) continue;
    inserts.push({
      occurred_at: paidAtIso,
      organizer_id: item.organizer_id,
      fee_kind: 'COMMISSION',
      channel,
      amount_cents: amount,
      order_id: orderId,
      order_item_id: item.id,
      stay_id: null,
      note: null
    });
  }

  if (inserts.length > 0) {
    const { error: insertError } = await supabase.from('resacolo_fee_ledger').insert(inserts);
    if (insertError) {
      console.error('resacolo_fee_ledger: échec insertion commissions', insertError.message);
    }
  }
}

/** Forfait publication lors du premier passage au statut Publié (idempotent par séjour). */
export async function maybeRecordPublicationFeeWhenStayPublished(
  supabase: SupabaseClient<Database>,
  params: {
    stayId: string;
    organizerId: string;
    previousStatus: string | null | undefined;
    newStatus: string;
    occurredAt: string;
  }
): Promise<void> {
  if (params.newStatus !== 'PUBLISHED') return;
  if (params.previousStatus === 'PUBLISHED') return;

  const { data: existing } = await supabase
    .from('resacolo_fee_ledger')
    .select('id')
    .eq('stay_id', params.stayId)
    .eq('fee_kind', 'PUBLICATION')
    .gt('amount_cents', 0)
    .maybeSingle();
  if (existing) return;

  const { data: billing } = await supabase
    .from('organizer_billing_settings')
    .select('publication_fee_cents')
    .eq('organizer_id', params.organizerId)
    .maybeSingle();
  const cents = Number(billing?.publication_fee_cents ?? 0);
  if (cents <= 0) return;

  const { error: insertError } = await supabase.from('resacolo_fee_ledger').insert({
    occurred_at: params.occurredAt,
    organizer_id: params.organizerId,
    fee_kind: 'PUBLICATION',
    channel: 'NA',
    amount_cents: cents,
    order_id: null,
    order_item_id: null,
    stay_id: params.stayId,
    note: null
  });
  if (insertError) {
    console.error('resacolo_fee_ledger: échec insertion publication', insertError.message);
  }
}
