import { getServerSupabaseClient } from '@/lib/supabase/server';
import { resolveCheckoutCollectivityForUser } from '@/lib/account-profile/server';
import { markCheckoutCartConverted } from '@/lib/checkout/cart-tracking';
import type { CartItem } from '@/types/cart';
import type { CheckoutContact, CheckoutParticipant, CheckoutPricing } from '@/types/checkout';
import type { Json, Database } from '@/types/supabase';
import { CheckoutValidationError, repriceCart } from '@/lib/checkout/pricing';
import { buildMoneticoLivePayload, getMoneticoMode, type MoneticoPayload } from '@/lib/checkout/monetico';
import { readOrganizerCheckoutSettings } from '@/lib/organizer-checkout-settings';
import {
  computeImmediatePaymentAmountCents,
  parseAmountEurosToCents,
  resolveInitialOrderStatus,
  resolveOrderRequestKind,
  resolvePaidOrderStatus
} from '@/lib/order-workflow';
import {
  clampPartnerFinanceCents,
  clampPartnerFinancePercent,
  computePartnerContributionSnapshotCents,
  normalizePartnerFinanceMode
} from '@/lib/partner-offers';
import { isMissingAnyColumnError } from '@/lib/supabase-schema-errors';

type PrepareCheckoutPaymentInput = {
  checkoutId: string;
  clientUserId: string;
  items: CartItem[];
  contact: CheckoutContact;
  participants: CheckoutParticipant[];
};

type PrepareCheckoutPaymentResult = {
  orderId: string;
  paymentId: string;
  pricing: CheckoutPricing;
  monetico: MoneticoPayload;
};

const HOLD_MINUTES = 30;
type CollectivityFinanceRow = Pick<
  Database['public']['Tables']['collectivities']['Row'],
  'id' | 'finance_mode' | 'finance_percent_value' | 'finance_fixed_cents'
>;

const ORDER_WORKFLOW_COLUMNS = [
  'request_kind',
  'vacaf_number_snapshot',
  'ancv_connect_matricule',
  'ancv_connect_requested_amount_cents',
  'external_aid_cents',
  'external_paid_cents',
  'request_resolved_at',
  'partially_paid_at',
  'transferred_at'
] as const;

function toJsonValue(value: unknown): Json {
  if (value == null) return null;

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => toJsonValue(item));
  }

  if (typeof value === 'object') {
    const result: Record<string, Json | undefined> = {};
    for (const [key, nestedValue] of Object.entries(value)) {
      result[key] = toJsonValue(nestedValue);
    }
    return result;
  }

  return String(value);
}

function asJsonRecord(value: unknown): Record<string, Json | undefined> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, Json | undefined>;
}

function getParticipantMap(participants: CheckoutParticipant[]) {
  return new Map(participants.map((participant) => [participant.cartItemId, participant]));
}

function parsePaymentModeFromPayload(rawPayload: Json | null | undefined): CheckoutContact['paymentMode'] {
  if (!rawPayload || typeof rawPayload !== 'object' || Array.isArray(rawPayload)) return 'FULL';
  const contact = (rawPayload as Record<string, unknown>).contact;
  if (!contact || typeof contact !== 'object' || Array.isArray(contact)) return 'FULL';
  const paymentMode = (contact as Record<string, unknown>).paymentMode;
  if (
    paymentMode === 'FULL' ||
    paymentMode === 'DEPOSIT_200' ||
    paymentMode === 'CV_CONNECT' ||
    paymentMode === 'CV_PAPER' ||
    paymentMode === 'DEFERRED'
  ) {
    return paymentMode;
  }
  return 'FULL';
}

function validateParticipants(items: CartItem[], participants: CheckoutParticipant[]) {
  const byItemId = getParticipantMap(participants);

  for (const item of items) {
    const participant = byItemId.get(item.id);
    if (!participant) {
      throw new CheckoutValidationError(`Informations enfant manquantes pour « ${item.title} ».`);
    }
  }

  return byItemId;
}

