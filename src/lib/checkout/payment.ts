import { getServerSupabaseClient } from '@/lib/supabase/server';
import type { CartItem } from '@/types/cart';
import type { CheckoutContact, CheckoutParticipant, CheckoutPricing } from '@/types/checkout';
import type { Json } from '@/types/supabase';
import { CheckoutValidationError, repriceCart } from '@/lib/checkout/pricing';

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
  monetico: {
    reference: string;
    transactionId: string;
    paymentUrl: string;
    testMode: true;
  };
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

async function createOrUpdateClientProfile(clientUserId: string, contact: CheckoutContact) {
  const supabase = getServerSupabaseClient();
  const { error } = await supabase.from('clients').upsert(
    {
      user_id: clientUserId,
      full_name: null,
      phone: contact.phone,
      collectivity_id: null
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

  await createOrUpdateClientProfile(input.clientUserId, input.contact);

  const nowIso = new Date().toISOString();
  const requestedAt = nowIso;

  const { data: order, error: orderError } = await supabase
    .from('orders')
    .insert({
      client_user_id: input.clientUserId,
      collectivity_id: null,
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

  const { data: payment, error: paymentInsertError } = await supabase
    .from('payments')
    .insert({
      order_id: order.id,
      amount_cents: pricing.totalCents,
      currency: pricing.currency,
      status: 'PENDING',
      monetico_reference: input.checkoutId,
      raw_payload: {
        checkoutId: input.checkoutId,
        contact: input.contact,
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
  const moneticoMock = {
    reference: input.checkoutId,
    transactionId,
    paymentUrl: `/checkout/paiement?checkoutId=${encodeURIComponent(input.checkoutId)}`,
    testMode: true as const
  };

  const { error: paymentUpdateError } = await supabase
    .from('payments')
    .update({
      monetico_transaction_id: transactionId,
      raw_payload: {
        checkoutId: input.checkoutId,
        contact: input.contact,
        orderItemIds,
        monetico: moneticoMock
      }
    })
    .eq('id', payment.id);

  if (paymentUpdateError) {
    throw new Error('Impossible de synchroniser le paiement Monetico mock.');
  }

  return {
    orderId: order.id,
    paymentId: payment.id,
    pricing,
    monetico: moneticoMock
  };
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
