import crypto from 'node:crypto';
import { toAbsoluteUrl } from '@/lib/seo';

export type MoneticoMode = 'mock' | 'live';

export type MoneticoPayload = {
  mode: MoneticoMode;
  reference: string;
  transactionId: string;
  paymentUrl: string;
  testMode: boolean;
  formMethod: 'POST';
  formFields: Record<string, string>;
};

type MoneticoLiveEnv = {
  mode: 'live';
  tpe: string;
  companyCode: string;
  hmacKey: string;
  paymentUrl: string;
  language: string;
};

type MoneticoMockEnv = {
  mode: 'mock';
};

type MoneticoEnv = MoneticoLiveEnv | MoneticoMockEnv;

const LIVE_REQUIRED_VARS = ['MONETICO_TPE', 'MONETICO_COMPANY_CODE', 'MONETICO_HMAC_KEY', 'MONETICO_PAYMENT_URL'] as const;

function readEnv(name: string): string {
  return (process.env[name] ?? '').trim();
}

export function getMoneticoMode(): MoneticoMode {
  return readEnv('MONETICO_MODE').toLowerCase() === 'live' ? 'live' : 'mock';
}

export function getMoneticoEnv(): MoneticoEnv {
  const mode = getMoneticoMode();
  if (mode === 'mock') return { mode: 'mock' };

  const missing = LIVE_REQUIRED_VARS.filter((name) => !readEnv(name));
  if (missing.length > 0) {
    throw new Error(`Configuration Monetico live incomplète: ${missing.join(', ')}`);
  }

  return {
    mode: 'live',
    tpe: readEnv('MONETICO_TPE'),
    companyCode: readEnv('MONETICO_COMPANY_CODE'),
    hmacKey: readEnv('MONETICO_HMAC_KEY'),
    paymentUrl: readEnv('MONETICO_PAYMENT_URL'),
    language: readEnv('MONETICO_LANGUAGE') || 'FR'
  };
}

function formatMoneticoDate(date: Date) {
  const pad = (v: number) => String(v).padStart(2, '0');
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}:${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(
    date.getSeconds()
  )}`;
}

export function formatMoneticoAmount(cents: number, currency: string) {
  return `${(cents / 100).toFixed(2)}${currency}`;
}

function computeMoneticoMac(source: string, hmacKey: string) {
  // Monetico/CIC accepte une empreinte HMAC SHA-1 en hexadécimal.
  return crypto.createHmac('sha1', hmacKey).update(source, 'utf8').digest('hex');
}

function buildMacSourceFromOrderedFields(fields: Record<string, string>, orderedKeys: string[]) {
  return `${orderedKeys.map((key) => `${key}=${fields[key] ?? ''}`).join('*')}*`;
}

export function buildMoneticoLivePayload(input: {
  reference: string;
  transactionId: string;
  amountCents: number;
  currency: string;
  customerEmail: string;
  orderId: string;
  checkoutId: string;
  paymentId: string;
  returnPath: string;
}) {
  const env = getMoneticoEnv();
  if (env.mode !== 'live') {
    throw new Error('Impossible de générer un payload live quand MONETICO_MODE != live.');
  }

  const date = formatMoneticoDate(new Date());
  const amount = formatMoneticoAmount(input.amountCents, input.currency);
  const callbackUrl = toAbsoluteUrl('/api/checkout/monetico/callback');
  const returnOk = toAbsoluteUrl(`${input.returnPath}?mode=monetico-live`);
  const returnErr = toAbsoluteUrl(`${input.returnPath}?mode=monetico-live`);
  const context = JSON.stringify({
    orderId: input.orderId,
    checkoutId: input.checkoutId,
    paymentId: input.paymentId
  });

  const fields: Record<string, string> = {
    TPE: env.tpe,
    date,
    montant: amount,
    reference: input.reference,
    'texte-libre': input.orderId,
    version: '3.0',
    lgue: env.language,
    mail: input.customerEmail,
    societe: env.companyCode,
    url_retour: callbackUrl,
    url_retour_ok: returnOk,
    url_retour_err: returnErr,
    contexte_commande: context
  };

  const orderedKeys = [
    'TPE',
    'date',
    'montant',
    'reference',
    'texte-libre',
    'version',
    'lgue',
    'mail',
    'societe',
    'url_retour',
    'url_retour_ok',
    'url_retour_err',
    'contexte_commande'
  ];

  const macSource = buildMacSourceFromOrderedFields(fields, orderedKeys);
  fields.MAC = computeMoneticoMac(macSource, env.hmacKey);

  return {
    mode: 'live' as const,
    reference: input.reference,
    transactionId: input.transactionId,
    paymentUrl: env.paymentUrl,
    testMode: false,
    formMethod: 'POST' as const,
    formFields: fields,
    macSource
  };
}

export function verifyMoneticoCallbackMac(payload: Record<string, string>) {
  const env = getMoneticoEnv();
  if (env.mode !== 'live') return true;

  const receivedMac = (payload.MAC ?? payload.mac ?? '').trim().toLowerCase();
  if (!receivedMac) return false;

  const orderedKeys = [
    'TPE',
    'date',
    'montant',
    'reference',
    'texte-libre',
    'version',
    'code-retour',
    'cvx',
    'vld',
    'brand',
    'status3ds',
    'numauto',
    'motifrefus',
    'originecb',
    'bincb',
    'hpancb',
    'ipclient',
    'originetr',
    'veres',
    'pares',
    'url_retour',
    'url_retour_ok',
    'url_retour_err',
    'contexte_commande'
  ];
  const source = buildMacSourceFromOrderedFields(payload, orderedKeys);
  const expectedMac = computeMoneticoMac(source, env.hmacKey).toLowerCase();
  const receivedBuffer = Buffer.from(receivedMac, 'utf8');
  const expectedBuffer = Buffer.from(expectedMac, 'utf8');
  if (receivedBuffer.length !== expectedBuffer.length) return false;
  return crypto.timingSafeEqual(receivedBuffer, expectedBuffer);
}

export function isMoneticoSuccessCode(value: string | null | undefined) {
  const normalized = String(value ?? '')
    .toLowerCase()
    .trim();
  if (!normalized) return false;
  return (
    normalized.includes('paiement') ||
    normalized.includes('payetest') ||
    normalized.includes('paybox') ||
    normalized.includes('capture')
  );
}