function createMoneticoMockTransactionId(checkoutId: string, paymentId: string) {
  const checkoutPart = checkoutId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8).toUpperCase();
  const paymentPart = paymentId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8).toUpperCase();
  return `MONE-${checkoutPart}-${paymentPart}-${Date.now()}`;
}

function createMoneticoReference(checkoutId: string, orderId: string) {
  const left = checkoutId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 10).toUpperCase();
  const right = orderId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 10).toUpperCase();
  return `${left}-${right}`.slice(0, 24);
}

function createMoneticoPayload(input: {
  checkoutId: string;
  orderId: string;
  paymentId: string;
  reference: string;
  transactionId: string;
  amountCents: number;
  currency: string;
  customerEmail: string;
}): MoneticoPayload {
  if (getMoneticoMode() === 'live') {
    return buildMoneticoLivePayload({
      reference: input.reference,
      transactionId: input.transactionId,
      amountCents: input.amountCents,
      currency: input.currency,
      customerEmail: input.customerEmail,
      orderId: input.orderId,
      checkoutId: input.checkoutId,
      paymentId: input.paymentId,
      returnPath: `/checkout/confirmation/${input.orderId}`
    });
  }

  return {
    mode: 'mock',
    reference: input.reference,
    transactionId: input.transactionId,
    paymentUrl: `/checkout/paiement?checkoutId=${encodeURIComponent(input.checkoutId)}`,
    testMode: true,
    formMethod: 'POST',
    formFields: {}
  };
}

function distributeCentsAcrossOrderItems(
  totalTargetCents: number,
  itemTotals: Array<{ id: string; totalCents: number }>
) {
  if (itemTotals.length === 0) return [] as Array<{ id: string; cents: number }>;
  const sanitizedTarget = Math.max(0, Math.round(totalTargetCents));
  const positiveTotal = itemTotals.reduce((sum, item) => sum + Math.max(item.totalCents, 0), 0);

  if (positiveTotal <= 0) {
    return itemTotals.map((item, index) => ({
      id: item.id,
      cents: index === itemTotals.length - 1 ? sanitizedTarget : 0
    }));
  }

  let allocated = 0;
  return itemTotals.map((item, index) => {
    if (index === itemTotals.length - 1) {
      return { id: item.id, cents: sanitizedTarget - allocated };
    }
    const cents = Math.floor((sanitizedTarget * Math.max(item.totalCents, 0)) / positiveTotal);
    allocated += cents;
    return { id: item.id, cents };
  });
}

function isInvalidOrderStatusEnumError(error: { message?: string | null; code?: string | null } | null | undefined) {
  const message = String(error?.message ?? '').toLowerCase();
  return message.includes('invalid input value for enum order_status');
}

function resolveLegacyOrderStatus(input: {
  requestKind: ReturnType<typeof resolveOrderRequestKind>;
  financeFamilyPayableTotalCents: number | null | undefined;
}) {
  if (input.requestKind) return 'REQUESTED' as const;
  if ((input.financeFamilyPayableTotalCents ?? 0) === 0) return 'PAID' as const;
  return 'REQUESTED' as const;
}

async function readCollectivityFinance(collectivityId: string) {
  const supabase = getServerSupabaseClient();
  const { data, error } = await supabase
    .from('collectivities')
    .select('id,finance_mode,finance_percent_value,finance_fixed_cents')
    .eq('id', collectivityId)
    .maybeSingle();

  if (error) {
    if (isMissingAnyColumnError(error, ['finance_mode', 'finance_percent_value', 'finance_fixed_cents'])) {
      const { data: legacyData, error: legacyError } = await supabase
        .from('collectivities')
        .select('id,finance_percent_value')
        .eq('id', collectivityId)
        .maybeSingle();

      if (legacyError) {
        throw new Error(`Impossible de charger la configuration CSE du checkout : ${legacyError.message}`);
      }
      if (!legacyData) return null;

      return {
        id: legacyData.id,
        finance_mode: 'TOTAL',
        finance_percent_value: legacyData.finance_percent_value ?? null,
        finance_fixed_cents: null
      } as CollectivityFinanceRow;
    }
    throw new Error(`Impossible de charger la configuration CSE du checkout : ${error.message}`);
  }

  return data as CollectivityFinanceRow | null;
}

