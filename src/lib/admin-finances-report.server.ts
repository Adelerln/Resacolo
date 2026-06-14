import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { readResacoloBillingSettings } from '@/lib/resacolo-billing-settings.server';
import { repairMissingCommissionFeesForPaidOrders } from '@/lib/resacolo-fee-ledger.server';
import type { Database } from '@/types/supabase';

export type FinancesGranularity = 'mois' | 'annee' | 'saison' | 'organisateur';

export type FinancesBreakdownRow = {
  key: string;
  label: string;
  orderVolumeCents: number;
  commissionClientCents: number;
  commissionPartnerCents: number;
  publicationFeeCents: number;
  publicationPositiveCount: number;
  commissionDetails: FinancesCommissionDetail[];
  partnerCommissionDetails: FinancesCommissionDetail[];
  publicationDetails: FinancesPublicationDetail[];
};

export type FinancesCommissionDetail = {
  key: string;
  organizerName: string;
  stayTitle: string;
  orderVolumeCents: number;
  commissionClientCents: number;
  lineCount: number;
};

export type FinancesPublicationDetail = {
  key: string;
  organizerName: string;
  publicationFeeCents: number;
  stayCount: number;
  stayTitles: string[];
};

function yearBoundsUtc(year: number) {
  const start = Date.UTC(year, 0, 1, 0, 0, 0, 0);
  const end = Date.UTC(year + 1, 0, 1, 0, 0, 0, 0);
  return { start, end, startIso: new Date(start).toISOString(), endIso: new Date(end).toISOString() };
}

