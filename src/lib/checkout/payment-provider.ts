import {
  createAxeptaCheckoutSession,
  createAxeptaTransId,
  getAxeptaMode,
  type AxeptaPayload
} from '@/lib/checkout/axepta';
import { buildMoneticoLivePayload, getMoneticoMode, type MoneticoPayload } from '@/lib/checkout/monetico';

export type PaymentProviderName = 'monetico' | 'axepta';

export type CheckoutPspPayload = (MoneticoPayload & { provider: 'monetico' }) | AxeptaPayload;

function readEnv(name: string) {
  return (process.env[name] ?? '').trim();
}

export function getPaymentProvider(): PaymentProviderName {
  const raw = readEnv('PAYMENT_PROVIDER').toLowerCase();
  if (raw === 'axepta') return 'axepta';
  return 'monetico';
}

export function getActivePaymentProviderMode(): 'mock' | 'live' {
  return getPaymentProvider() === 'axepta' ? getAxeptaMode() : getMoneticoMode();
}

export async function createCheckoutPspPayload(input: {
  checkoutId: string;
  orderId: string;
  paymentId: string;
  reference: string;
  transactionId: string;
  amountCents: number;
  currency: string;
  customerEmail: string;
  billingFirstName?: string | null;
  billingLastName?: string | null;
  merchantCustomerId?: string | null;
}): Promise<CheckoutPspPayload> {
  if (getPaymentProvider() === 'axepta') {
    const transId = createAxeptaTransId();
    return createAxeptaCheckoutSession({
      transId,
      amountCents: input.amountCents,
      currency: input.currency,
      customerEmail: input.customerEmail,
      merchantCustomerId: input.merchantCustomerId,
      merchantReference: input.reference.slice(0, 30),
      invoiceId: input.orderId.slice(0, 30),
      orderId: input.orderId,
      checkoutId: input.checkoutId,
      paymentId: input.paymentId,
      billingFirstName: input.billingFirstName,
      billingLastName: input.billingLastName
    });
  }

  if (getMoneticoMode() === 'live') {
    const live = buildMoneticoLivePayload({
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
    return {
      provider: 'monetico',
      mode: live.mode,
      reference: live.reference,
      transactionId: live.transactionId,
      paymentUrl: live.paymentUrl,
      testMode: live.testMode,
      formMethod: live.formMethod,
      formFields: live.formFields
    };
  }

  return {
    provider: 'monetico',
    mode: 'mock',
    reference: input.reference,
    transactionId: input.transactionId,
    paymentUrl: `/checkout/paiement?checkoutId=${encodeURIComponent(input.checkoutId)}`,
    testMode: true,
    formMethod: 'POST',
    formFields: {}
  };
}

/** Shape expected by current checkout UI (legacy `monetico` key). */
export function toLegacyMoneticoResponseShape(payload: CheckoutPspPayload): MoneticoPayload & {
  provider: PaymentProviderName;
  payId?: string | null;
  transId?: string;
} {
  if (payload.provider === 'axepta') {
    return {
      provider: 'axepta',
      mode: payload.mode,
      reference: payload.reference,
      transactionId: payload.transactionId,
      paymentUrl: payload.paymentUrl,
      testMode: payload.testMode,
      formMethod: 'POST',
      formFields: payload.formFields,
      payId: payload.payId,
      transId: payload.transId
    };
  }

  return {
    provider: 'monetico',
    mode: payload.mode,
    reference: payload.reference,
    transactionId: payload.transactionId,
    paymentUrl: payload.paymentUrl,
    testMode: payload.testMode,
    formMethod: payload.formMethod,
    formFields: payload.formFields
  };
}