async function snapshotCollectivityContributions(input: {
  collectivityId: string;
  approvedAt: string;
  orderItems: Array<{ id: string; totalCents: number }>;
}) {
  const collectivity = await readCollectivityFinance(input.collectivityId);
  if (!collectivity || input.orderItems.length === 0) return;

  const mode = normalizePartnerFinanceMode(collectivity.finance_mode);
  const supabase = getServerSupabaseClient();
  const now = new Date().toISOString();

  if (mode === 'PERCENT' || mode === 'TOTAL') {
    const percentValue = mode === 'TOTAL' ? 100 : clampPartnerFinancePercent(collectivity.finance_percent_value);
    const { error } = await supabase.from('collectivity_contributions').upsert(
      input.orderItems.map((item) => ({
        collectivity_id: input.collectivityId,
        order_item_id: item.id,
        mode: 'PERCENT' as const,
        fixed_cents: null,
        percent_value: percentValue,
        cap_cents: null,
        status: 'APPROVED' as const,
        approved_at: input.approvedAt,
        approved_by_user_id: null,
        updated_at: now
      })),
      { onConflict: 'order_item_id' }
    );

    if (error) {
      throw new Error(`Impossible de figer la prise en charge CSE : ${error.message}`);
    }
    return;
  }

  const totalCents = input.orderItems.reduce((sum, item) => sum + Math.max(item.totalCents, 0), 0);
  const fixedTargetCents =
    mode === 'FIXED' ? clampPartnerFinanceCents(collectivity.finance_fixed_cents, totalCents) : 0;
  const allocations =
    fixedTargetCents > 0
      ? distributeCentsAcrossOrderItems(fixedTargetCents, input.orderItems)
      : input.orderItems.map((item) => ({ id: item.id, cents: 0 }));
  const { error } = await supabase.from('collectivity_contributions').upsert(
    allocations.map((allocation) => ({
      collectivity_id: input.collectivityId,
      order_item_id: allocation.id,
      mode: 'FIXED' as const,
      fixed_cents: allocation.cents,
      percent_value: null,
      cap_cents: null,
      status: 'APPROVED' as const,
      approved_at: input.approvedAt,
      approved_by_user_id: null,
      updated_at: now
    })),
    { onConflict: 'order_item_id' }
  );

  if (error) {
    throw new Error(`Impossible de figer la prise en charge CSE : ${error.message}`);
  }
}

async function createOrUpdateClientProfile(
  clientUserId: string,
  contact: CheckoutContact,
  collectivityId: string | null
) {
  const supabase = getServerSupabaseClient();
  const fullName = [contact.billingFirstName, contact.billingLastName].filter(Boolean).join(' ').trim();
  const { error } = await supabase.from('clients').upsert(
    {
      user_id: clientUserId,
      full_name: fullName || null,
      phone: contact.phone,
      collectivity_id: collectivityId
    },
    { onConflict: 'user_id' }
  );

  if (error) {
    throw new Error(`Impossible de synchroniser le profil client: ${error.message}`);
  }
}