function monthKeyFromMs(ms: number) {
  const d = new Date(ms);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function monthLabel(key: string) {
  const [y, m] = key.split('-');
  if (!y || !m) return key;
  return `${m}/${y}`;
}

type SeasonCarrier = {
  title?: string | null;
  seasons?: { name?: string | null } | { name?: string | null }[] | null;
} | null;

type LedgerReportRow = {
  occurred_at: string;
  organizer_id: string;
  fee_kind: string;
  channel: string;
  amount_cents: number;
  stay_id?: string | null;
  order_items?: {
    total_price_cents?: number;
    sessions?:
      | {
          stays?: SeasonCarrier;
        }
      | {
          stays?: SeasonCarrier;
        }[]
      | null;
  } | null;
  stays?: SeasonCarrier;
};

function seasonNameFromNested(row: {
  fee_kind: string;
  order_items?: {
    total_price_cents?: number;
    sessions?:
      | {
          stays?: SeasonCarrier;
        }
      | {
          stays?: SeasonCarrier;
        }[]
      | null;
  } | null;
  stays?: SeasonCarrier;
}): string | null {
  if (row.fee_kind === 'PUBLICATION') {
    const s = row.stays;
    if (!s) return null;
    const seasons = s.seasons;
    if (!seasons) return null;
    return Array.isArray(seasons) ? seasons[0]?.name ?? null : seasons.name ?? null;
  }
  const sessions = row.order_items?.sessions;
  const sess = Array.isArray(sessions) ? sessions[0] : sessions;
  const seasons = sess?.stays?.seasons;
  if (!seasons) return null;
  return Array.isArray(seasons) ? seasons[0]?.name ?? null : seasons.name ?? null;
}

function stayTitleFromNested(row: LedgerReportRow) {
  if (row.fee_kind === 'PUBLICATION') {
    return row.stays?.title?.trim() || 'Séjour sans titre';
  }

  const sessions = row.order_items?.sessions;
  const session = Array.isArray(sessions) ? sessions[0] : sessions;
  return session?.stays?.title?.trim() || 'Séjour sans titre';
}

type Agg = {
  orderVolumeCents: number;
  commissionClientCents: number;
  commissionPartnerCents: number;
  publicationFeeCents: number;
  publicationPositiveCount: number;
  commissionDetails: Map<string, FinancesCommissionDetail>;
  partnerCommissionDetails: Map<string, FinancesCommissionDetail>;
  publicationDetails: Map<string, FinancesPublicationDetail>;
};

const EMPTY_TOTALS = {
  orderVolumeCents: 0,
  commissionClientCents: 0,
  commissionPartnerCents: 0,
  publicationFeeCents: 0
};

/** PostgREST : table absente ou cache schéma pas encore à jour après création en SQL. */
function isLedgerTableUnavailable(error: { message?: string; code?: string } | null): boolean {
  if (!error?.message) return false;
  const msg = error.message.toLowerCase();
  if (!msg.includes('resacolo_fee_ledger')) return false;
  return (
    msg.includes('schema cache') ||
    msg.includes('could not find the table') ||
    error.code === 'PGRST205'
  );
}

export async function loadAdminFinancesReport(
  supabase: SupabaseClient<Database>,
  year: number,
  granularity: FinancesGranularity
): Promise<{
  rows: FinancesBreakdownRow[];
  totals: {
    orderVolumeCents: number;
    commissionClientCents: number;
    commissionPartnerCents: number;
    publicationFeeCents: number;
  };
  organizerNames: Record<string, string>;
  warnings: string[];
  ledgerTableMissing: boolean;
  publicationFeeEnabled: boolean;
}> {
  const { start, end, startIso, endIso } = yearBoundsUtc(year);
  await repairMissingCommissionFeesForPaidOrders(supabase, year);
  const settings = await readResacoloBillingSettings(supabase);
  const publicationFeeEnabled = settings.publication_fee_enabled;
  const warnings: string[] = [
    'Les montants proviennent du journal des frais : une ligne de commission est créée au paiement de la commande, avec le taux de commission en vigueur à ce moment-là pour l’organisateur concerné.',
    'Les réservations via un partenaire (CSE / collectivité) sont comptées dans « Commission partenaires », distinctes des familles directes.'
  ];
  if (publicationFeeEnabled) {
    warnings.push(
      'Un forfait publication est enregistré à la première mise en ligne d’une fiche séjour (passage au statut « Publié »). Les écritures négatives (annulation / abstention après validation admin) apparaîtront dans le même journal lorsque le flux correspondant sera branché.'
    );
  }

  const { data: ledgerRaw, error: ledgerError } = await supabase
    .from('resacolo_fee_ledger')
    .select(
      `
      occurred_at,
      organizer_id,
      fee_kind,
      channel,
      amount_cents,
      order_items (
        total_price_cents,
        sessions (
          stays (
            title,
            seasons ( name )
          )
        )
      ),
      stays (
        title,
        seasons ( name )
      )
    `
    )
    .gte('occurred_at', startIso)
    .lt('occurred_at', endIso);

  if (ledgerError && isLedgerTableUnavailable(ledgerError)) {
    return {
      rows: [],
      totals: { ...EMPTY_TOTALS },
      organizerNames: {},
      warnings: [],
      ledgerTableMissing: true,
      publicationFeeEnabled
    };
  }

  if (ledgerError) {
    console.warn('loadAdminFinancesReport: lecture journal', ledgerError.message);
  }

  const [{ data: organizers }] = await Promise.all([supabase.from('organizers').select('id, name')]);

  const organizerNames: Record<string, string> = {};
  for (const o of organizers ?? []) {
    organizerNames[o.id] = o.name;
  }

  const bucket = new Map<string, Agg>();

  function bump(key: string, patch: Partial<Agg>) {
    const cur = bucket.get(key) ?? {
      orderVolumeCents: 0,
      commissionClientCents: 0,
      commissionPartnerCents: 0,
      publicationFeeCents: 0,
      publicationPositiveCount: 0,
      commissionDetails: new Map<string, FinancesCommissionDetail>(),
      partnerCommissionDetails: new Map<string, FinancesCommissionDetail>(),
      publicationDetails: new Map<string, FinancesPublicationDetail>()
    };
    if (patch.orderVolumeCents != null) cur.orderVolumeCents += patch.orderVolumeCents;
    if (patch.commissionClientCents != null) cur.commissionClientCents += patch.commissionClientCents;
    if (patch.commissionPartnerCents != null) cur.commissionPartnerCents += patch.commissionPartnerCents;
    if (patch.publicationFeeCents != null) cur.publicationFeeCents += patch.publicationFeeCents;
    if (patch.publicationPositiveCount != null) cur.publicationPositiveCount += patch.publicationPositiveCount;
    bucket.set(key, cur);
  }

  function rowKey(occurredMs: number, organizerId: string, seasonName: string | null): string {
    switch (granularity) {
      case 'annee':
        return String(year);
      case 'mois':
        return monthKeyFromMs(occurredMs);
      case 'saison':
        return seasonName?.trim() || 'Sans saison';
      case 'organisateur':
        return organizerId;
      default:
        return monthKeyFromMs(occurredMs);
    }
  }

  for (const raw of ledgerRaw ?? []) {
    const row = raw as unknown as LedgerReportRow;
    const t = new Date(row.occurred_at).getTime();
    if (t < start || t >= end) continue;
    if (!publicationFeeEnabled && row.fee_kind === 'PUBLICATION') continue;

    const seasonName = seasonNameFromNested(row as Parameters<typeof seasonNameFromNested>[0]);
    const key = rowKey(t, row.organizer_id, seasonName);
    const organizerName = organizerNames[row.organizer_id] ?? row.organizer_id;
    const stayTitle = stayTitleFromNested(row);

    if (row.fee_kind === 'COMMISSION') {
      const lineTotal = row.order_items?.total_price_cents ?? 0;
      const clientPart = row.channel === 'CLIENT' ? row.amount_cents : 0;
      const partnerPart = row.channel === 'PARTNER' ? row.amount_cents : 0;
      bump(key, {
        orderVolumeCents: lineTotal,
        commissionClientCents: clientPart,
        commissionPartnerCents: partnerPart
      });
      if (clientPart > 0 || partnerPart > 0) {
        const current = bucket.get(key);
        const detailKey = `${row.organizer_id}:${stayTitle}`;

        if (clientPart > 0) {
          const detail = current?.commissionDetails.get(detailKey) ?? {
            key: detailKey,
            organizerName,
            stayTitle,
            orderVolumeCents: 0,
            commissionClientCents: 0,
            lineCount: 0
          };
          detail.orderVolumeCents += lineTotal;
          detail.commissionClientCents += clientPart;
          detail.lineCount += 1;
          current?.commissionDetails.set(detailKey, detail);
        }

        if (partnerPart > 0) {
          const detail = current?.partnerCommissionDetails.get(detailKey) ?? {
            key: detailKey,
            organizerName,
            stayTitle,
            orderVolumeCents: 0,
            commissionClientCents: 0,
            lineCount: 0
          };
          detail.orderVolumeCents += lineTotal;
          detail.commissionClientCents += partnerPart;
          detail.lineCount += 1;
          current?.partnerCommissionDetails.set(detailKey, detail);
        }
      }
    } else if (row.fee_kind === 'PUBLICATION') {
      bump(key, {
        publicationFeeCents: row.amount_cents,
        publicationPositiveCount: row.amount_cents > 0 ? 1 : 0
      });
      if (row.amount_cents > 0) {
        const current = bucket.get(key);
        const detailKey = row.organizer_id;
        const detail = current?.publicationDetails.get(detailKey) ?? {
          key: detailKey,
          organizerName,
          publicationFeeCents: 0,
          stayCount: 0,
          stayTitles: []
        };
        detail.publicationFeeCents += row.amount_cents;
        detail.stayCount += 1;
        if (!detail.stayTitles.includes(stayTitle)) {
          detail.stayTitles.push(stayTitle);
          detail.stayTitles.sort((left, right) => left.localeCompare(right, 'fr', { sensitivity: 'base' }));
        }
        current?.publicationDetails.set(detailKey, detail);
      }
    }
  }

  const rows: FinancesBreakdownRow[] = Array.from(bucket.entries()).map(([key, agg]) => {
    let label = key;
    if (granularity === 'organisateur') {
      label = organizerNames[key] ?? key;
    } else if (granularity === 'mois') {
      label = monthLabel(key);
    } else if (granularity === 'annee') {
      label = String(year);
    }

    return {
      key,
      label,
      orderVolumeCents: agg.orderVolumeCents,
      commissionClientCents: agg.commissionClientCents,
      commissionPartnerCents: agg.commissionPartnerCents,
      publicationFeeCents: agg.publicationFeeCents,
      publicationPositiveCount: agg.publicationPositiveCount,
      commissionDetails: Array.from(agg.commissionDetails.values()).sort((left, right) => {
        const organizerDelta = left.organizerName.localeCompare(right.organizerName, 'fr', { sensitivity: 'base' });
        if (organizerDelta !== 0) return organizerDelta;
        return left.stayTitle.localeCompare(right.stayTitle, 'fr', { sensitivity: 'base' });
      }),
      partnerCommissionDetails: Array.from(agg.partnerCommissionDetails.values()).sort((left, right) => {
        const organizerDelta = left.organizerName.localeCompare(right.organizerName, 'fr', { sensitivity: 'base' });
        if (organizerDelta !== 0) return organizerDelta;
        return left.stayTitle.localeCompare(right.stayTitle, 'fr', { sensitivity: 'base' });
      }),
      publicationDetails: Array.from(agg.publicationDetails.values()).sort((left, right) =>
        left.organizerName.localeCompare(right.organizerName, 'fr', { sensitivity: 'base' })
      )
    };
  });

  rows.sort((a, b) => {
    if (granularity === 'mois') return a.key.localeCompare(b.key);
    if (granularity === 'saison') return a.label.localeCompare(b.label, 'fr');
    if (granularity === 'organisateur') return a.label.localeCompare(b.label, 'fr');
    return 0;
  });

  const totals = rows.reduce(
    (acc, r) => ({
      orderVolumeCents: acc.orderVolumeCents + r.orderVolumeCents,
      commissionClientCents: acc.commissionClientCents + r.commissionClientCents,
      commissionPartnerCents: acc.commissionPartnerCents + r.commissionPartnerCents,
      publicationFeeCents: acc.publicationFeeCents + r.publicationFeeCents
    }),
    { orderVolumeCents: 0, commissionClientCents: 0, commissionPartnerCents: 0, publicationFeeCents: 0 }
  );

  return { rows, totals, organizerNames, warnings, ledgerTableMissing: false, publicationFeeEnabled };
}
