import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';

type ResacoloBillingSettingsRow = Database['public']['Tables']['resacolo_billing_settings']['Row'];
type OrganizerBillingSettingsInsert = Database['public']['Tables']['organizer_billing_settings']['Insert'];
type OrganizerCommissionHistoryInsert = Database['public']['Tables']['organizer_commission_history']['Insert'];
type OrganizerCommissionHistoryRow = Database['public']['Tables']['organizer_commission_history']['Row'];

type OrganizerRateCarrier = {
  id: string;
  is_founding_member?: boolean | null;
  is_resacolo_member?: boolean | null;
};

type OrganizerCommissionStatusCode = 'FOUNDING_MEMBER' | 'RESACOLO_MEMBER' | 'EXTERNAL';

const SETTINGS_ID = 'default';

export const DEFAULT_RESACOLO_BILLING_SETTINGS: ResacoloBillingSettingsRow = {
  id: SETTINGS_ID,
  founding_member_commission_percent: 0,
  resacolo_member_commission_percent: 0,
  external_commission_percent: 0,
  publication_fee_enabled: false,
  publication_fee_cents: 0,
  created_at: '',
  updated_at: ''
};

function isTableUnavailable(error: { message?: string; code?: string } | null, tableName: string): boolean {
  if (!error?.message) return false;
  const message = error.message.toLowerCase();
  return (
    (message.includes(tableName.toLowerCase()) &&
      (message.includes('schema cache') || message.includes('could not find the table'))) ||
    error.code === 'PGRST205'
  );
}

export function resolveOrganizerCommissionPercent(
  organizer: Pick<OrganizerRateCarrier, 'is_founding_member' | 'is_resacolo_member'>,
  settings: Pick<
    ResacoloBillingSettingsRow,
    | 'founding_member_commission_percent'
    | 'resacolo_member_commission_percent'
    | 'external_commission_percent'
  >
): number {
  if (organizer.is_founding_member) {
    return Number(settings.founding_member_commission_percent) || 0;
  }
  if (organizer.is_resacolo_member) {
    return Number(settings.resacolo_member_commission_percent) || 0;
  }
  return Number(settings.external_commission_percent) || 0;
}

export function resolveOrganizerCommissionStatusCode(
  organizer: Pick<OrganizerRateCarrier, 'is_founding_member' | 'is_resacolo_member'>
): OrganizerCommissionStatusCode {
  if (organizer.is_founding_member) return 'FOUNDING_MEMBER';
  if (organizer.is_resacolo_member) return 'RESACOLO_MEMBER';
  return 'EXTERNAL';
}

export async function readResacoloBillingSettings(
  supabase: SupabaseClient<Database>
): Promise<ResacoloBillingSettingsRow> {
  const { data, error } = await supabase
    .from('resacolo_billing_settings')
    .select('*')
    .eq('id', SETTINGS_ID)
    .maybeSingle();

  if (error) {
    if (isTableUnavailable(error, 'resacolo_billing_settings')) {
      return DEFAULT_RESACOLO_BILLING_SETTINGS;
    }
    throw new Error(error.message);
  }

  return data ?? DEFAULT_RESACOLO_BILLING_SETTINGS;
}

function nextIsoAfter(iso: string): string {
  return new Date(new Date(iso).getTime() + 1).toISOString();
}

export async function syncOrganizerBillingSettings(
  supabase: SupabaseClient<Database>,
  organizers: OrganizerRateCarrier[],
  settings: ResacoloBillingSettingsRow,
  options?: {
    source?: string;
    effectiveAtIso?: string;
  }
): Promise<void> {
  if (organizers.length === 0) return;

  const organizerIds = organizers.map((organizer) => organizer.id);
  const { data: existingRows, error: existingError } = await supabase
    .from('organizer_billing_settings')
    .select('organizer_id, notes')
    .in('organizer_id', organizerIds);

  if (existingError) {
    throw new Error(existingError.message);
  }

  const existingNotesByOrganizerId = new Map(
    (existingRows ?? []).map((row) => [row.organizer_id, row.notes ?? null] as const)
  );
  const now = options?.effectiveAtIso ?? new Date().toISOString();
  const publicationFeeCents = settings.publication_fee_enabled ? Number(settings.publication_fee_cents) || 0 : 0;

  const payload: OrganizerBillingSettingsInsert[] = organizers.map((organizer) => ({
    organizer_id: organizer.id,
    commission_percent: resolveOrganizerCommissionPercent(organizer, settings),
    publication_fee_cents: publicationFeeCents,
    notes: existingNotesByOrganizerId.get(organizer.id) ?? null,
    updated_at: now
  }));

  const { error } = await supabase.from('organizer_billing_settings').upsert(payload, {
    onConflict: 'organizer_id'
  });

  if (error) {
    throw new Error(error.message);
  }

  await syncOrganizerCommissionHistory(supabase, organizers, settings, {
    source: options?.source ?? 'SYNC',
    effectiveAtIso: now
  });
}