async function insertOrderWithCompatibilityFallback(input: {
  clientUserId: string;
  collectivityId: string | null;
  initialStatus: Database['public']['Enums']['order_status'];
  requestedAt: string;
  paidAt: string | null;
  requestKind: ReturnType<typeof resolveOrderRequestKind>;
  contact: CheckoutContact;
  financeFamilyPayableTotalCents: number | null | undefined;
}) {
  const supabase = getServerSupabaseClient();
  const fullInsertPayload = {
    client_user_id: input.clientUserId,
    collectivity_id: input.collectivityId,
    status: input.initialStatus,
    requested_at: input.initialStatus === 'REQUESTED' ? input.requestedAt : null,
    paid_at: input.paidAt,
    vacaf_number_snapshot: input.contact.vacafNumber.trim() || null,
    ancv_connect_matricule: input.contact.ancvConnectMatricule.trim() || null,
    ancv_connect_requested_amount_cents:
      input.requestKind === 'ANCV_CONNECT' ? parseAmountEurosToCents(input.contact.ancvConnectAmount) : null,
    request_kind: input.requestKind
  };

  const { data: order, error } = await supabase.from('orders').insert(fullInsertPayload).select('id').single();

  if (!error && order) {
    return order;
  }

  const shouldRetryLegacyInsert =
    isMissingAnyColumnError(error, [...ORDER_WORKFLOW_COLUMNS]) || isInvalidOrderStatusEnumError(error);

  if (!shouldRetryLegacyInsert) {
    if (error) {
      console.error('checkout: insertion orders échouée', error);
    }
    throw new Error('Impossible de créer la commande.');
  }

  const legacyStatus = resolveLegacyOrderStatus({
    requestKind: input.requestKind,
    financeFamilyPayableTotalCents: input.financeFamilyPayableTotalCents
  });

  const { data: legacyOrder, error: legacyError } = await supabase
    .from('orders')
    .insert({
      client_user_id: input.clientUserId,
      collectivity_id: input.collectivityId,
      status: legacyStatus,
      requested_at: legacyStatus === 'REQUESTED' ? input.requestedAt : null,
      paid_at: legacyStatus === 'PAID' ? input.paidAt ?? input.requestedAt : null
    })
    .select('id')
    .single();

  if (legacyError || !legacyOrder) {
    if (legacyError) {
      console.error('checkout: insertion legacy orders échouée', legacyError);
    }
    throw new Error('Impossible de créer la commande.');
  }

  return legacyOrder;
}

