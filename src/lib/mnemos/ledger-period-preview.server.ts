import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';

export type LedgerLinePreview = {
  id: string;
  occurred_at: string;
  fee_kind: string;
  channel: string;
  amount_cents: number;
  note: string | null;
  stay_id: string | null;
  order_item_id: string | null;
};

export async function loadLedgerPublicationLines(
  supabase: SupabaseClient<Database>,
  organizerId: string,
  startIso: string,
  endIso: string
): Promise<{ lines: LedgerLinePreview[]; error?: string }> {
  const { data, error } = await supabase
    .from('resacolo_fee_ledger')
    .select('id, occurred_at, fee_kind, channel, amount_cents, note, stay_id, order_item_id')
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
    .select('id, occurred_at, fee_kind, channel, amount_cents, note, stay_id, order_item_id')
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
