import { getServerSupabaseClient } from '@/lib/supabase/server';
import { isMissingAnyColumnError } from '@/lib/supabase-schema-errors';
import { computePartnerContributionSnapshotCents } from '@/lib/partner-offers';

export type OrganizerPartnerAmountRow = {
  collectivityId: string;
  partnerName: string;
  reservationCount: number;
  itemCount: number;
  totalCents: number;
  partnerContributionCents: number;
  clientContributionCents: number;
};

export type OrganizerAmountsByPartnerViewModel = {
  organizerName: string;
  selectedSeasonId: string | null;
  seasonOptions: Array<{ id: string; name: string }>;
  rows: OrganizerPartnerAmountRow[];
  totals: {
    reservationCount: number;
    itemCount: number;
    totalCents: number;
    partnerContributionCents: number;
    clientContributionCents: number;
  };
};

export function formatOrganizerPartnerAmountMoney(value: number) {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value / 100);
}

export async function buildOrganizerAmountsByPartnerModel(input: {
  organizerId: string;
  seasonId?: string | null;
}): Promise<OrganizerAmountsByPartnerViewModel> {
  const supabase = getServerSupabaseClient();
  const selectedSeasonId = input.seasonId?.trim() || null;

  const { data: organizer } = await supabase
    .from('organizers')
    .select('id,name')
    .eq('id', input.organizerId)
    .maybeSingle();

  const { data: stays, error: staysError } = await supabase
    .from('stays')
    .select('id,season_id')
    .eq('organizer_id', input.organizerId);

  if (staysError) {
    throw new Error(`Impossible de charger les séjours : ${staysError.message}`);
  }

  const stayIds = (stays ?? []).map((stay) => stay.id);
  if (stayIds.length === 0) {
    return emptyModel(organizer?.name ?? 'Organisme', selectedSeasonId);
  }

  const staysById = new Map((stays ?? []).map((stay) => [stay.id, stay]));
  const { data: sessions, error: sessionsError } = await supabase
    .from('sessions')
    .select('id,stay_id')
    .in('stay_id', stayIds);

  if (sessionsError) {
    throw new Error(`Impossible de charger les sessions : ${sessionsError.message}`);
  }

  const sessionIds = (sessions ?? []).map((session) => session.id);
  if (sessionIds.length === 0) {
    return emptyModel(organizer?.name ?? 'Organisme', selectedSeasonId);
  }

  const sessionsById = new Map((sessions ?? []).map((session) => [session.id, session]));

  const [{ data: itemsByOrganizer }, { data: itemsBySession }] = await Promise.all([
    supabase
      .from('order_items')
      .select('id,order_id,session_id,total_price_cents,organizer_id')
      .eq('organizer_id', input.organizerId),
    supabase
      .from('order_items')
      .select('id,order_id,session_id,total_price_cents,organizer_id')
      .in('session_id', sessionIds)
  ]);

  const orderItemsById = new Map<string, NonNullable<typeof itemsByOrganizer>[number]>();
  for (const item of [...(itemsByOrganizer ?? []), ...(itemsBySession ?? [])]) {
    orderItemsById.set(item.id, item);
  }
  const orderItems = Array.from(orderItemsById.values());

  const itemsForOrganizer = orderItems.filter((item) => {
    if (item.organizer_id === input.organizerId) return true;
    const session = item.session_id ? sessionsById.get(item.session_id) : null;
    return Boolean(session && staysById.has(session.stay_id));
  });

  if (itemsForOrganizer.length === 0) {
    return emptyModel(organizer?.name ?? 'Organisme', selectedSeasonId);
  }

  const orderIds = Array.from(new Set(itemsForOrganizer.map((item) => item.order_id)));

  let { data: orders, error: ordersError } = await supabase
    .from('orders')
    .select('id,status,cancellation_reason,collectivity_id')
    .in('id', orderIds)
    .neq('status', 'CART');

  if (ordersError && isMissingAnyColumnError(ordersError, ['cancellation_reason'])) {
    const legacyResult = await supabase
      .from('orders')
      .select('id,status,collectivity_id')
      .in('id', orderIds)
      .neq('status', 'CART');
    orders = (legacyResult.data ?? []).map((order) => ({ ...order, cancellation_reason: null }));
    ordersError = legacyResult.error;
  }

  if (ordersError) {
    throw new Error(`Impossible de charger les réservations : ${ordersError.message}`);
  }

  const eligibleOrders = (orders ?? []).filter(
    (order) =>
      order.status !== 'CANCELLED' &&
      order.status !== 'FAILED' &&
      order.status !== 'TRANSFERRED' &&
      Boolean(order.collectivity_id)
  );
  const eligibleOrderIds = new Set(eligibleOrders.map((order) => order.id));
  const eligibleItems = itemsForOrganizer.filter((item) => eligibleOrderIds.has(item.order_id));

  if (eligibleItems.length === 0) {
    return emptyModel(organizer?.name ?? 'Organisme', selectedSeasonId);
  }

  const orderItemIds = eligibleItems.map((item) => item.id);
  const collectivityIds = Array.from(
    new Set(eligibleOrders.map((order) => order.collectivity_id).filter((id): id is string => Boolean(id)))
  );

  const [{ data: contributions }, { data: collectivities }, { data: seasons }] = await Promise.all([
    orderItemIds.length
      ? supabase
          .from('collectivity_contributions')
          .select('order_item_id,collectivity_id,mode,fixed_cents,percent_value,cap_cents,status')
          .in('order_item_id', orderItemIds)
      : Promise.resolve({ data: [] }),
    collectivityIds.length
      ? supabase.from('collectivities').select('id,name').in('id', collectivityIds)
      : Promise.resolve({ data: [] }),
    supabase.from('seasons').select('id,name').order('name')
  ]);

  const contributionByOrderItemId = new Map(
    (contributions ?? [])
      .filter((row) => row.status !== 'REJECTED')
      .map((row) => [row.order_item_id, row])
  );
  const collectivitiesById = new Map((collectivities ?? []).map((row) => [row.id, row.name]));
  const seasonsById = new Map((seasons ?? []).map((row) => [row.id, row.name]));
  const orderCollectivityById = new Map(
    eligibleOrders.map((order) => [order.id, order.collectivity_id as string])
  );

  const seasonIdsInData = new Set<string>();
  const aggregation = new Map<
    string,
    {
      partnerName: string;
      reservationIds: Set<string>;
      itemCount: number;
      totalCents: number;
      partnerContributionCents: number;
      clientContributionCents: number;
    }
  >();

  for (const item of eligibleItems) {
    const session = item.session_id ? sessionsById.get(item.session_id) : null;
    const stay = session ? staysById.get(session.stay_id) : null;
    const seasonId = stay?.season_id ?? null;
    if (seasonId) seasonIdsInData.add(seasonId);
    if (selectedSeasonId && seasonId !== selectedSeasonId) continue;

    const collectivityId = orderCollectivityById.get(item.order_id);
    if (!collectivityId) continue;

    const itemTotalCents = item.total_price_cents ?? 0;
    const contribution = contributionByOrderItemId.get(item.id);
    const partnerItemCents = contribution
      ? computePartnerContributionSnapshotCents({
          mode: contribution.mode,
          totalCents: itemTotalCents,
          percentValue: contribution.percent_value,
          fixedCents: contribution.fixed_cents,
          capCents: contribution.cap_cents
        })
      : 0;
    const clientItemCents = Math.max(0, itemTotalCents - partnerItemCents);

    const existing = aggregation.get(collectivityId) ?? {
      partnerName: collectivitiesById.get(collectivityId) ?? 'Partenaire inconnu',
      reservationIds: new Set<string>(),
      itemCount: 0,
      totalCents: 0,
      partnerContributionCents: 0,
      clientContributionCents: 0
    };

    existing.reservationIds.add(item.order_id);
    existing.itemCount += 1;
    existing.totalCents += itemTotalCents;
    existing.partnerContributionCents += partnerItemCents;
    existing.clientContributionCents += clientItemCents;
    aggregation.set(collectivityId, existing);
  }

  const seasonOptions = Array.from(seasonIdsInData)
    .map((id) => ({ id, name: seasonsById.get(id) ?? 'Saison inconnue' }))
    .sort((left, right) => left.name.localeCompare(right.name, 'fr'));

  const rows: OrganizerPartnerAmountRow[] = Array.from(aggregation.entries())
    .map(([collectivityId, value]) => ({
      collectivityId,
      partnerName: value.partnerName,
      reservationCount: value.reservationIds.size,
      itemCount: value.itemCount,
      totalCents: value.totalCents,
      partnerContributionCents: value.partnerContributionCents,
      clientContributionCents: value.clientContributionCents
    }))
    .filter((row) => row.partnerContributionCents > 0)
    .sort((left, right) => right.partnerContributionCents - left.partnerContributionCents);

  const totals = rows.reduce(
    (acc, row) => {
      acc.reservationCount += row.reservationCount;
      acc.itemCount += row.itemCount;
      acc.totalCents += row.totalCents;
      acc.partnerContributionCents += row.partnerContributionCents;
      acc.clientContributionCents += row.clientContributionCents;
      return acc;
    },
    {
      reservationCount: 0,
      itemCount: 0,
      totalCents: 0,
      partnerContributionCents: 0,
      clientContributionCents: 0
    }
  );

  return {
    organizerName: organizer?.name ?? 'Organisme',
    selectedSeasonId,
    seasonOptions,
    rows,
    totals
  };
}

function emptyModel(
  organizerName: string,
  selectedSeasonId: string | null
): OrganizerAmountsByPartnerViewModel {
  return {
    organizerName,
    selectedSeasonId,
    seasonOptions: [],
    rows: [],
    totals: {
      reservationCount: 0,
      itemCount: 0,
      totalCents: 0,
      partnerContributionCents: 0,
      clientContributionCents: 0
    }
  };
}
