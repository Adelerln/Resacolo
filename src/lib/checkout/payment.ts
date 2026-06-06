import { getSession } from '@/lib/auth/session';
import { getServerSupabaseClient } from '@/lib/supabase/server';
import { resolveCheckoutCollectivityForUser } from '@/lib/account-profile/server';
import { markCheckoutCartConverted } from '@/lib/checkout/cart-tracking';
import type { CartItem } from '@/types/cart';
import {
  getOrganizerSelection,
  type CheckoutContact,
  type CheckoutParticipant,
  type CheckoutPricing,
  type CheckoutPricingItem
} from '@/types/checkout';
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
  isPartnerFullCoverageCheckout,
  normalizePartnerFinanceMode
} from '@/lib/partner-offers';
import { isBalancePaymentPayload } from '@/lib/order-balance-payment';
import { normalizeVacafNumberInput, validateVacafNumber } from '@/lib/vacaf-number';
import {
  normalizeAncvConnectMatriculeInput,
  resolveAncvConnectOrderPayableTotalCents,
  validateAncvConnectAmountAgainstOrderTotal,
  validateAncvConnectMatricule
} from '@/lib/ancv-connect-matricule';
import { isMissingAnyColumnError } from '@/lib/supabase-schema-errors';

type PrepareCheckoutPaymentInput = {
  checkoutId: string;
  clientUserId: string;
  items: CartItem[];
  contact: CheckoutContact;
  participants: CheckoutParticipant[];
};

type PrepareCheckoutPaymentResult = {
  isBatch: boolean;
  orderId: string;
  paymentId: string;
  orderIds: string[];
  payments: Array<{ orderId: string; paymentId: string; organizerId: string; organizerName: string }>;
  confirmationPath: string;
  pricing: CheckoutPricing;
  monetico: MoneticoPayload;
};

type PrepareCheckoutPaymentGroupResult = {
  organizerId: string;
  organizerName: string;
  orderId: string;
  paymentId: string;
  immediatePaymentAmountCents: number;
  isPartnerTotalCoverage: boolean;
  requestKind: ReturnType<typeof resolveOrderRequestKind>;
};

const HOLD_MINUTES = 30;
type CollectivityFinanceRow = Pick<
  Database['public']['Tables']['collectivities']['Row'],
  'id' | 'finance_mode' | 'finance_percent_value' | 'finance_fixed_cents'
>;
type ClientChildRow = Pick<
  Database['public']['Tables']['client_children']['Row'],
  'id' | 'user_id' | 'first_name' | 'last_name' | 'birthdate' | 'gender' | 'additional_info'
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
    if (!participant.childId?.trim()) {
      throw new CheckoutValidationError(`Sélection enfant manquante pour « ${item.title} ».`);
    }
  }

  return byItemId;
}

