import { getServerSupabaseClient } from '@/lib/supabase/server';
import { isMissingAnyColumnError } from '@/lib/supabase-schema-errors';
import {
  computePartnerContributionSnapshotCents,
  computePartnerFinanceSplit,
  normalizePartnerFinanceMode,
  PARTNER_FINANCE_MODE_LABELS
} from '@/lib/partner-offers';
import { readPartnerCollectivity } from '@/lib/partner.server';

export type PartnerOrganizerAmountRow = {
  organizerId: string;
  organizerName: string;
  reservationCount: number;
  itemCount: number;
  totalCents: number;
  partnerContributionCents: number;
  clientContributionCents: number;
  pendingManualCount: number;
};

export type PartnerAmountsByOrganizerViewModel = {
  partnerName: string;
  financeModeLabel: string;
  selectedSeasonId: string | null;
  seasonOptions: Array<{ id: string; name: string }>;
  rows: PartnerOrganizerAmountRow[];
  totals: {
    reservationCount: number;
    itemCount: number;
    totalCents: number;
    partnerContributionCents: number;
    clientContributionCents: number;
    pendingManualCount: number;
  };
};

function formatMoneyFromCents(value: number) {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value / 100);
}

export { formatMoneyFromCents as formatPartnerOrganizerAmountMoney };