export async function prepareCheckoutPayment(input: PrepareCheckoutPaymentInput): Promise<PrepareCheckoutPaymentResult> {
  const supabase = getServerSupabaseClient();
  const participantByItem = validateParticipants(input.items, input.participants);
  const pricing = await repriceCart(input.items);
  const organizerId = pricing.items[0]?.organizerId ?? input.items[0]?.organizerId ?? '';
  if (!organizerId) {
    throw new Error("Impossible d'identifier l'organisme de la réservation.");
  }
  if (pricing.items.some((item) => item.organizerId !== organizerId)) {
    throw new Error("Le panier ne peut contenir que des séjours d'un même organisme.");
  }
  const organizerSettings = await readOrganizerCheckoutSettings(organizerId);
  const requestKind = resolveOrderRequestKind(input.contact, organizerSettings);
  const isPartnerTotalCoverage =
    !requestKind &&
    normalizePartnerFinanceMode(pricing.financeMode) === 'TOTAL' &&
    (pricing.financeFamilyPayableTotalCents ?? 0) === 0;
  const requestedAt = new Date().toISOString();
  const paidAt = isPartnerTotalCoverage ? requestedAt : null;
  const initialStatus = isPartnerTotalCoverage
    ? ('PAID' as Database['public']['Enums']['order_status'])
    : resolveInitialOrderStatus(input.contact, organizerSettings);
  const immediatePaymentAmountCents = computeImmediatePaymentAmountCents(
    pricing.financeFamilyPayableTotalCents ?? 0,
    input.contact.paymentMode
  );

  if (input.contact.paymentMode === 'CV_CONNECT' && !organizerSettings.accepts_ancv_connect) {
    throw new Error("Cet organisme n'accepte pas ANCV Connect.");
  }
  if (input.contact.paymentMode === 'CV_PAPER' && !organizerSettings.accepts_ancv_paper) {
    throw new Error("Cet organisme n'accepte pas les chèques-vacances papier.");
  }
  if (input.contact.vacafNumber.trim() && !organizerSettings.is_vacaf_approved) {
    throw new Error("Cet organisme n'est pas agréé VACAF National.");
  }
  const collectivity = await resolveCheckoutCollectivityForUser({
    userId: input.clientUserId,
    requestedCode: input.contact.cseOrganization
  });

  const { data: existingPaymentRow } = await supabase
    .from('payments')
    .select(
      'id,order_id,status,amount_cents,monetico_transaction_id,monetico_reference,raw_payload,orders!inner(id,client_user_id,status)'
    )
    .eq('orders.client_user_id', input.clientUserId)
    .neq('status', 'FAILED')
    .neq('orders.status', 'CANCELLED')
    .filter('raw_payload->>checkoutId', 'eq', input.checkoutId)
    .limit(1)
    .maybeSingle();

  if (existingPaymentRow?.id && existingPaymentRow.order_id) {
    const reference = existingPaymentRow.monetico_reference || createMoneticoReference(input.checkoutId, existingPaymentRow.order_id);
    const transactionId =
      existingPaymentRow.monetico_transaction_id ||
      createMoneticoMockTransactionId(input.checkoutId, existingPaymentRow.id);

    const moneticoPayload = createMoneticoPayload({
      checkoutId: input.checkoutId,
      orderId: existingPaymentRow.order_id,
      paymentId: existingPaymentRow.id,
      reference,
      transactionId,
      amountCents: existingPaymentRow.amount_cents ?? immediatePaymentAmountCents,
      currency: pricing.currency,
      customerEmail: input.contact.email
    });

    await supabase
      .from('payments')
      .update({
        monetico_transaction_id: transactionId,
        monetico_reference: reference
      })
      .eq('id', existingPaymentRow.id);

    return {
      orderId: existingPaymentRow.order_id,
      paymentId: existingPaymentRow.id,
      pricing,
      monetico: moneticoPayload
    };
  }

  await createOrUpdateClientProfile(input.clientUserId, input.contact, collectivity?.collectivityId ?? null);

  const order = await insertOrderWithCompatibilityFallback({
    clientUserId: input.clientUserId,
    collectivityId: collectivity?.collectivityId ?? null,
    initialStatus,
    requestedAt,
    paidAt,
    requestKind,
    contact: input.contact,
    financeFamilyPayableTotalCents: pricing.financeFamilyPayableTotalCents
  });

  const orderItemIds: string[] = [];
  const orderItemsForCollectivitySnapshot: Array<{ id: string; totalCents: number }> = [];

  for (const pricedItem of pricing.items) {
    const participant = participantByItem.get(pricedItem.cartItemId);
    if (!participant) {
      throw new CheckoutValidationError('Participant manquant pour un article du panier.');
    }

    const { data: orderItem, error: orderItemError } = await supabase
      .from('order_items')
      .insert({
        order_id: order.id,
        organizer_id: pricedItem.organizerId,
        session_id: pricedItem.sessionId,
        child_first_name: participant.childFirstName,
        child_last_name: participant.childLastName,
        child_birthdate: participant.childBirthdate,
        insurance_option_id: pricedItem.insuranceOptionId,
        transport_option_id: pricedItem.transportOptionId,
        base_price_cents: pricedItem.basePriceCents,
        options_price_cents: pricedItem.optionsPriceCents,
        total_price_cents: pricedItem.totalPriceCents
      })
      .select('id,session_id')
      .single();

    if (orderItemError || !orderItem) {
      if (orderItemError) {
        console.error('checkout: insertion order_items échouée', orderItemError);
      }
      throw new Error('Impossible de créer les lignes de commande.');
    }

    orderItemIds.push(orderItem.id);
    orderItemsForCollectivitySnapshot.push({
      id: orderItem.id,
      totalCents: pricedItem.totalPriceCents
    });

    if (pricedItem.extraOptionId && pricedItem.extraOptionLabel) {
      const { error: extraInsertError } = await supabase.from('order_item_extra_options').insert({
        order_item_id: orderItem.id,
        stay_extra_option_id: pricedItem.extraOptionId,
        label_snapshot: pricedItem.extraOptionLabel,
        amount_cents_snapshot: pricedItem.extraOptionPriceCents
      });

      if (extraInsertError) {
        throw new Error('Impossible de sauvegarder les options supplémentaires.');
      }
    }

    const expiresAt = new Date(Date.now() + HOLD_MINUTES * 60 * 1000).toISOString();
    const { error: holdError } = await supabase.from('session_holds').insert({
      order_item_id: orderItem.id,
      session_id: orderItem.session_id,
      expires_at: expiresAt,
      status: 'ACTIVE'
    });

    if (holdError) {
      throw new Error('Impossible de réserver temporairement la session.');
    }
  }

  if (collectivity?.collectivityId) {
    await snapshotCollectivityContributions({
      collectivityId: collectivity.collectivityId,
      approvedAt: requestedAt,
      orderItems: orderItemsForCollectivitySnapshot
    });
  }

  const reference = createMoneticoReference(input.checkoutId, order.id);
  const { data: payment, error: paymentInsertError } = await supabase
    .from('payments')
    .insert({
      order_id: order.id,
      amount_cents: immediatePaymentAmountCents,
      currency: pricing.currency,
      status: isPartnerTotalCoverage ? 'SUCCEEDED' : 'PENDING',
      monetico_reference: reference,
      raw_payload: {
        checkoutId: input.checkoutId,
        contact: input.contact,
        participants: input.participants,
        orderItemIds
      }
    })
    .select('id')
    .single();

  if (paymentInsertError || !payment) {
    if (paymentInsertError) {
      console.error('checkout: insertion payments échouée', paymentInsertError);
    }
    throw new Error('Impossible de créer le paiement.');
  }

  const transactionId = createMoneticoMockTransactionId(input.checkoutId, payment.id);
  const moneticoPayload = createMoneticoPayload({
    checkoutId: input.checkoutId,
    orderId: order.id,
    paymentId: payment.id,
    reference,
    transactionId,
    amountCents: immediatePaymentAmountCents,
    currency: pricing.currency,
    customerEmail: input.contact.email
  });

  const { error: paymentUpdateError } = await supabase
    .from('payments')
    .update({
      monetico_transaction_id: transactionId,
      raw_payload: {
        checkoutId: input.checkoutId,
        contact: input.contact,
        participants: input.participants,
        orderItemIds,
        monetico: moneticoPayload
      }
    })
    .eq('id', payment.id);

  if (paymentUpdateError) {
    throw new Error('Impossible de synchroniser le paiement Monetico.');
  }

  if (isPartnerTotalCoverage && orderItemIds.length > 0) {
    const { error: holdsError } = await supabase
      .from('session_holds')
      .update({ status: 'CONVERTED' })
      .in('order_item_id', orderItemIds)
      .eq('status', 'ACTIVE');

    if (holdsError) {
      throw new Error('Impossible de convertir les holds de session.');
    }

    const { recordCommissionFeesOnOrderPaid } = await import('@/lib/resacolo-fee-ledger.server');
    await recordCommissionFeesOnOrderPaid(supabase, order.id, paidAt ?? requestedAt);
  }

  await markCheckoutCartConverted(input.checkoutId, order.id);

  return {
    orderId: order.id,
    paymentId: payment.id,
    pricing,
    monetico: moneticoPayload
  };
}

