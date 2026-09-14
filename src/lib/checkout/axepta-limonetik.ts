import crypto from 'node:crypto';
import Blowfish from 'egoroof-blowfish';
import { getAxeptaMode } from '@/lib/checkout/axepta';
import { toAbsoluteUrl } from '@/lib/seo';

const DEFAULT_API_BASE = 'https://paymentpage.axepta.bnpparibas';
const LIMONETIK_PATH = '/limonetik.aspx';

export type AxeptaLimonetikPayload = {
  provider: 'axepta-limonetik';
  mode: 'mock' | 'live';
  payType: 'cvconnect';
  transId: string;
  payId: string | null;
  reference: string;
  transactionId: string;
  paymentUrl: string;
  testMode: boolean;
  formMethod: 'GET' | 'POST';
  formFields: Record<string, string>;
};

type LimonetikLiveEnv = {
  mode: 'live';
  merchantId: string;
  blowfishKey: Buffer;
  hmacSecret: Buffer;
  apiBaseUrl: string;
};

function readEnv(name: string) {
  return (process.env[name] ?? '').trim();
}

function parseKeyMaterial(value: string, label: string) {
  const normalized = value.replace(/\s+/g, '');
  if (/^[0-9a-fA-F]+$/.test(normalized) && normalized.length % 2 === 0 && normalized.length >= 16) {
    return Buffer.from(normalized, 'hex');
  }
  if (!normalized) {
    throw new Error(`${label} manquant.`);
  }
  return Buffer.from(normalized, 'utf8');
}

function getLimonetikLiveEnv(): LimonetikLiveEnv {
  const merchantId = readEnv('AXEPTA_MERCHANT_ID');
  const blowfishRaw = readEnv('AXEPTA_BLOWFISH_KEY');
  const hmacRaw = readEnv('AXEPTA_HMAC_SECRET');
  if (!merchantId || !blowfishRaw || !hmacRaw) {
    throw new Error(
      'Configuration Axepta Limonetik incomplète: AXEPTA_MERCHANT_ID, AXEPTA_BLOWFISH_KEY, AXEPTA_HMAC_SECRET.'
    );
  }

  return {
    mode: 'live',
    merchantId,
    blowfishKey: parseKeyMaterial(blowfishRaw, 'AXEPTA_BLOWFISH_KEY'),
    hmacSecret: parseKeyMaterial(hmacRaw, 'AXEPTA_HMAC_SECRET'),
    apiBaseUrl: (readEnv('AXEPTA_API_BASE_URL') || DEFAULT_API_BASE).replace(/\/$/, '')
  };
}

function truncate(value: string, max: number) {
  return value.slice(0, max);
}

function sanitizeAns(value: string) {
  return value.replace(/[\r\n&]/g, ' ').trim();
}

function buildPlaintext(params: Record<string, string>) {
  return Object.entries(params)
    .filter(([, value]) => value !== '')
    .map(([key, value]) => `${key}=${value}`)
    .join('&');
}

function parsePlaintext(plaintext: string) {
  const result: Record<string, string> = {};
  for (const part of plaintext.split('&')) {
    if (!part) continue;
    const eq = part.indexOf('=');
    if (eq <= 0) continue;
    const key = part.slice(0, eq);
    const value = part.slice(eq + 1);
    result[key] = value;
    result[key.toLowerCase()] = value;
  }
  return result;
}

export function encryptAxeptaBlowfishData(plaintext: string, blowfishKey: Buffer) {
  const bf = new Blowfish(blowfishKey, Blowfish.MODE.ECB, Blowfish.PADDING.NULL);
  const encrypted = bf.encode(plaintext);
  return Buffer.from(encrypted).toString('hex').toUpperCase();
}

export function decryptAxeptaBlowfishData(dataHex: string, blowfishKey: Buffer) {
  const normalized = dataHex.replace(/\s+/g, '');
  const encrypted = Buffer.from(normalized, 'hex');
  const bf = new Blowfish(blowfishKey, Blowfish.MODE.ECB, Blowfish.PADDING.NULL);
  const decoded = bf.decode(encrypted, Blowfish.TYPE.UINT8_ARRAY);
  const plaintext = Buffer.from(decoded).toString('utf8').replace(/\0+$/g, '');
  return plaintext;
}

