import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { periodStartIso } from '@/lib/mnemos/period-bounds';
import type { Database } from '@/types/supabase';
import {
  parseInvoicedBillingPeriod,
  validateMnemosBillingPeriod,
  type BillingPeriodValidation,
  type InvoicedBillingPeriod
} from '@/lib/mnemos/billing-period-guard';

export type MnemosBillingEventType = 'INVOICE_PUBLICATION_PERIOD' | 'INVOICE_COMMISSION_PERIOD';

export type { BillingPeriodValidation, InvoicedBillingPeriod };

export {
  billingPeriodsOverlap,
  computeNextBillingStartDate,
  formatBillingStartDateFr,
  validateMnemosBillingPeriod
} from '@/lib/mnemos/billing-period-guard';

export async function loadInvoicedBillingPeriods(
  supabase: SupabaseClient<Database>,
  organizerId: string,
  eventType: MnemosBillingEventType
): Promise<InvoicedBillingPeriod[]> {
  const { data, error } = await supabase
    .from('organizer_billing_events')
    .select('metadata, invoice_id')
    .eq('organizer_id', organizerId)
    .eq('event_type', eventType)
    .not('invoice_id', 'is', null);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? [])
    .map((row) => parseInvoicedBillingPeriod(row.metadata))
    .filter((period): period is InvoicedBillingPeriod => period !== null)
    .sort((left, right) => left.startIso.localeCompare(right.startIso));
}

export async function assertMnemosBillingPeriodAllowed(
  supabase: SupabaseClient<Database>,
  input: {
    organizerId: string;
    eventType: MnemosBillingEventType;
    startIso: string;
    endExclusiveIso: string;
  }
): Promise<BillingPeriodValidation> {
  const invoicedPeriods = await loadInvoicedBillingPeriods(supabase, input.organizerId, input.eventType);
  return validateMnemosBillingPeriod(
    invoicedPeriods,
    input.startIso,
    input.endExclusiveIso,
    periodStartIso
  );
}
