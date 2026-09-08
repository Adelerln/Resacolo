import crypto from 'node:crypto';
import { toAbsoluteUrl } from '@/lib/seo';

export type AxeptaMode = 'mock' | 'live';

export type AxeptaPayload = {
  provider: 'axepta';
  mode: AxeptaMode;
  /** Merchant-side transaction id (transId, UUID). */
  transId: string;
  /** Axepta payId when already known (usually after webhook/return). */
  payId: string | null;
  reference: string;
  transactionId: string;
  paymentUrl: string;
  testMode: boolean;
  formMethod: 'GET';
  formFields: Record<string, string>;
};

type AxeptaLiveEnv = {
  mode: 'live';
  merchantId: string;
  apiKey: string;
  hmacSecret: string;
  apiBaseUrl: string;
  language: string;
};

type AxeptaMockEnv = {
  mode: 'mock';
};

type AxeptaEnv = AxeptaLiveEnv | AxeptaMockEnv;

type CachedToken = {
  accessToken: string;
  tokenType: string;
  expiresAtMs: number;
};

const LIVE_REQUIRED_VARS = ['AXEPTA_MERCHANT_ID', 'AXEPTA_API_KEY', 'AXEPTA_HMAC_SECRET'] as const;
const DEFAULT_API_BASE = 'https://paymentpage.axepta.bnpparibas';

let cachedToken: CachedToken | null = null;

function readEnv(name: string): string {
  return (process.env[name] ?? '').trim();
}

export function getAxeptaMode(): AxeptaMode {
  return readEnv('AXEPTA_MODE').toLowerCase() === 'live' ? 'live' : 'mock';
}

export function getAxeptaEnv(): AxeptaEnv {
  const mode = getAxeptaMode();
  if (mode === 'mock') return { mode: 'mock' };

  const missing = LIVE_REQUIRED_VARS.filter((name) => !readEnv(name));
  if (missing.length > 0) {
    throw new Error(`Configuration Axepta live incomplète: ${missing.join(', ')}`);
  }

  return {
    mode: 'live',
    merchantId: readEnv('AXEPTA_MERCHANT_ID'),
    apiKey: readEnv('AXEPTA_API_KEY'),
    hmacSecret: readEnv('AXEPTA_HMAC_SECRET'),
    apiBaseUrl: (readEnv('AXEPTA_API_BASE_URL') || DEFAULT_API_BASE).replace(/\/$/, ''),
    language: readEnv('AXEPTA_LANGUAGE') || 'fr'
  };
}

export function createAxeptaTransId() {
  return crypto.randomUUID();
}

function truncateAns30(value: string) {
  return value.replace(/[^\w\-./]/g, '').slice(0, 30);
}