export async function syncOrganizerBillingSettingsForOrganizer(
  supabase: SupabaseClient<Database>,
  organizer: OrganizerRateCarrier,
  options?: {
    source?: string;
    effectiveAtIso?: string;
  }
): Promise<void> {
  const settings = await readResacoloBillingSettings(supabase);
  await syncOrganizerBillingSettings(supabase, [organizer], settings, options);
}

async function syncOrganizerCommissionHistory(
  supabase: SupabaseClient<Database>,
  organizers: OrganizerRateCarrier[],
  settings: ResacoloBillingSettingsRow,
  options: {
    source: string;
    effectiveAtIso: string;
  }
): Promise<void> {
  const organizerIds = organizers.map((organizer) => organizer.id);
  const { data: openRows, error } = await supabase
    .from('organizer_commission_history')
    .select('id, organizer_id, commission_percent, status_code, effective_from, effective_to')
    .in('organizer_id', organizerIds)
    .is('effective_to', null);

  if (error && !isTableUnavailable(error, 'organizer_commission_history')) {
    throw new Error(error.message);
  }

  const openRowByOrganizerId = new Map(
    ((openRows ?? []) as OrganizerCommissionHistoryRow[]).map((row) => [row.organizer_id, row] as const)
  );

  const rowsToClose: string[] = [];
  const rowsToInsert: OrganizerCommissionHistoryInsert[] = [];
  const closeAtByRowId = new Map<string, string>();

  for (const organizer of organizers) {
    const statusCode = resolveOrganizerCommissionStatusCode(organizer);
    const commissionPercent = resolveOrganizerCommissionPercent(organizer, settings);
    const current = openRowByOrganizerId.get(organizer.id);

    if (
      current &&
      Number(current.commission_percent) === commissionPercent &&
      current.status_code === statusCode
    ) {
      continue;
    }

    if (current) {
      rowsToClose.push(current.id);
      const effectiveAtIso =
        current.effective_from >= options.effectiveAtIso ? nextIsoAfter(current.effective_from) : options.effectiveAtIso;
      closeAtByRowId.set(current.id, effectiveAtIso);
      rowsToInsert.push({
        organizer_id: organizer.id,
        source: options.source,
        status_code: statusCode,
        commission_percent: commissionPercent,
        effective_from: effectiveAtIso,
        effective_to: null
      });
      continue;
    }

    rowsToInsert.push({
      organizer_id: organizer.id,
      source: options.source,
      status_code: statusCode,
      commission_percent: commissionPercent,
      effective_from: options.effectiveAtIso,
      effective_to: null
    });
  }

  for (const rowId of rowsToClose) {
    const { error: closeError } = await supabase
      .from('organizer_commission_history')
      .update({ effective_to: closeAtByRowId.get(rowId) ?? options.effectiveAtIso })
      .eq('id', rowId)
      .is('effective_to', null);
    if (closeError) {
      throw new Error(closeError.message);
    }
  }

  if (rowsToInsert.length > 0) {
    const { error: insertError } = await supabase.from('organizer_commission_history').insert(rowsToInsert);
    if (insertError) {
      throw new Error(insertError.message);
    }
  }
}

/** Taux effectif pour le journal à la date d'effet : historique, sinon repli sur organizer_billing_settings. */
export async function resolveOrganizerCommissionRatesForLedger(
  supabase: SupabaseClient<Database>,
  organizerIds: string[],
  effectiveAtIso: string
): Promise<Map<string, number>> {
  if (organizerIds.length === 0) return new Map();

  const { data: historyRows, error: historyError } = await supabase
    .from('organizer_commission_history')
    .select('organizer_id, commission_percent, effective_from, effective_to')
    .in('organizer_id', organizerIds)
    .lte('effective_from', effectiveAtIso)
    .order('effective_from', { ascending: false });

  if (historyError && !isTableUnavailable(historyError, 'organizer_commission_history')) {
    throw new Error(historyError.message);
  }

  const { data: legacyBillings } = await supabase
    .from('organizer_billing_settings')
    .select('organizer_id, commission_percent')
    .in('organizer_id', organizerIds);

  const historyByOrganizerId = new Map<string, OrganizerCommissionHistoryRow[]>();
  for (const row of (historyRows ?? []) as OrganizerCommissionHistoryRow[]) {
    const list = historyByOrganizerId.get(row.organizer_id) ?? [];
    list.push(row);
    historyByOrganizerId.set(row.organizer_id, list);
  }

  const legacyRateByOrganizerId = new Map(
    (legacyBillings ?? []).map((row) => [row.organizer_id, Number(row.commission_percent) || 0] as const)
  );

  return new Map(
    organizerIds.map((organizerId) => {
      const matchingHistoryRow = (historyByOrganizerId.get(organizerId) ?? []).find((row) => {
        if (!row.effective_to) return true;
        return row.effective_to > effectiveAtIso;
      });
      const historicRate = matchingHistoryRow ? Number(matchingHistoryRow.commission_percent) || 0 : null;
      const legacyRate = legacyRateByOrganizerId.get(organizerId) ?? 0;
      return [organizerId, historicRate ?? legacyRate] as const;
    })
  );
}