async function readSelectedChildrenForCheckout(
  clientUserId: string,
  participants: CheckoutParticipant[]
) {
  const childIds = Array.from(
    new Set(
      participants
        .map((participant) => participant.childId?.trim() ?? '')
        .filter((value): value is string => value.length > 0)
    )
  );
  if (childIds.length === 0) {
    return new Map<string, ClientChildRow>();
  }

  const supabase = getServerSupabaseClient();
  const { data, error } = await supabase
    .from('client_children')
    .select('id,user_id,first_name,last_name,birthdate,gender,additional_info')
    .eq('user_id', clientUserId)
    .in('id', childIds);

  if (error) {
    throw new Error(`Impossible de charger les enfants sélectionnés : ${error.message}`);
  }

  const rows = data ?? [];
  const byId = new Map(rows.map((row) => [row.id, row]));
  for (const childId of childIds) {
    if (!byId.has(childId)) {
      throw new CheckoutValidationError("Un enfant sélectionné n'est plus disponible sur votre compte.");
    }
  }

  return byId;
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

function createMoneticoBatchReference(checkoutId: string) {
  return `BATCH-${checkoutId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 18).toUpperCase()}`.slice(0, 24);
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

function buildEffectiveContactForOrganizer(
  contact: CheckoutContact,
  organizerId: string
): CheckoutContact {
  const selection = getOrganizerSelection(contact, organizerId);
  return {
    ...contact,
    paymentMode: selection.paymentMode,
    vacafNumber: selection.vacafNumber,
    ancvConnectMatricule: selection.ancvConnectMatricule,
    ancvConnectAmount: selection.ancvConnectAmount
  };
}

function buildPricingForOrganizerGroup(items: CheckoutPricingItem[], currency: CheckoutPricing['currency']): CheckoutPricing {
  const totalCents = items.reduce((sum, item) => sum + item.totalPriceCents, 0);
  const financePartnerContributionTotalCents = items.reduce(
    (sum, item) => sum + Math.max(0, item.financePartnerContributionCents ?? 0),
    0
  );
  const financeRequiresQuote = items.some((item) => item.financeRequiresQuote);
  const financeFamilyPayableTotalCents = financeRequiresQuote
    ? null
    : items.reduce((sum, item) => sum + Math.max(0, item.financeFamilyPayableCents ?? item.totalPriceCents), 0);
  const familyTotalCentsAfterAid = items.reduce((sum, item) => sum + (item.familyCentsAfterAid ?? item.totalPriceCents), 0);
  const cseTotalAidCents = items.reduce((sum, item) => sum + (item.cseAidCents ?? 0), 0);

  return {
    items,
    totalCents,
    financeMode: items[0]?.financeMode ?? null,
    financePartnerContributionTotalCents,
    financeFamilyPayableTotalCents,
    financePercentValue: items[0]?.financePercentValue ?? null,
    financeFixedCents: items[0]?.financeFixedCents ?? null,
    financeRequiresQuote,
    familyTotalCentsAfterAid,
    cseTotalAidCents,
    currency
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
  return 'PENDING_PAYMENT' as const;
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
    vacaf_number_snapshot: normalizeVacafNumberInput(input.contact.vacafNumber) || null,
    ancv_connect_matricule: normalizeAncvConnectMatriculeInput(input.contact.ancvConnectMatricule) || null,
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
  const session = await getSession();
  const clientUserId = session?.isClient && session.userId ? session.userId : input.clientUserId;
  const participantByItem = validateParticipants(input.items, input.participants);
  const pricing = await repriceCart(input.items);
  const organizerIds = Array.from(
    new Set(pricing.items.map((item) => item.organizerId).filter(Boolean))
  );
  if (organizerIds.length === 0) {
    throw new Error("Impossible d'identifier l'organisme de la réservation.");
  }
  const organizerSettingsEntries = await Promise.all(
    organizerIds.map(async (organizerId) => [organizerId, await readOrganizerCheckoutSettings(organizerId)] as const)
  );
  const organizerSettingsById = new Map(organizerSettingsEntries);
  const collectivity = await resolveCheckoutCollectivityForUser({
    userId: clientUserId,
    requestedCode: input.contact.cseOrganization
  });

  const { data: existingPaymentRows } = await supabase
    .from('payments')
    .select(
      'id,order_id,status,amount_cents,monetico_transaction_id,monetico_reference,raw_payload,orders!inner(id,client_user_id,status)'
    )
    .eq('orders.client_user_id', clientUserId)
    .neq('status', 'FAILED')
    .neq('orders.status', 'CANCELLED')
    .filter('raw_payload->>checkoutId', 'eq', input.checkoutId)
    .order('updated_at', { ascending: true });

  const existingRows = (existingPaymentRows ?? []).filter((row) => row.id && row.order_id);
  if (existingRows.length > 0) {
    const onlineRows = existingRows.filter((row) => (row.amount_cents ?? 0) > 0);
    const primaryRow = existingRows[0];
    const primaryOnlineRow = onlineRows[0] ?? primaryRow;
    const reference =
      existingRows.find((row) => row.monetico_reference)?.monetico_reference ||
      (existingRows.length > 1
        ? createMoneticoBatchReference(input.checkoutId)
        : createMoneticoReference(input.checkoutId, primaryRow.order_id));
    const transactionId =
      existingRows.find((row) => row.monetico_transaction_id)?.monetico_transaction_id ||
      createMoneticoMockTransactionId(input.checkoutId, primaryOnlineRow.id);
    const moneticoPayload = createMoneticoPayload({
      checkoutId: input.checkoutId,
      orderId: primaryOnlineRow.order_id,
      paymentId: primaryOnlineRow.id,
      reference,
      transactionId,
      amountCents: onlineRows.reduce((sum, row) => sum + Math.max(0, row.amount_cents ?? 0), 0),
      currency: pricing.currency,
      customerEmail: input.contact.email
    });

    await supabase
      .from('payments')
      .update({
        monetico_transaction_id: transactionId,
        monetico_reference: reference
      })
      .in('id', existingRows.map((row) => row.id));

    return {
      isBatch: existingRows.length > 1,
      orderId: primaryRow.order_id,
      paymentId: primaryRow.id,
      orderIds: existingRows.map((row) => row.order_id),
      payments: existingRows.map((row) => {
        const rawPayload = asJsonRecord(row.raw_payload);
        return {
          orderId: row.order_id,
          paymentId: row.id,
          organizerId: String(rawPayload.organizerId ?? pricing.items[0]?.organizerId ?? ''),
          organizerName: String(rawPayload.organizerName ?? 'Organisme')
        };
      }),
      confirmationPath:
        existingRows.length > 1
          ? `/checkout/confirmation?checkoutId=${encodeURIComponent(input.checkoutId)}`
          : `/checkout/confirmation/${primaryRow.order_id}`,
      pricing,
      monetico: moneticoPayload
    };
  }

  const childById = await readSelectedChildrenForCheckout(clientUserId, input.participants);
  await createOrUpdateClientProfile(clientUserId, input.contact, collectivity?.collectivityId ?? null);
  const pricedItemsByOrganizer = new Map<string, CheckoutPricingItem[]>();
  for (const pricedItem of pricing.items) {
    const existing = pricedItemsByOrganizer.get(pricedItem.organizerId) ?? [];
    existing.push(pricedItem);
    pricedItemsByOrganizer.set(pricedItem.organizerId, existing);
  }

  const requestedAt = new Date().toISOString();
  const groupResults: Array<PrepareCheckoutPaymentGroupResult & { paymentRawPayload: Record<string, Json | undefined> }> =
    [];

  for (const organizerId of organizerIds) {
    const organizerSettings = organizerSettingsById.get(organizerId);
    const organizerItems = pricedItemsByOrganizer.get(organizerId) ?? [];
    if (!organizerSettings || organizerItems.length === 0) continue;

    const effectiveContact = buildEffectiveContactForOrganizer(input.contact, organizerId);
    const requestKind = resolveOrderRequestKind(effectiveContact, organizerSettings);
    const organizerPricing = buildPricingForOrganizerGroup(organizerItems, pricing.currency);
    const isPartnerTotalCoverage = !requestKind && isPartnerFullCoverageCheckout(organizerPricing);
    const paidAt = isPartnerTotalCoverage ? requestedAt : null;
    const initialStatus = isPartnerTotalCoverage
      ? ('PAID' as Database['public']['Enums']['order_status'])
      : resolveInitialOrderStatus(effectiveContact, organizerSettings);
    const immediatePaymentAmountCents = computeImmediatePaymentAmountCents(
      organizerPricing.financeFamilyPayableTotalCents ?? 0,
      effectiveContact.paymentMode
    );

    if (effectiveContact.paymentMode === 'CV_CONNECT' && !organizerSettings.accepts_ancv_connect) {
      throw new Error(`L'organisme « ${organizerSettings.name} » n'accepte pas ANCV Connect.`);
    }
    if (effectiveContact.paymentMode === 'CV_PAPER' && !organizerSettings.accepts_ancv_paper) {
      throw new Error(`L'organisme « ${organizerSettings.name} » n'accepte pas les chèques-vacances papier.`);
    }
    if (effectiveContact.vacafNumber.trim() && !organizerSettings.is_vacaf_approved) {
      throw new Error(`L'organisme « ${organizerSettings.name} » n'est pas agréé VACAF National.`);
    }
    if (effectiveContact.vacafNumber.trim()) {
      const vacafError = validateVacafNumber(effectiveContact.vacafNumber);
      if (vacafError) {
        throw new CheckoutValidationError(vacafError);
      }
    }
    if (effectiveContact.paymentMode === 'CV_CONNECT') {
      const ancvMatriculeError = validateAncvConnectMatricule(effectiveContact.ancvConnectMatricule);
      if (ancvMatriculeError) {
        throw new CheckoutValidationError(ancvMatriculeError);
      }
      const orderPayableTotalCents = resolveAncvConnectOrderPayableTotalCents(
        organizerPricing.financeFamilyPayableTotalCents ?? null,
        organizerPricing.totalCents
      );
      const ancvAmountError = validateAncvConnectAmountAgainstOrderTotal(
        effectiveContact.ancvConnectAmount,
        orderPayableTotalCents
      );
      if (ancvAmountError) {
        throw new CheckoutValidationError(ancvAmountError);
      }
    }

    const order = await insertOrderWithCompatibilityFallback({
      clientUserId,
      collectivityId: collectivity?.collectivityId ?? null,
      initialStatus,
      requestedAt,
      paidAt,
      requestKind,
      contact: effectiveContact,
      financeFamilyPayableTotalCents: organizerPricing.financeFamilyPayableTotalCents
    });

    const orderItemIds: string[] = [];
    const orderItemsForCollectivitySnapshot: Array<{ id: string; totalCents: number }> = [];
    const orderItemSnapshots: Array<{ orderItemId: string; transportDisplayLine: string | null }> = [];
    const organizerParticipants: CheckoutParticipant[] = [];

    for (const pricedItem of organizerItems) {
      const participant = participantByItem.get(pricedItem.cartItemId);
      if (!participant) {
        throw new CheckoutValidationError('Participant manquant pour un article du panier.');
      }
      const child = participant.childId ? childById.get(participant.childId) ?? null : null;
      if (!child) {
        throw new CheckoutValidationError('Enfant sélectionné introuvable pour un article du panier.');
      }

      const { data: orderItem, error: orderItemError } = await supabase
        .from('order_items')
        .insert({
          order_id: order.id,
          organizer_id: pricedItem.organizerId,
          session_id: pricedItem.sessionId,
          child_id: child.id,
          child_first_name: child.first_name,
          child_last_name: child.last_name,
          child_birthdate: child.birthdate,
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
      orderItemSnapshots.push({
        orderItemId: orderItem.id,
        transportDisplayLine: pricedItem.transportDisplayLine ?? pricedItem.transportLabel ?? null
      });
      organizerParticipants.push({
        ...participant,
        childId: child.id,
        childFirstName: child.first_name,
        childLastName: child.last_name,
        childBirthdate: child.birthdate,
        childGender: child.gender === 'MASCULIN' || child.gender === 'FEMININ' ? child.gender : '',
        additionalInfo: child.additional_info
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

    const paymentRawPayload = {
      checkoutId: input.checkoutId,
      organizerId,
      organizerName: organizerSettings.name,
      contact: effectiveContact,
      participants: organizerParticipants,
      orderItemIds,
      orderItemSnapshots
    };
    const { data: payment, error: paymentInsertError } = await supabase
      .from('payments')
      .insert({
        order_id: order.id,
        amount_cents: immediatePaymentAmountCents,
        currency: pricing.currency,
        status: isPartnerTotalCoverage ? 'SUCCEEDED' : 'PENDING',
        raw_payload: paymentRawPayload
      })
      .select('id')
      .single();

    if (paymentInsertError || !payment) {
      if (paymentInsertError) {
        console.error('checkout: insertion payments échouée', paymentInsertError);
      }
      throw new Error('Impossible de créer le paiement.');
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

    groupResults.push({
      organizerId,
      organizerName: organizerSettings.name,
      orderId: order.id,
      paymentId: payment.id,
      immediatePaymentAmountCents,
      isPartnerTotalCoverage,
      requestKind,
      paymentRawPayload
    });
  }

  const primaryGroup = groupResults[0];
  if (!primaryGroup) {
    throw new Error('Impossible de créer la commande.');
  }

  const onlineGroups = groupResults.filter((group) => group.immediatePaymentAmountCents > 0);
  const primaryOnlineGroup = onlineGroups[0] ?? primaryGroup;
  const reference =
    groupResults.length > 1
      ? createMoneticoBatchReference(input.checkoutId)
      : createMoneticoReference(input.checkoutId, primaryGroup.orderId);
  const transactionId = createMoneticoMockTransactionId(input.checkoutId, primaryOnlineGroup.paymentId);
  const moneticoPayload = createMoneticoPayload({
    checkoutId: input.checkoutId,
    orderId: primaryOnlineGroup.orderId,
    paymentId: primaryOnlineGroup.paymentId,
    reference,
    transactionId,
    amountCents: onlineGroups.reduce((sum, group) => sum + group.immediatePaymentAmountCents, 0),
    currency: pricing.currency,
    customerEmail: input.contact.email
  });
  const allOrderIds = groupResults.map((group) => group.orderId);
  const allPaymentIds = groupResults.map((group) => group.paymentId);

  for (const group of groupResults) {
    const shouldAttachMonetico = group.immediatePaymentAmountCents > 0;
    const { error: paymentUpdateError } = await supabase
      .from('payments')
      .update({
        monetico_reference: shouldAttachMonetico ? reference : null,
        monetico_transaction_id: shouldAttachMonetico ? transactionId : null,
        raw_payload: {
          ...group.paymentRawPayload,
          batchOrderIds: allOrderIds,
          batchPaymentIds: allPaymentIds,
          isBatch: groupResults.length > 1,
          monetico: shouldAttachMonetico ? moneticoPayload : null
        }
      })
      .eq('id', group.paymentId);

    if (paymentUpdateError) {
      throw new Error('Impossible de synchroniser le paiement Monetico.');
    }
  }

  await markCheckoutCartConverted(input.checkoutId, primaryGroup.orderId);

  return {
    isBatch: groupResults.length > 1,
    orderId: primaryGroup.orderId,
    paymentId: primaryGroup.paymentId,
    orderIds: allOrderIds,
    payments: groupResults.map((group) => ({
      orderId: group.orderId,
      paymentId: group.paymentId,
      organizerId: group.organizerId,
      organizerName: group.organizerName
    })),
    confirmationPath:
      groupResults.length > 1
        ? `/checkout/confirmation?checkoutId=${encodeURIComponent(input.checkoutId)}`
        : `/checkout/confirmation/${primaryGroup.orderId}`,
    pricing,
    monetico: moneticoPayload
  };
}

export async function findPaymentsByMoneticoReference(reference: string) {
  const supabase = getServerSupabaseClient();
  const { data, error } = await supabase
    .from('payments')
    .select('id,status,order_id,monetico_reference')
    .eq('monetico_reference', reference)
    .order('created_at', { ascending: true });
  if (error) {
    throw new Error(`Impossible de retrouver le paiement Monetico: ${error.message}`);
  }
  return data ?? [];
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
  const { data: allPayments } = await supabase
    .from('payments')
    .select('id,status,amount_cents')
    .eq('order_id', input.orderId);
  const onlinePaidCents = (allPayments ?? []).reduce((sum, payment) => {
    if (payment.id === input.paymentId) {
      return sum + Math.max(0, existingPayment?.amount_cents ?? 0);
    }
    if (payment.status === 'SUCCEEDED') {
      return sum + Math.max(0, payment.amount_cents ?? 0);
    }
    return sum;
  }, 0);
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

  if (isBalancePaymentPayload(existingPayment?.raw_payload)) {
    return {
      orderId: input.orderId,
      status: 'FAILED'
    };
  }

  const cancelledAt = new Date().toISOString();
  const { error: orderError } = await supabase
    .from('orders')
    .update({
      status: 'CANCELLED',
      cancelled_at: cancelledAt,
      cancellation_reason: 'PAYMENT_FAILED'
    })
    .eq('id', input.orderId);

  if (orderError) {
    throw new Error('Impossible de marquer la commande en échec.');
  }

  const { data: orderItems } = await supabase
    .from('order_items')
    .select('id')
    .eq('order_id', input.orderId);

  const orderItemIds = (orderItems ?? []).map((item) => item.id);
  if (orderItemIds.length > 0) {
    const { error: holdsError } = await supabase
      .from('session_holds')
      .update({ status: 'ABANDONED' })
      .in('order_item_id', orderItemIds)
      .eq('status', 'ACTIVE');

    if (holdsError) {
      throw new Error('Impossible de libérer les holds de session.');
    }
  }

  return {
    orderId: input.orderId,
    status: 'FAILED'
  };
}
