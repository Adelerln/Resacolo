import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';

export async function allocateInvoiceNumber(
  supabase: SupabaseClient<Database>,
  year: number
): Promise<number> {
  const { data, error } = await supabase.rpc('next_invoice_number', { p_year: year });
  if (!error && data != null && typeof data === 'number') {
    return data;
  }
  const { data: last } = await supabase
    .from('invoices')
    .select('number')
    .eq('year', year)
    .order('number', { ascending: false })
    .limit(1)
    .maybeSingle();
  return (last?.number ?? 0) + 1;
}
