import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { formatOrderReservationCode } from '@/lib/order-workflow';
import type { Database } from '@/types/supabase';

export type LedgerLinePreview = {
  id: string;
  occurred_at: string;
  fee_kind: string;
  channel: string;
  amount_cents: number;
  note: string | null;
  stay_id: string | null;
  order_id: string | null;
  order_item_id: string | null;
  /** Libellé affiché sur la facture PDF (client + commande, ou séjour). */
  prestationLabel?: string | null;
};

export function formatLedgerPrestationLabel(input: {
  feeKind: string;
  clientName: string | null;
  orderRef: string | null;
  stayTitle: string | null;
}): string {
  if (input.clientName && input.orderRef) {
    return `${input.clientName} · Commande ${input.orderRef}`;
  }
  if (input.stayTitle && input.feeKind === 'PUBLICATION') {
    return `Publication — ${input.stayTitle}`;
  }
  if (input.stayTitle) {
    return input.stayTitle;
  }
  if (input.orderRef) {
    return `Prestation · Commande ${input.orderRef}`;
  }
  return 'Prestation Resacolo';
}

export async function loadLedgerPublicationLines(
  supabase: SupabaseClient<Database>,
  organizerId: string,
  startIso: string,
  endIso: string
): Promise<{ lines: LedgerLinePreview[]; error?: string }> {
  const { data, error } = await supabase
    .from('resacolo_fee_ledger')
    .select('id, occurred_at, fee_kind, channel, amount_cents, note, stay_id, order_id, order_item_id')
    .eq('organizer_id', organizerId)
    .eq('fee_kind', 'PUBLICATION')
    .gte('occurred_at', startIso)
    .lt('occurred_at', endIso)
    .order('occurred_at', { ascending: true });

  if (error) {
    return { lines: [], error: error.message };
  }
  return { lines: (data ?? []) as LedgerLinePreview[] };
}

export async function loadLedgerCommissionLines(
  supabase: SupabaseClient<Database>,
  organizerId: string,
  startIso: string,
  endIso: string
): Promise<{ lines: LedgerLinePreview[]; error?: string }> {
  const { data, error } = await supabase
    .from('resacolo_fee_ledger')
    .select('id, occurred_at, fee_kind, channel, amount_cents, note, stay_id, order_id, order_item_id')
    .eq('organizer_id', organizerId)
    .eq('fee_kind', 'COMMISSION')
    .gte('occurred_at', startIso)
    .lt('occurred_at', endIso)
    .order('occurred_at', { ascending: true });

  if (error) {
    return { lines: [], error: error.message };
  }
  return { lines: (data ?? []) as LedgerLinePreview[] };
}

export function sumCents(lines: LedgerLinePreview[]): number {
  return lines.reduce((s, l) => s + l.amount_cents, 0);
}

export async function enrichLedgerLinesForInvoice(
  supabase: SupabaseClient<Database>,
  lines: LedgerLinePreview[]
): Promise<LedgerLinePreview[]> {
  if (lines.length === 0) return lines;

  const orderIdsFromLines = new Set(
    lines.map((line) => line.order_id).filter((value): value is string => Boolean(value))
  );
  const orderItemIds = lines
    .map((line) => line.order_item_id)
    .filter((value): value is string => Boolean(value));
  const stayIds = lines.map((line) => line.stay_id).filter((value): value is string => Boolean(value));

  const orderIdByOrderItemId = new Map<string, string>();
  if (orderItemIds.length > 0) {
    const { data: orderItems } = await supabase
      .from('order_items')
      .select('id, order_id')
      .in('id', orderItemIds);
    for (const item of orderItems ?? []) {
      if (item.order_id) {
        orderIdByOrderItemId.set(item.id, item.order_id);
        orderIdsFromLines.add(item.order_id);
      }
    }
  }

  const orderIds = Array.from(orderIdsFromLines);
  const clientNameByOrderId = new Map<string, string>();

  if (orderIds.length > 0) {
    const { data: orders } = await supabase
      .from('orders')
      .select('id, client_user_id, collectivity_id')
      .in('id', orderIds);

    const clientUserIds = Array.from(
      new Set((orders ?? []).map((order) => order.client_user_id).filter(Boolean))
    );
    const collectivityIds = Array.from(
      new Set(
        (orders ?? [])
          .map((order) => order.collectivity_id)
          .filter((value): value is string => Boolean(value))
      )
    );

    const [{ data: clients }, { data: collectivities }] = await Promise.all([
      clientUserIds.length
        ? supabase.from('clients').select('user_id, full_name').in('user_id', clientUserIds)
        : Promise.resolve({ data: [] as { user_id: string; full_name: string | null }[] }),
      collectivityIds.length
        ? supabase.from('collectivities').select('id, name').in('id', collectivityIds)
        : Promise.resolve({ data: [] as { id: string; name: string | null }[] })
    ]);

    const clientNameByUserId = new Map(
      (clients ?? [])
        .map((client) => [client.user_id, client.full_name?.trim() || null] as const)
        .filter((entry): entry is readonly [string, string] => Boolean(entry[1]))
    );
    const collectivityNameById = new Map(
      (collectivities ?? [])
        .map((collectivity) => [collectivity.id, collectivity.name?.trim() || null] as const)
        .filter((entry): entry is readonly [string, string] => Boolean(entry[1]))
    );

    for (const order of orders ?? []) {
      const clientName =
        clientNameByUserId.get(order.client_user_id) ??
        (order.collectivity_id ? collectivityNameById.get(order.collectivity_id) ?? null : null);
      if (clientName) {
        clientNameByOrderId.set(order.id, clientName);
      }
    }
  }

  const stayTitleById = new Map<string, string>();
  if (stayIds.length > 0) {
    const { data: stays } = await supabase.from('stays').select('id, title').in('id', stayIds);
    for (const stay of stays ?? []) {
      const title = stay.title?.trim();
      if (title) stayTitleById.set(stay.id, title);
    }
  }

  return lines.map((line) => {
    const orderId =
      line.order_id ?? (line.order_item_id ? orderIdByOrderItemId.get(line.order_item_id) ?? null : null);
    const prestationLabel = formatLedgerPrestationLabel({
      feeKind: line.fee_kind,
      clientName: orderId ? clientNameByOrderId.get(orderId) ?? null : null,
      orderRef: orderId ? formatOrderReservationCode(orderId) : null,
      stayTitle: line.stay_id ? stayTitleById.get(line.stay_id) ?? null : null
    });

    return {
      ...line,
      order_id: orderId,
      prestationLabel
    };
  });
}
