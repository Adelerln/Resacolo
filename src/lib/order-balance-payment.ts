import { getServerSupabaseClient } from '@/lib/supabase/server';
import {
  createCheckoutPspPayload,
  toLegacyMoneticoResponseShape
} from '@/lib/checkout/payment-provider';
import { computeRemainingBalanceCents } from '@/lib/order-workflow';
import { computePartnerContributionSnapshotCents } from '@/lib/partner-offers';
import type { Json, Database } from '@/types/supabase';
import type { MoneticoPayload } from '@/lib/checkout/monetico';

const BALANCE_PAYMENT_KIND = 'BALANCE';

function asJsonRecord(value: unknown): Record<string, Json | undefined> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, Json | undefined>;
}

function extractCustomerEmailFromPayments(
  payments: Array<{ raw_payload: Json | null }>
): string {
  for (const payment of payments) {
    const payload = asJsonRecord(payment.raw_payload);
    const contact = payload.contact;
    if (!contact || typeof contact !== 'object' || Array.isArray(contact)) continue;
    const email = (contact as Record<string, unknown>).email;
    if (typeof email === 'string' && email.trim()) {
      return email.trim().toLowerCase();
    }
  }
  return 'client@resacolo.local';
}

function createMoneticoReference(checkoutId: string, orderId: string) {
  const left = checkoutId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 10).toUpperCase();
  const right = orderId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 10).toUpperCase();
  return `${left}-${right}`.slice(0, 24);
}

function createMoneticoMockTransactionId(checkoutId: string, paymentId: string) {
  const checkoutPart = checkoutId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8).toUpperCase();
  const paymentPart = paymentId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8).toUpperCase();
  return `MONE-${checkoutPart}-${paymentPart}-${Date.now()}`;
}

async function buildBalancePspPayload(input: {
  checkoutId: string;
  orderId: string;
  paymentId: string;
  reference: string;
  transactionId: string;
  amountCents: number;
  currency: string;
  customerEmail: string;
}): Promise<MoneticoPayload & { provider?: string; payId?: string | null; transId?: string }> {
  const payload = await createCheckoutPspPayload(input);
  return toLegacyMoneticoResponseShape(payload);
}

export function isBalancePaymentPayload(rawPayload: Json | null | undefined) {
  return asJsonRecord(rawPayload).paymentKind === BALANCE_PAYMENT_KIND;
}

export async function computeOrderClientBalance(orderId: string) {
  const supabase = getServerSupabaseClient();
  const { data: orderRow, error: orderError } = await supabase
    .from('orders')
    .select('id,status,client_user_id,collectivity_id,external_aid_cents,external_paid_cents,cancellation_reason')
    .eq('id', orderId)
    .maybeSingle();

  if (orderError || !orderRow) {
    throw new Error('Commande introuvable.');
  }

  const { data: orderItems } = await supabase
    .from('order_items')
    .select('id,total_price_cents')
    .eq('order_id', orderId);
  const orderItemIds = (orderItems ?? []).map((item) => item.id);
  const totalCents = (orderItems ?? []).reduce((sum, item) => sum + (item.total_price_cents ?? 0), 0);

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
  const clientPayableCents = Math.max(0, totalCents - partnerContributionCents);

  const { data: payments } = await supabase
    .from('payments')
    .select('id,status,amount_cents,currency,raw_payload')
    .eq('order_id', orderId)
    .order('updated_at', { ascending: false });

  const onlinePaidCents = (payments ?? [])
    .filter((payment) => payment.status === 'SUCCEEDED')
    .reduce((sum, payment) => sum + (payment.amount_cents ?? 0), 0);

  const remainingBalanceCents = computeRemainingBalanceCents({
    totalCents: clientPayableCents,
    externalAidCents: orderRow.external_aid_cents ?? 0,
    externalPaidCents: orderRow.external_paid_cents ?? 0,
    onlinePaidCents
  });

  const currency = payments?.[0]?.currency ?? 'EUR';
  const customerEmail = extractCustomerEmailFromPayments(payments ?? []);

  return {
    order: orderRow,
    totalCents,
    clientPayableCents,
    remainingBalanceCents,
    currency,
    customerEmail
  };
}