/** MAC Computop/Axepta: HMAC-SHA-256 hex of PayID*TransID*MerchantID*Amount*Currency */
export function computeAxeptaMac(input: {
  payId?: string | null;
  transId: string;
  merchantId: string;
  amount: string | number;
  currency: string;
  hmacSecret: Buffer;
}) {
  const payload = [
    String(input.payId ?? ''),
    input.transId,
    input.merchantId,
    String(input.amount),
    input.currency
  ].join('*');
  return crypto.createHmac('sha256', input.hmacSecret).update(payload, 'utf8').digest('hex').toUpperCase();
}

export function createAxeptaLimonetikTransId() {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 32);
}

export function encodeLimonetikUserData(input: {
  orderId: string;
  paymentId: string;
  checkoutId: string;
}) {
  return truncate(
    [`orderId=${input.orderId}`, `paymentId=${input.paymentId}`, `checkoutId=${input.checkoutId}`].join('|'),
    1024
  );
}

export function parseLimonetikUserData(value: string | null | undefined) {
  const raw = String(value ?? '').trim();
  const result: { orderId: string | null; paymentId: string | null; checkoutId: string | null } = {
    orderId: null,
    paymentId: null,
    checkoutId: null
  };
  if (!raw) return result;
  for (const part of raw.split('|')) {
    const [key, ...rest] = part.split('=');
    const val = rest.join('=').trim();
    if (!key || !val) continue;
    if (key === 'orderId') result.orderId = val;
    if (key === 'paymentId') result.paymentId = val;
    if (key === 'checkoutId') result.checkoutId = val;
  }
  return result;
}

function normalizeMobileNo(phone: string) {
  const trimmed = phone.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('+')) return truncate(trimmed.replace(/\s+/g, ''), 50);
  const digits = trimmed.replace(/\D/g, '');
  if (digits.startsWith('33') && digits.length >= 11) return `+${digits}`;
  if (digits.startsWith('0') && digits.length >= 10) return `+33${digits.slice(1)}`;
  if (digits) return `+${digits}`;
  return truncate(trimmed, 50);
}

export async function createAxeptaLimonetikCvConnectPayload(input: {
  transId?: string;
  amountCents: number;
  currency?: string;
  customerEmail: string;
  mobileNo: string;
  firstName: string;
  lastName: string;
  street: string;
  postalCode: string;
  city: string;
  countryCode?: string;
  orderId: string;
  checkoutId: string;
  paymentId: string;
  merchantReference: string;
  orderDesc?: string;
}): Promise<AxeptaLimonetikPayload> {
  const transId = input.transId || createAxeptaLimonetikTransId();
  const currency = (input.currency || 'EUR').toUpperCase();
  const amount = String(Math.max(0, Math.round(input.amountCents)));
  const reference = truncate(sanitizeAns(input.merchantReference), 30);

  if (getAxeptaMode() !== 'live') {
    return {
      provider: 'axepta-limonetik',
      mode: 'mock',
      payType: 'cvconnect',
      transId,
      payId: null,
      reference,
      transactionId: transId,
      paymentUrl: `/checkout/paiement?checkoutId=${encodeURIComponent(input.checkoutId)}&mockLimonetik=1`,
      testMode: true,
      formMethod: 'GET',
      formFields: {}
    };
  }

  const env = getLimonetikLiveEnv();
  const successUrl = toAbsoluteUrl('/api/checkout/axepta/limonetik/return');
  const failureUrl = toAbsoluteUrl('/api/checkout/axepta/limonetik/failure');
  const notifyUrl = toAbsoluteUrl('/api/checkout/axepta/limonetik/notify');
  const userData = encodeLimonetikUserData({
    orderId: input.orderId,
    paymentId: input.paymentId,
    checkoutId: input.checkoutId
  });
  const mac = computeAxeptaMac({
    payId: '',
    transId,
    merchantId: env.merchantId,
    amount,
    currency,
    hmacSecret: env.hmacSecret
  });

  const params: Record<string, string> = {
    MerchantID: env.merchantId,
    TransID: truncate(transId, 64),
    RefNr: reference,
    Amount: amount,
    Currency: currency,
    MAC: mac,
    OrderDesc: truncate(sanitizeAns(input.orderDesc || `Resacolo ${reference}`), 128),
    Capture: 'AUTO',
    URLSuccess: successUrl,
    URLFailure: failureUrl,
    URLNotify: notifyUrl,
    Response: 'encrypt',
    ReqID: truncate(transId, 32),
    PayType: 'cvconnect',
    CustomerID: truncate(sanitizeAns(input.checkoutId), 20),
    CustomerClassification: 'Individual',
    FirstName: truncate(sanitizeAns(input.firstName), 50),
    LastName: truncate(sanitizeAns(input.lastName), 50),
    Street: truncate(sanitizeAns(input.street), 80),
    ZIPCode: truncate(sanitizeAns(input.postalCode), 10),
    City: truncate(sanitizeAns(input.city), 100),
    CountryCode: truncate((input.countryCode || 'FR').toUpperCase(), 2),
    Email: truncate(sanitizeAns(input.customerEmail), 100),
    MobileNo: truncate(normalizeMobileNo(input.mobileNo), 50),
    Language: 'fr-FR',
    UserData: userData
  };

  const plaintext = buildPlaintext(params);
  const data = encryptAxeptaBlowfishData(plaintext, env.blowfishKey);

  return {
    provider: 'axepta-limonetik',
    mode: 'live',
    payType: 'cvconnect',
    transId,
    payId: null,
    reference,
    transactionId: transId,
    paymentUrl: `${env.apiBaseUrl}${LIMONETIK_PATH}`,
    testMode: false,
    formMethod: 'POST',
    formFields: {
      MerchantID: env.merchantId,
      Len: String(plaintext.length),
      Data: data
    }
  };
}

