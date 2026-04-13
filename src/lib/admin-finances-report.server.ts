import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';

export type FinancesGranularity = 'mois' | 'annee' | 'saison' | 'organisateur';

export type FinancesBreakdownRow = {
  key: string;
  label: string;
  orderVolumeCents: number;
  commissionClientCents: number;
  publicationFeeCents: number;
  publicationPositiveCount: number;
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
  seasons?: { name?: string | null } | { name?: string | null }[] | null;
} | null;

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

type Agg = {
  orderVolumeCents: number;
  commissionClientCents: number;
  publicationFeeCents: number;
  publicationPositiveCount: number;
};

const EMPTY_TOTALS = {
  orderVolumeCents: 0,
  commissionClientCents: 0,
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
    publicationFeeCents: number;
  };
  organizerNames: Record<string, string>;
  warnings: string[];
  ledgerTableMissing: boolean;
}> {
  const { start, end, startIso, endIso } = yearBoundsUtc(year);
  const warnings: string[] = [
    'Les montants proviennent du journal des frais : une ligne de commission est créée au paiement de la commande, avec le taux de commission en vigueur à ce moment-là pour l’organisateur concerné.',
    'Un forfait publication est enregistré à la première mise en ligne d’une fiche séjour (passage au statut « Publié »). Les écritures négatives (annulation / abstention après validation admin) apparaîtront dans le même journal lorsque le flux correspondant sera branché.'
  ];

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
            seasons ( name )
          )
        )
      ),
      stays (
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
      ledgerTableMissing: true
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
      publicationFeeCents: 0,
      publicationPositiveCount: 0
    };
    if (patch.orderVolumeCents != null) cur.orderVolumeCents += patch.orderVolumeCents;
    if (patch.commissionClientCents != null) cur.commissionClientCents += patch.commissionClientCents;
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
    const row = raw as unknown as {
      occurred_at: string;
      organizer_id: string;
      fee_kind: string;
      channel: string;
      amount_cents: number;
      order_items?: { total_price_cents?: number } | null;
    };
    const t = new Date(row.occurred_at).getTime();
    if (t < start || t >= end) continue;

    const seasonName = seasonNameFromNested(row as Parameters<typeof seasonNameFromNested>[0]);
    const key = rowKey(t, row.organizer_id, seasonName);

    if (row.fee_kind === 'COMMISSION') {
      const lineTotal = row.order_items?.total_price_cents ?? 0;
      const clientPart = row.channel === 'CLIENT' ? row.amount_cents : 0;
      bump(key, {
        orderVolumeCents: lineTotal,
        commissionClientCents: clientPart
      });
    } else if (row.fee_kind === 'PUBLICATION') {
      bump(key, {
        publicationFeeCents: row.amount_cents,
        publicationPositiveCount: row.amount_cents > 0 ? 1 : 0
      });
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
      publicationFeeCents: agg.publicationFeeCents,
      publicationPositiveCount: agg.publicationPositiveCount
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
      publicationFeeCents: acc.publicationFeeCents + r.publicationFeeCents
    }),
    { orderVolumeCents: 0, commissionClientCents: 0, publicationFeeCents: 0 }
  );

  return { rows, totals, organizerNames, warnings, ledgerTableMissing: false };
}
