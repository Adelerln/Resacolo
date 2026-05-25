import { getServerSupabaseClient } from '@/lib/supabase/server';
import { resolveCheckoutCollectivityForUser } from '@/lib/account-profile/server';
import type { CartItem } from '@/types/cart';
import type { CheckoutContact, CheckoutParticipant, CheckoutPricing } from '@/types/checkout';
import type { Json } from '@/types/supabase';
import { CheckoutValidationError, repriceCart } from '@/lib/checkout/pricing';
import { buildMoneticoLivePayload, getMoneticoMode, type MoneticoPayload } from '@/lib/checkout/monetico';

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

export async function prepareCheckoutPayment(input: PrepareCheckoutPaymentInput): Promise<PrepareCheckoutPaymentResult> {
  const supabase = getServerSupabaseClient();
  const participantByItem = validateParticipants(input.items, input.participants);
  const pricing = await repriceCart(input.items);
  const collectivity = await resolveCheckoutCollectivityForUser({
    userId: input.clientUserId,
    requestedCode: input.contact.cseOrganization
  });

  const { data: existingPaymentRow } = await supabase
    .from('payments')
    .select('id,order_id,status,monetico_transaction_id,monetico_reference,raw_payload,orders!inner(id,client_user_id,status)')
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
      amountCents: pricing.totalCents,
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

  const requestedAt = new Date().toISOString();

  const { data: order, error: orderError } = await supabase
    .from('orders')
    .insert({
      client_user_id: input.clientUserId,
      collectivity_id: collectivity?.collectivityId ?? null,
      status: 'REQUESTED',
      requested_at: requestedAt
    })
    .select('id')
    .single();

  if (orderError || !order) {
    throw new Error('Impossible de créer la commande.');
  }

  const orderItemIds: string[] = [];

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

  const reference = createMoneticoReference(input.checkoutId, order.id);
  const { data: payment, error: paymentInsertError } = await supabase
    .from('payments')
    .insert({
      order_id: order.id,
      amount_cents: pricing.totalCents,
      currency: pricing.currency,
      status: 'PENDING',
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
    amountCents: pricing.totalCents,
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
    .select('raw_payload')
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
  const { error: orderError } = await supabase
    .from('orders')
    .update({
      status: 'PAID',
      paid_at: paidAt
    })
    .eq('id', input.orderId);

  if (orderError) {
    throw new Error('Impossible de mettre à jour la commande.');
  }

  const { data: orderItems } = await supabase.from('order_items').select('id').eq('order_id', input.orderId);
  const orderItemIds = (orderItems ?? []).map((item) => item.id);

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

  const { recordCommissionFeesOnOrderPaid } = await import('@/lib/resacolo-fee-ledger.server');
  await recordCommissionFeesOnOrderPaid(supabase, input.orderId, paidAt);

  return {
    orderId: input.orderId,
    status: 'PAID',
    paidAt
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