export function parseAxeptaLimonetikResponse(input: {
  dataHex?: string | null;
  len?: string | null;
  query?: URLSearchParams | Record<string, string>;
}) {
  const envMode = getAxeptaMode();
  if (envMode === 'live' && input.dataHex) {
    const env = getLimonetikLiveEnv();
    const plaintext = decryptAxeptaBlowfishData(input.dataHex, env.blowfishKey);
    const parsed = parsePlaintext(plaintext);
    const payId = parsed.PayID || parsed.payid || '';
    const transId = parsed.TransID || parsed.transid || '';
    const merchantId = parsed.MID || parsed.mid || parsed.MerchantID || env.merchantId;
    const amount = parsed.Amount || parsed.amount || '';
    const currency = parsed.Currency || parsed.currency || 'EUR';
    const mac = parsed.MAC || parsed.mac || '';
    const expectedMac = computeAxeptaMac({
      payId,
      transId,
      merchantId,
      amount: amount || '0',
      currency,
      hmacSecret: env.hmacSecret
    });
    const macValid = !mac || mac.toUpperCase() === expectedMac;
    return {
      mid: merchantId,
      payId: payId || null,
      transId: transId || null,
      xId: parsed.XID || parsed.xid || null,
      status: parsed.Status || parsed.status || null,
      code: parsed.Code || parsed.code || null,
      description: parsed.Description || parsed.description || null,
      userData: parsed.UserData || parsed.userdata || null,
      macValid,
      raw: parsed,
      plaintext
    };
  }

  const query =
    input.query instanceof URLSearchParams
      ? Object.fromEntries(input.query.entries())
      : (input.query ?? {});
  const normalized: Record<string, string> = {};
  for (const [key, value] of Object.entries(query)) {
    normalized[key] = value;
    normalized[key.toLowerCase()] = value;
  }

  return {
    mid: normalized.MID || normalized.mid || null,
    payId: normalized.PayID || normalized.payid || null,
    transId: normalized.TransID || normalized.transid || null,
    xId: normalized.XID || normalized.xid || null,
    status: normalized.Status || normalized.status || null,
    code: normalized.Code || normalized.code || null,
    description: normalized.Description || normalized.description || null,
    userData: normalized.UserData || normalized.userdata || null,
    macValid: true,
    raw: normalized,
    plaintext: null as string | null
  };
}

export function isLimonetikPaymentSuccess(status: string | null | undefined, code: string | null | undefined) {
  const normalizedStatus = String(status ?? '')
    .trim()
    .toUpperCase();
  const normalizedCode = String(code ?? '').trim();
  return normalizedStatus === 'OK' && (normalizedCode === '00000000' || normalizedCode === '0' || !normalizedCode);
}