async function fetchAxeptaAccessToken(env: AxeptaLiveEnv) {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAtMs > now + 60_000) {
    return cachedToken;
  }

  const basic = Buffer.from(`${env.merchantId}:${env.apiKey}`).toString('base64');
  const response = await fetch(`${env.apiBaseUrl}/authorization/oauth/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json'
    },
    body: new URLSearchParams({
      grant_type: 'client_credentials'
    }).toString()
  });

  const raw = await response.text();
  let data: Record<string, unknown> = {};
  try {
    data = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
  } catch {
    data = {};
  }

  if (!response.ok) {
    throw new Error(
      `Axepta OAuth échoué (${response.status}): ${typeof data.error === 'string' ? data.error : raw.slice(0, 200)}`
    );
  }

  const accessToken = String(data.access_token ?? '').trim();
  const tokenType = String(data.token_type ?? 'Bearer').trim() || 'Bearer';
  const expiresIn = Number(data.expires_in ?? 3600);
  if (!accessToken) {
    throw new Error('Axepta OAuth: access_token manquant.');
  }

  cachedToken = {
    accessToken,
    tokenType,
    expiresAtMs: now + Math.max(60, expiresIn) * 1000
  };
  return cachedToken;
}

async function axeptaFetchJson(input: {
  env: AxeptaLiveEnv;
  path: string;
  method?: 'GET' | 'POST' | 'PATCH';
  body?: Record<string, unknown>;
  idempotencyKey?: string;
}) {
  const token = await fetchAxeptaAccessToken(input.env);
  const headers: Record<string, string> = {
    Authorization: `${token.tokenType} ${token.accessToken}`,
    Accept: 'application/json'
  };
  if (input.body) {
    headers['Content-Type'] = 'application/json';
  }
  if (input.idempotencyKey) {
    headers['Idempotency-Key'] = input.idempotencyKey;
  }

  const response = await fetch(`${input.env.apiBaseUrl}${input.path}`, {
    method: input.method ?? 'GET',
    headers,
    body: input.body ? JSON.stringify(input.body) : undefined
  });

  const raw = await response.text();
  let data: Record<string, unknown> = {};
  try {
    data = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
  } catch {
    data = { raw };
  }

  if (!response.ok) {
    const message =
      typeof data.responseDescription === 'string'
        ? data.responseDescription
        : typeof data.message === 'string'
          ? data.message
          : raw.slice(0, 300);
    throw new Error(`Axepta API ${input.path} échoué (${response.status}): ${message}`);
  }

  return data;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

export function isAxeptaSuccessResponseCode(value: string | null | undefined) {
  const normalized = String(value ?? '').trim();
  return normalized === '00000000' || normalized === '0';
}

export function isAxeptaSuccessfulStatus(status: string | null | undefined) {
  const normalized = String(status ?? '')
    .trim()
    .toUpperCase();
  return (
    normalized === 'AUTHORIZED' ||
    normalized === 'OK' ||
    normalized === 'CAPTURE_REQUEST' ||
    normalized === 'PAID' ||
    normalized === 'SUCCESS'
  );
}

export async function createAxeptaCheckoutSession(input: {
  transId: string;
  amountCents: number;
  currency: string;
  customerEmail: string;
  merchantCustomerId?: string | null;
  merchantReference: string;
  invoiceId?: string | null;
  orderId: string;
  checkoutId: string;
  paymentId: string;
  billingFirstName?: string | null;
  billingLastName?: string | null;
}): Promise<AxeptaPayload> {
  const env = getAxeptaEnv();
  if (env.mode === 'mock') {
    const isBalanceCheckout = input.checkoutId.startsWith('balance-');
    return {
      provider: 'axepta',
      mode: 'mock',
      transId: input.transId,
      payId: null,
      reference: input.merchantReference,
      transactionId: input.transId,
      paymentUrl: isBalanceCheckout
        ? `/mon-compte/reservations/${encodeURIComponent(input.orderId)}/paiement?mock=1`
        : `/checkout/paiement?checkoutId=${encodeURIComponent(input.checkoutId)}`,
      testMode: true,
      formMethod: 'GET',
      formFields: {}
    };
  }

  const isBalanceCheckout = input.checkoutId.startsWith('balance-');
  const returnUrl = toAbsoluteUrl(
    `/api/checkout/axepta/return?transId=${encodeURIComponent(input.transId)}&orderId=${encodeURIComponent(input.orderId)}${
      isBalanceCheckout ? '&source=balance' : ''
    }`
  );
  const cancelUrl = toAbsoluteUrl(
    `/api/checkout/axepta/cancel?transId=${encodeURIComponent(input.transId)}&orderId=${encodeURIComponent(input.orderId)}${
      isBalanceCheckout ? '&source=balance' : ''
    }`
  );
  const webhookUrl = toAbsoluteUrl('/api/checkout/axepta/webhook');

  const body = {
    transId: input.transId,
    amount: {
      currency: input.currency,
      value: Math.max(0, Math.round(input.amountCents))
    },
    language: env.language,
    captureMethod: {
      type: 'AUTOMATIC'
    },
    customerInfo: {
      merchantCustomerId: truncateAns30(input.merchantCustomerId || input.checkoutId),
      customerType: 'individual',
      firstName: input.billingFirstName?.trim() || undefined,
      lastName: input.billingLastName?.trim() || undefined,
      email: input.customerEmail
    },
    order: {
      merchantReference: truncateAns30(input.merchantReference),
      invoiceId: truncateAns30(input.invoiceId || input.orderId),
      numberOfArticles: 1,
      creationDate: new Date().toISOString()
    },
    urls: {
      return: returnUrl,
      cancel: cancelUrl,
      webhook: webhookUrl
    },
    metadata: {
      checkoutId: input.checkoutId,
      orderId: input.orderId,
      paymentId: input.paymentId
    },
    template: {
      customFields: {
        customField1: `${(input.amountCents / 100).toFixed(2)} €`,
        customField2: truncateAns30(input.merchantReference),
        customField4: truncateAns30(input.invoiceId || input.orderId)
      }
    }
  };

  const data = await axeptaFetchJson({
    env,
    path: '/api/v2/payments/sessions',
    method: 'POST',
    body,
    idempotencyKey: crypto.randomUUID()
  });

  const links = asRecord(data._links);
  const redirect = asRecord(links?.redirect);
  const paymentUrl = String(redirect?.href ?? data.redirectUrl ?? data.paymentPageUrl ?? '').trim();
  if (!paymentUrl) {
    throw new Error('Axepta: URL de redirection absente dans la réponse session.');
  }

  return {
    provider: 'axepta',
    mode: 'live',
    transId: input.transId,
    payId: typeof data.payId === 'string' ? data.payId : null,
    reference: input.merchantReference,
    transactionId: input.transId,
    paymentUrl,
    testMode: false,
    formMethod: 'GET',
    formFields: {}
  };
}

export async function getAxeptaPaymentByPayId(payId: string) {
  const env = getAxeptaEnv();
  if (env.mode === 'mock') {
    return {
      payId,
      transId: null as string | null,
      status: 'AUTHORIZED',
      responseCode: '00000000',
      responseDescription: 'Mock success',
      amountValue: null as number | null,
      currency: 'EUR',
      raw: { payId, status: 'AUTHORIZED', responseCode: '00000000' }
    };
  }

  const data = await axeptaFetchJson({
    env,
    path: `/api/v2/payments/getByPayId/${encodeURIComponent(payId)}`
  });
  const amount = asRecord(data.amount);

  return {
    payId: String(data.payId ?? payId),
    transId: typeof data.transId === 'string' ? data.transId : null,
    status: typeof data.status === 'string' ? data.status : null,
    responseCode: typeof data.responseCode === 'string' ? data.responseCode : null,
    responseDescription: typeof data.responseDescription === 'string' ? data.responseDescription : null,
    amountValue: typeof amount?.value === 'number' ? amount.value : null,
    currency: typeof amount?.currency === 'string' ? amount.currency : 'EUR',
    raw: data
  };
}

export async function getAxeptaPaymentByTransId(transId: string) {
  const env = getAxeptaEnv();
  if (env.mode === 'mock') {
    return {
      payId: `mock-${transId}`,
      transId,
      status: 'AUTHORIZED',
      responseCode: '00000000',
      responseDescription: 'Mock success',
      amountValue: null as number | null,
      currency: 'EUR',
      raw: { transId, status: 'AUTHORIZED', responseCode: '00000000' }
    };
  }

  const data = await axeptaFetchJson({
    env,
    path: `/api/v2/payments/getByTransId/${encodeURIComponent(transId)}`
  });
  const amount = asRecord(data.amount);

  return {
    payId: typeof data.payId === 'string' ? data.payId : null,
    transId: String(data.transId ?? transId),
    status: typeof data.status === 'string' ? data.status : null,
    responseCode: typeof data.responseCode === 'string' ? data.responseCode : null,
    responseDescription: typeof data.responseDescription === 'string' ? data.responseDescription : null,
    amountValue: typeof amount?.value === 'number' ? amount.value : null,
    currency: typeof amount?.currency === 'string' ? amount.currency : 'EUR',
    raw: data
  };
}

export function verifyAxeptaWebhookSignature(input: {
  timestampHeader: string | null;
  signatureHeader: string | null;
  rawBody: string;
}) {
  const env = getAxeptaEnv();
  if (env.mode === 'mock') return true;

  const timestamp = String(input.timestampHeader ?? '').trim();
  const signatureHeader = String(input.signatureHeader ?? '').trim();
  if (!timestamp || !signatureHeader) return false;

  const timestampSeconds = Number.parseInt(timestamp, 10);
  if (!Number.isFinite(timestampSeconds)) return false;
  const skewSeconds = Math.abs(Math.floor(Date.now() / 1000) - timestampSeconds);
  if (skewSeconds > 5 * 60) return false;

  const signedPayload = `${timestamp}.${input.rawBody}`;
  const expectedHex = crypto.createHmac('sha256', env.hmacSecret).update(signedPayload, 'utf8').digest('hex');

  const candidates = signatureHeader
    .split(/\s+OR\s+|,/i)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const match = part.match(/^(?:v\d+=)?([a-fA-F0-9]+)$/);
      return match?.[1]?.toLowerCase() ?? null;
    })
    .filter((value): value is string => Boolean(value));

  const expectedBuffer = Buffer.from(expectedHex, 'utf8');
  return candidates.some((candidate) => {
    const receivedBuffer = Buffer.from(candidate, 'utf8');
    if (receivedBuffer.length !== expectedBuffer.length) return false;
    return crypto.timingSafeEqual(receivedBuffer, expectedBuffer);
  });
}

export function parseAxeptaWebhookPayload(rawBody: string) {
  const data = JSON.parse(rawBody) as Record<string, unknown>;
  const amount = asRecord(data.amount);
  return {
    merchantId: typeof data.merchantId === 'string' ? data.merchantId : null,
    payId: typeof data.payId === 'string' ? data.payId : null,
    transId: typeof data.transId === 'string' ? data.transId : typeof data.TransId === 'string' ? data.TransId : null,
    xId:
      typeof data.xId === 'string'
        ? data.xId
        : typeof data.xid === 'string'
          ? data.xid
          : null,
    refNr: typeof data.refNr === 'string' ? data.refNr : null,
    status: typeof data.status === 'string' ? data.status : null,
    responseCode: typeof data.responseCode === 'string' ? data.responseCode : null,
    responseDescription: typeof data.responseDescription === 'string' ? data.responseDescription : null,
    amountValue: typeof amount?.value === 'number' ? amount.value : null,
    currency: typeof amount?.currency === 'string' ? amount.currency : null,
    raw: data
  };
}