export async function findPaymentByMoneticoReference(reference: string) {
  const supabase = getServerSupabaseClient();
  const { data, error } = await supabase
    .from('payments')
    .select('id,status,order_id,monetico_reference')
    .eq('monetico_reference', reference)
    .limit(1)
    .maybeSingle();
  if (error) {
    throw new Error(`Impossible de retrouver le paiement Monetico: ${error.message}`);
  }
  return data;
}

export async function markOrderPaid(input: {
  orderId: string;
  paymentId: string;
  providerPayload?: unknown;
  paymentStatus?: string;
}) {
  const supabase = getServerSupabaseClient();
  const { data: existingPayment } = await supabase
    .from('payments')
    .select('amount_cents,raw_payload')
    .eq('id', input.paymentId)
    .eq('order_id', input.orderId)
    .maybeSingle();

  const mergedPayload: Json = {
    ...asJsonRecord(existingPayment?.raw_payload),
    providerUpdate: toJsonValue(input.providerPayload),
    updatedAt: new Date().toISOString()
  };

  const { error: paymentError } = await supabase
    .from('payments')
    .update({
      status: input.paymentStatus ?? 'SUCCEEDED',
      raw_payload: mergedPayload
    })
    .eq('id', input.paymentId)
    .eq('order_id', input.orderId);

  if (paymentError) {
    throw new Error('Impossible de mettre à jour le paiement.');
  }

  const paidAt = new Date().toISOString();
  const { data: orderItems } = await supabase
    .from('order_items')
    .select('id,total_price_cents')
    .eq('order_id', input.orderId);
  const orderItemIds = (orderItems ?? []).map((item) => item.id);
  const { data: contributionRows } = orderItemIds.length
    ? await supabase
        .from('collectivity_contributions')
        .select('order_item_id,mode,fixed_cents,percent_value,cap_cents,status')
        .in('order_item_id', orderItemIds)
        .eq('status', 'APPROVED')
    : { data: [] as Array<{
        order_item_id: string;
        mode: string;
        fixed_cents: number | null;
        percent_value: number | null;
        cap_cents: number | null;
        status: Database['public']['Enums']['contribution_status'];
      }> };
  const { data: orderRow } = await supabase
    .from('orders')
    .select('external_aid_cents,external_paid_cents')
    .eq('id', input.orderId)
    .maybeSingle();
  const totalCents = (orderItems ?? []).reduce((sum, item) => sum + (item.total_price_cents ?? 0), 0);
  const contributionByOrderItemId = new Map((contributionRows ?? []).map((row) => [row.order_item_id, row]));
  const partnerContributionCents = (orderItems ?? []).reduce((sum, item) => {
    const contribution = contributionByOrderItemId.get(item.id);
    if (!contribution) return sum;
    return (
      sum +
      computePartnerContributionSnapshotCents({
        mode: contribution.mode,
        totalCents: item.total_price_cents ?? 0,
        percentValue: contribution.percent_value,
        fixedCents: contribution.fixed_cents,
        capCents: contribution.cap_cents
      })
    );
  }, 0);
  const familyPayableTotalCents = Math.max(0, totalCents - partnerContributionCents);
  const paymentMode = parsePaymentModeFromPayload(existingPayment?.raw_payload);
  const onlinePaidCents = Math.max(0, existingPayment?.amount_cents ?? 0);
  const nextStatus = resolvePaidOrderStatus({
    totalCents: familyPayableTotalCents,
    paymentMode,
    externalAidCents: orderRow?.external_aid_cents ?? 0,
    externalPaidCents: orderRow?.external_paid_cents ?? 0,
    onlinePaidCents
  });
  const { error: orderError } = await supabase
    .from('orders')
    .update({
      status: nextStatus,
      paid_at: nextStatus === 'PAID' ? paidAt : null,
      partially_paid_at: nextStatus === 'PARTIALLY_PAID' ? paidAt : null
    })
    .eq('id', input.orderId);

  if (orderError) {
    throw new Error('Impossible de mettre à jour la commande.');
  }
  if (orderItemIds.length > 0) {
    const { error: holdsError } = await supabase
      .from('session_holds')
      .update({ status: 'CONVERTED' })
      .in('order_item_id', orderItemIds)
      .eq('status', 'ACTIVE');

    if (holdsError) {
      throw new Error('Impossible de convertir les holds de session.');
    }
  }

  if (nextStatus === 'PAID') {
    const { recordCommissionFeesOnOrderPaid } = await import('@/lib/resacolo-fee-ledger.server');
    await recordCommissionFeesOnOrderPaid(supabase, input.orderId, paidAt);
  }

  return {
    orderId: input.orderId,
    status: nextStatus,
    paidAt: nextStatus === 'PAID' ? paidAt : null
  };
}

export async function failOrderPayment(input: {
  orderId: string;
  paymentId: string;
  providerPayload?: unknown;
}) {
  const supabase = getServerSupabaseClient();
  const { data: existingPayment } = await supabase
    .from('payments')
    .select('raw_payload')
    .eq('id', input.paymentId)
    .eq('order_id', input.orderId)
    .maybeSingle();

  const mergedPayload: Json = {
    ...asJsonRecord(existingPayment?.raw_payload),
    providerUpdate: toJsonValue(input.providerPayload),
    updatedAt: new Date().toISOString()
  };

  const { error } = await supabase
    .from('payments')
    .update({
      status: 'FAILED',
      raw_payload: mergedPayload
    })
    .eq('id', input.paymentId)
    .eq('order_id', input.orderId);

  if (error) {
    throw new Error('Impossible de marquer le paiement en échec.');
  }

  return {
    orderId: input.orderId,
    status: 'FAILED'
  };
}
