import {
  evaluatePartnerCatalogEligibility,
  simulatePartnerAid
} from '@/lib/partner-catalog-rules';
import {
  parseStoredFamilyQuotient,
  resolveCatalogRulesForCseAid,
  resolveClientQfForAidSimulation
} from '@/lib/partner-client-qf';
import { normalizePartnerFinanceMode } from '@/lib/partner-offers';
import {
  computeRemainingBalanceCents,
  resolveStatusAfterRequestResolution,
  type OrderStatus
} from '@/lib/order-workflow';
import { getServerSupabaseClient } from '@/lib/supabase/server';
import { isMissingColumnError } from '@/lib/supabase-schema-errors';

function durationDays(startDate: string, endDate: string) {
  return Math.max(
    1,
    Math.ceil(
      (new Date(`${endDate}T00:00:00Z`).getTime() - new Date(`${startDate}T00:00:00Z`).getTime()) /
        (24 * 60 * 60 * 1000)
    ) + 1
  );
}

function todayIsoDate(referenceDate = new Date()) {
  return referenceDate.toISOString().slice(0, 10);
}

/**
 * After a CSE updates a beneficiary QF, recalculate partner contributions and
 * order statuses for stays that are not finished yet. Does not refund payments.
 */
export async function recalculateOpenOrdersAfterBeneficiaryQfUpdate(input: {
  collectivityId: string;
  beneficiaryUserId: string;
  familyQuotient: number | null;
  familyQuotientExpiresOn: string | null;
}) {
  const supabase = getServerSupabaseClient();
  let collectivityQuery = await supabase
    .from('collectivities')
    .select('id,finance_mode,catalog_rules_published,catalog_rules_draft')
    .eq('id', input.collectivityId)
    .maybeSingle();

  if (
    collectivityQuery.error &&
    isMissingColumnError(collectivityQuery.error, 'catalog_rules_draft')
  ) {
    collectivityQuery = await supabase
      .from('collectivities')
      .select('id,finance_mode,catalog_rules_published')
      .eq('id', input.collectivityId)
      .maybeSingle();
  }

  const { data: collectivity, error: collectivityError } = collectivityQuery;

  if (collectivityError) {
    if (isMissingColumnError(collectivityError, 'catalog_rules_published')) {
      return { updatedOrderCount: 0 };
    }
    throw new Error(`Impossible de charger la collectivité : ${collectivityError.message}`);
  }
  if (!collectivity) {
    return { updatedOrderCount: 0 };
  }
  if (normalizePartnerFinanceMode(collectivity.finance_mode) !== 'MANUAL') {
    return { updatedOrderCount: 0 };
  }

  const rules = resolveCatalogRulesForCseAid({
    published: collectivity.catalog_rules_published,
    draft: 'catalog_rules_draft' in collectivity ? collectivity.catalog_rules_draft : null
  });
  if (!rules) {
    return { updatedOrderCount: 0 };
  }

  const qfValue = resolveClientQfForAidSimulation({
    rules,
    familyQuotient: parseStoredFamilyQuotient(input.familyQuotient),
    familyQuotientExpiresOn: input.familyQuotientExpiresOn
  });

  const { data: orders, error: ordersError } = await supabase
    .from('orders')
    .select('id,status,external_aid_cents,external_paid_cents,paid_at')
    .eq('client_user_id', input.beneficiaryUserId)
    .eq('collectivity_id', input.collectivityId)
    .neq('status', 'CART')
    .neq('status', 'CANCELLED');

  if (ordersError) {
    throw new Error(`Impossible de charger les commandes à recalculer : ${ordersError.message}`);
  }
  if (!orders?.length) {
    return { updatedOrderCount: 0 };
  }

  const orderIds = orders.map((order) => order.id);
  const { data: orderItems, error: itemsError } = await supabase
    .from('order_items')
    .select('id,order_id,session_id,total_price_cents')
    .in('order_id', orderIds);

  if (itemsError) {
    throw new Error(`Impossible de charger les lignes de commande : ${itemsError.message}`);
  }
  if (!orderItems?.length) {
    return { updatedOrderCount: 0 };
  }

  const sessionIds = Array.from(
    new Set(orderItems.map((item) => item.session_id).filter((value): value is string => Boolean(value)))
  );
  const { data: sessions, error: sessionsError } = await supabase
    .from('sessions')
    .select('id,stay_id,start_date,end_date')
    .in('id', sessionIds);

  if (sessionsError) {
    throw new Error(`Impossible de charger les sessions : ${sessionsError.message}`);
  }

  const sessionsById = new Map((sessions ?? []).map((session) => [session.id, session]));
  const today = todayIsoDate();
  const activeOrderIds = new Set<string>();
  for (const item of orderItems) {
    const session = item.session_id ? sessionsById.get(item.session_id) : null;
    if (session?.end_date && session.end_date >= today) {
      activeOrderIds.add(item.order_id);
    }
  }

  if (activeOrderIds.size === 0) {
    return { updatedOrderCount: 0 };
  }

  const stayIds = Array.from(
    new Set(
      [...activeOrderIds]
        .flatMap((orderId) => orderItems.filter((item) => item.order_id === orderId))
        .map((item) => {
          const session = item.session_id ? sessionsById.get(item.session_id) : null;
          return session?.stay_id ?? null;
        })
        .filter((value): value is string => Boolean(value))
    )
  );

  const { data: stays, error: staysError } = stayIds.length
    ? await supabase
        .from('stays')
        .select(
          'id,organizer_id,age_min,age_max,categories,destination_country,destination_countries,transport_mode,required_documents_text,supervision_text'
        )
        .in('id', stayIds)
    : { data: [], error: null };

  if (staysError) {
    throw new Error(`Impossible de charger les séjours : ${staysError.message}`);
  }
  const staysById = new Map((stays ?? []).map((stay) => [stay.id, stay]));

  const { data: payments, error: paymentsError } = await supabase
    .from('payments')
    .select('order_id,amount_cents,status')
    .in('order_id', [...activeOrderIds]);

  if (paymentsError) {
    throw new Error(`Impossible de charger les paiements : ${paymentsError.message}`);
  }

  const onlinePaidByOrder = new Map<string, number>();
  for (const payment of payments ?? []) {
    if (payment.status !== 'SUCCEEDED') continue;
    onlinePaidByOrder.set(
      payment.order_id,
      (onlinePaidByOrder.get(payment.order_id) ?? 0) + Math.max(0, payment.amount_cents ?? 0)
    );
  }

  const now = new Date().toISOString();
  let updatedOrderCount = 0;

  for (const order of orders) {
    if (!activeOrderIds.has(order.id)) continue;

    const itemsForOrder = orderItems.filter((item) => item.order_id === order.id);
    const contributionRows: Array<{
      collectivity_id: string;
      order_item_id: string;
      mode: 'FIXED';
      fixed_cents: number;
      percent_value: null;
      cap_cents: null;
      status: 'APPROVED';
      approved_at: string;
      approved_by_user_id: null;
      updated_at: string;
    }> = [];

    let partnerContributionCents = 0;

    for (const item of itemsForOrder) {
      const session = item.session_id ? sessionsById.get(item.session_id) : null;
      const stay = session?.stay_id ? staysById.get(session.stay_id) : null;
      const totalPriceCents = Math.max(0, item.total_price_cents ?? 0);
      let aidCents = 0;

      if (session && stay) {
        const eligibility = evaluatePartnerCatalogEligibility({
          rules,
          stay: {
            age_min: stay.age_min,
            age_max: stay.age_max,
            categories: stay.categories ?? [],
            destination_country: stay.destination_country,
            destination_countries: stay.destination_countries,
            transport_mode: stay.transport_mode ?? 'NONE',
            required_documents_text: stay.required_documents_text,
            education_project_path: null,
            supervision_text: stay.supervision_text
          },
          session: {
            start_date: session.start_date,
            end_date: session.end_date
          },
          priceCents: totalPriceCents,
          organizer: {
            id: stay.organizer_id,
            is_resacolo_member: true
          }
        });

        if (eligibility.status === 'ELIGIBLE') {
          const simulation = simulatePartnerAid({
            rules,
            priceCents: totalPriceCents,
            durationDays: durationDays(session.start_date, session.end_date),
            qfValue
          });
          aidCents = Math.max(0, simulation.aidCents);
        }
      }

      partnerContributionCents += aidCents;
      contributionRows.push({
        collectivity_id: input.collectivityId,
        order_item_id: item.id,
        mode: 'FIXED',
        fixed_cents: aidCents,
        percent_value: null,
        cap_cents: null,
        status: 'APPROVED',
        approved_at: now,
        approved_by_user_id: null,
        updated_at: now
      });
    }

    const { error: upsertError } = await supabase
      .from('collectivity_contributions')
      .upsert(contributionRows, { onConflict: 'order_item_id' });

    if (upsertError) {
      throw new Error(`Impossible de mettre à jour la prise en charge CSE : ${upsertError.message}`);
    }

    const totalCents = itemsForOrder.reduce((sum, item) => sum + Math.max(0, item.total_price_cents ?? 0), 0);
    const clientContributionCents = Math.max(0, totalCents - partnerContributionCents);
    const onlinePaidCents = onlinePaidByOrder.get(order.id) ?? 0;
    const remainingBalanceCents = computeRemainingBalanceCents({
      totalCents: clientContributionCents,
      externalAidCents: order.external_aid_cents ?? 0,
      externalPaidCents: order.external_paid_cents ?? 0,
      onlinePaidCents
    });
    const nextStatus: OrderStatus = resolveStatusAfterRequestResolution({
      totalCents: clientContributionCents,
      externalAidCents: order.external_aid_cents ?? 0,
      externalPaidCents: order.external_paid_cents ?? 0,
      onlinePaidCents
    });

    const updatePayload: {
      status: OrderStatus;
      updated_at: string;
      paid_at?: string | null;
    } = {
      status: nextStatus,
      updated_at: now
    };
    if (remainingBalanceCents <= 0 && !order.paid_at) {
      updatePayload.paid_at = now;
    }
    if (remainingBalanceCents > 0) {
      updatePayload.paid_at = null;
    }

    const { error: orderUpdateError } = await supabase
      .from('orders')
      .update(updatePayload)
      .eq('id', order.id);

    if (orderUpdateError) {
      throw new Error(`Impossible de mettre à jour le statut de commande : ${orderUpdateError.message}`);
    }

    updatedOrderCount += 1;
  }

  return { updatedOrderCount };
}