export async function prepareOrderBalancePayment(input: {
  orderId: string;
  clientUserId: string;
  /** Optional custom amount in cents. Defaults to the full remaining balance. */
  amountCents?: number | null;
}) {
  const supabase = getServerSupabaseClient();
  const balance = await computeOrderClientBalance(input.orderId);

  if (balance.order.client_user_id !== input.clientUserId) {
    throw new Error('Commande introuvable.');
  }
  if (balance.order.status === 'CART' || balance.order.status === 'CANCELLED') {
    throw new Error('Cette commande ne peut pas être réglée en ligne.');
  }
  if (balance.remainingBalanceCents <= 0) {
    throw new Error('Aucun solde restant à régler pour cette commande.');
  }

  const requestedAmountCents =
    input.amountCents == null ? balance.remainingBalanceCents : Math.round(Number(input.amountCents));
  if (!Number.isFinite(requestedAmountCents) || requestedAmountCents <= 0) {
    throw new Error('Le montant à régler est invalide.');
  }
  if (requestedAmountCents > balance.remainingBalanceCents) {
    throw new Error(
      `Le montant ne peut pas dépasser le solde restant (${(balance.remainingBalanceCents / 100).toFixed(2)} €).`
    );
  }
  const amountCents = requestedAmountCents;

  const checkoutId = `balance-${input.orderId}`;
  const { data: existingPending } = await supabase
    .from('payments')
    .select('id,amount_cents,monetico_reference,monetico_transaction_id,raw_payload')
    .eq('order_id', input.orderId)
    .eq('status', 'PENDING')
    .order('updated_at', { ascending: false })
    .limit(5);

  const reusable = (existingPending ?? []).find((payment) => isBalancePaymentPayload(payment.raw_payload));
  if (reusable?.id) {
    const reference =
      reusable.monetico_reference || createMoneticoReference(checkoutId, input.orderId);
    const transactionId =
      reusable.monetico_transaction_id || createMoneticoMockTransactionId(checkoutId, reusable.id);

    const monetico = await buildBalancePspPayload({
      checkoutId,
      orderId: input.orderId,
      paymentId: reusable.id,
      reference,
      transactionId,
      amountCents,
      currency: balance.currency,
      customerEmail: balance.customerEmail
    });
    const providerTransactionId =
      (monetico as { transId?: string }).transId || monetico.transactionId || transactionId;

    await supabase
      .from('payments')
      .update({
        amount_cents: amountCents,
        monetico_reference: monetico.reference || reference,
        monetico_transaction_id: providerTransactionId,
        raw_payload: {
          ...asJsonRecord(reusable.raw_payload),
          paymentKind: BALANCE_PAYMENT_KIND,
          checkoutId,
          contact: { email: balance.customerEmail },
          monetico,
          axepta:
            (monetico as { provider?: string }).provider === 'axepta'
              ? {
                  provider: 'axepta',
                  transId: providerTransactionId,
                  payId: (monetico as { payId?: string | null }).payId ?? null
                }
              : null
        }
      })
      .eq('id', reusable.id);

    return {
      orderId: input.orderId,
      paymentId: reusable.id,
      amountCents,
      remainingBalanceCents: balance.remainingBalanceCents,
      currency: balance.currency,
      monetico
    };
  }

  const reference = createMoneticoReference(checkoutId, input.orderId);
  const { data: payment, error: paymentError } = await supabase
    .from('payments')
    .insert({
      order_id: input.orderId,
      amount_cents: amountCents,
      currency: balance.currency,
      status: 'PENDING',
      monetico_reference: reference,
      raw_payload: {
        paymentKind: BALANCE_PAYMENT_KIND,
        checkoutId,
        contact: { email: balance.customerEmail }
      }
    })
    .select('id')
    .single();

  if (paymentError || !payment) {
    throw new Error('Impossible de préparer le paiement du solde.');
  }

  const transactionId = createMoneticoMockTransactionId(checkoutId, payment.id);
  const monetico = await buildBalancePspPayload({
    checkoutId,
    orderId: input.orderId,
    paymentId: payment.id,
    reference,
    transactionId,
    amountCents,
    currency: balance.currency,
    customerEmail: balance.customerEmail
  });
  const providerTransactionId =
    (monetico as { transId?: string }).transId || monetico.transactionId || transactionId;

  await supabase
    .from('payments')
    .update({
      monetico_transaction_id: providerTransactionId,
      monetico_reference: monetico.reference || reference,
      raw_payload: {
        paymentKind: BALANCE_PAYMENT_KIND,
        checkoutId,
        contact: { email: balance.customerEmail },
        monetico,
        axepta:
          (monetico as { provider?: string }).provider === 'axepta'
            ? {
                provider: 'axepta',
                transId: providerTransactionId,
                payId: (monetico as { payId?: string | null }).payId ?? null
              }
            : null
      }
    })
    .eq('id', payment.id);

  return {
    orderId: input.orderId,
    paymentId: payment.id,
    amountCents,
    remainingBalanceCents: balance.remainingBalanceCents,
    currency: balance.currency,
    monetico
  };
}