export async function buildPartnerAmountsByOrganizerModel(input: {
  collectivityId: string;
  seasonId?: string | null;
}): Promise<PartnerAmountsByOrganizerViewModel> {
  const supabase = getServerSupabaseClient();
  const collectivity = await readPartnerCollectivity(input.collectivityId);
  const selectedSeasonId = input.seasonId?.trim() || null;

  let { data: orders, error: ordersError } = await supabase
    .from('orders')
    .select('id,status,cancellation_reason,client_user_id,collectivity_id')
    .eq('collectivity_id', input.collectivityId)
    .neq('status', 'CART');

  if (ordersError && isMissingAnyColumnError(ordersError, ['cancellation_reason'])) {
    const legacyResult = await supabase
      .from('orders')
      .select('id,status,client_user_id,collectivity_id')
      .eq('collectivity_id', input.collectivityId)
      .neq('status', 'CART');
    orders = (legacyResult.data ?? []).map((order) => ({
      ...order,
      cancellation_reason: null
    }));
    ordersError = legacyResult.error;
  }

  if (ordersError) {
    throw new Error(`Impossible de charger les réservations : ${ordersError.message}`);
  }

  const orderRows = (orders ?? []).filter(
    (order) => order.status !== 'CANCELLED' && order.status !== 'TRANSFERRED'
  );
  if (orderRows.length === 0) {
    return {
      partnerName: collectivity.name,
      financeModeLabel: PARTNER_FINANCE_MODE_LABELS[normalizePartnerFinanceMode(collectivity.finance_mode)],
      selectedSeasonId,
      seasonOptions: [],
      rows: [],
      totals: {
        reservationCount: 0,
        itemCount: 0,
        totalCents: 0,
        partnerContributionCents: 0,
        clientContributionCents: 0,
        pendingManualCount: 0
      }
    };
  }

  const orderIds = orderRows.map((row) => row.id);

  const [{ data: orderItems, error: itemsError }, { data: payments, error: paymentsError }] = await Promise.all([
    supabase
      .from('order_items')
      .select('id,order_id,session_id,total_price_cents')
      .in('order_id', orderIds),
    supabase
      .from('payments')
      .select('order_id,status,updated_at')
      .in('order_id', orderIds)
      .order('updated_at', { ascending: false })
  ]);

  if (itemsError) {
    throw new Error(`Impossible de charger les lignes de commande : ${itemsError.message}`);
  }
  if (paymentsError) {
    throw new Error(`Impossible de charger les paiements : ${paymentsError.message}`);
  }

  const latestPaymentStatusByOrderId = new Map<string, string>();
  for (const payment of payments ?? []) {
    if (!latestPaymentStatusByOrderId.has(payment.order_id)) {
      latestPaymentStatusByOrderId.set(payment.order_id, payment.status);
    }
  }

  const eligibleOrderIds = new Set(
    orderRows
      .filter((order) => {
        const latestPaymentStatus = latestPaymentStatusByOrderId.get(order.id) ?? null;
        if (order.status === 'CANCELLED' && order.cancellation_reason === 'PAYMENT_FAILED') {
          return false;
        }
        return latestPaymentStatus !== 'FAILED';
      })
      .map((order) => order.id)
  );

  const eligibleItems = (orderItems ?? []).filter((item) => eligibleOrderIds.has(item.order_id));
  if (eligibleItems.length === 0) {
    return {
      partnerName: collectivity.name,
      financeModeLabel: PARTNER_FINANCE_MODE_LABELS[normalizePartnerFinanceMode(collectivity.finance_mode)],
      selectedSeasonId,
      seasonOptions: [],
      rows: [],
      totals: {
        reservationCount: 0,
        itemCount: 0,
        totalCents: 0,
        partnerContributionCents: 0,
        clientContributionCents: 0,
        pendingManualCount: 0
      }
    };
  }

  const sessionIds = Array.from(new Set(eligibleItems.map((item) => item.session_id).filter(Boolean)));
  const orderItemIds = eligibleItems.map((item) => item.id);

  const [sessionsResponse, contributionsResponse, seasonsResponse] = await Promise.all([
    sessionIds.length
      ? supabase.from('sessions').select('id,stay_id').in('id', sessionIds)
      : Promise.resolve({ data: [], error: null }),
    orderItemIds.length
      ? supabase
          .from('collectivity_contributions')
          .select('order_item_id,mode,fixed_cents,percent_value,cap_cents,status')
          .eq('collectivity_id', input.collectivityId)
          .in('order_item_id', orderItemIds)
      : Promise.resolve({ data: [], error: null }),
    supabase.from('seasons').select('id,name').order('name')
  ]);

  if (sessionsResponse.error) {
    throw new Error(`Impossible de charger les sessions : ${sessionsResponse.error.message}`);
  }
  if (contributionsResponse.error) {
    throw new Error(`Impossible de charger les contributions : ${contributionsResponse.error.message}`);
  }

  const stayIds = Array.from(new Set((sessionsResponse.data ?? []).map((row) => row.stay_id).filter(Boolean)));
  const { data: stays, error: staysError } = stayIds.length
    ? await supabase.from('stays').select('id,organizer_id,season_id').in('id', stayIds)
    : { data: [], error: null };

  if (staysError) {
    throw new Error(`Impossible de charger les séjours : ${staysError.message}`);
  }

  const organizerIds = Array.from(new Set((stays ?? []).map((stay) => stay.organizer_id).filter(Boolean)));
  const { data: organizers, error: organizersError } = organizerIds.length
    ? await supabase.from('organizers').select('id,name').in('id', organizerIds)
    : { data: [], error: null };

  if (organizersError) {
    throw new Error(`Impossible de charger les organisateurs : ${organizersError.message}`);
  }

  const sessionsById = new Map((sessionsResponse.data ?? []).map((row) => [row.id, row]));
  const staysById = new Map((stays ?? []).map((row) => [row.id, row]));
  const organizersById = new Map((organizers ?? []).map((row) => [row.id, row]));
  const seasonsById = new Map((seasonsResponse.data ?? []).map((row) => [row.id, row.name]));
  const contributionByOrderItemId = new Map(
    (contributionsResponse.data ?? [])
      .filter((row) => row.status !== 'REJECTED')
      .map((row) => [row.order_item_id, row])
  );

  const seasonIdsInData = new Set<string>();
  const allReservationIds = new Set<string>();
  const aggregation = new Map<
    string,
    {
      organizerName: string;
      reservationIds: Set<string>;
      itemCount: number;
      totalCents: number;
      partnerContributionCents: number;
      clientContributionCents: number;
      pendingManualCount: number;
    }
  >();

  for (const item of eligibleItems) {
    const session = sessionsById.get(item.session_id);
    const stay = session ? staysById.get(session.stay_id) : null;
    const organizerId = stay?.organizer_id;
    if (!organizerId) continue;

    const seasonId = stay?.season_id ?? null;
    if (seasonId) seasonIdsInData.add(seasonId);
    if (selectedSeasonId && seasonId !== selectedSeasonId) continue;

    const itemTotalCents = item.total_price_cents ?? 0;
    const contribution = contributionByOrderItemId.get(item.id);
    let partnerItemCents = 0;
    let pendingManual = false;

    if (contribution) {
      partnerItemCents = computePartnerContributionSnapshotCents({
        mode: contribution.mode,
        totalCents: itemTotalCents,
        percentValue: contribution.percent_value,
        fixedCents: contribution.fixed_cents,
        capCents: contribution.cap_cents
      });
    } else {
      const fallbackSplit = computePartnerFinanceSplit({
        mode: collectivity.finance_mode,
        totalCents: itemTotalCents,
        percentValue: collectivity.finance_percent_value,
        fixedCents: collectivity.finance_fixed_cents,
        manualPartnerCents: 0
      });
      partnerItemCents = fallbackSplit.partnerCents;
      if (normalizePartnerFinanceMode(collectivity.finance_mode) === 'MANUAL') {
        pendingManual = true;
      }
    }

    const clientItemCents = Math.max(0, itemTotalCents - partnerItemCents);
    const organizerName = organizersById.get(organizerId)?.name ?? 'Organisme inconnu';
    const existing = aggregation.get(organizerId) ?? {
      organizerName,
      reservationIds: new Set<string>(),
      itemCount: 0,
      totalCents: 0,
      partnerContributionCents: 0,
      clientContributionCents: 0,
      pendingManualCount: 0
    };

    existing.reservationIds.add(item.order_id);
    allReservationIds.add(item.order_id);
    existing.itemCount += 1;
    existing.totalCents += itemTotalCents;
    existing.partnerContributionCents += partnerItemCents;
    existing.clientContributionCents += clientItemCents;
    if (pendingManual) existing.pendingManualCount += 1;
    aggregation.set(organizerId, existing);
  }

  const seasonOptions = Array.from(seasonIdsInData)
    .map((id) => ({ id, name: seasonsById.get(id) ?? 'Saison inconnue' }))
    .sort((left, right) => left.name.localeCompare(right.name, 'fr'));

  const rows: PartnerOrganizerAmountRow[] = Array.from(aggregation.entries())
    .map(([organizerId, value]) => ({
      organizerId,
      organizerName: value.organizerName,
      reservationCount: value.reservationIds.size,
      itemCount: value.itemCount,
      totalCents: value.totalCents,
      partnerContributionCents: value.partnerContributionCents,
      clientContributionCents: value.clientContributionCents,
      pendingManualCount: value.pendingManualCount
    }))
    .sort((left, right) => {
      if (right.partnerContributionCents !== left.partnerContributionCents) {
        return right.partnerContributionCents - left.partnerContributionCents;
      }
      return left.organizerName.localeCompare(right.organizerName, 'fr');
    });

  const totals = rows.reduce(
    (acc, row) => ({
      reservationCount: acc.reservationCount,
      itemCount: acc.itemCount + row.itemCount,
      totalCents: acc.totalCents + row.totalCents,
      partnerContributionCents: acc.partnerContributionCents + row.partnerContributionCents,
      clientContributionCents: acc.clientContributionCents + row.clientContributionCents,
      pendingManualCount: acc.pendingManualCount + row.pendingManualCount
    }),
    {
      reservationCount: allReservationIds.size,
      itemCount: 0,
      totalCents: 0,
      partnerContributionCents: 0,
      clientContributionCents: 0,
      pendingManualCount: 0
    }
  );

  return {
    partnerName: collectivity.name,
    financeModeLabel: PARTNER_FINANCE_MODE_LABELS[normalizePartnerFinanceMode(collectivity.finance_mode)],
    selectedSeasonId,
    seasonOptions,
    rows,
    totals
  };
}
