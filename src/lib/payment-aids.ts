export const PAYMENT_AID_VALUES = ['ancv_connect', 'ancv_paper', 'caf_vouchers'] as const;

export type PaymentAidValue = (typeof PAYMENT_AID_VALUES)[number];

const PAYMENT_AID_SET = new Set<string>(PAYMENT_AID_VALUES);
const ORGANIZER_PAYMENT_AIDS_META_PATTERN = /<!--\s*resacolo:payment-aids:([a-z_,\s-]*)\s*-->/i;

export function isPaymentAidValue(value: string): value is PaymentAidValue {
  return PAYMENT_AID_SET.has(value);
}

export function normalizePaymentAids(value: unknown): PaymentAidValue[] {
  if (!Array.isArray(value)) return [];
  const normalized = value
    .map((item) => String(item ?? '').trim())
    .filter((item): item is PaymentAidValue => isPaymentAidValue(item));
  return Array.from(new Set(normalized));
}

export function paymentAidLabel(value: PaymentAidValue) {
  if (value === 'ancv_connect') return 'ANCV connect';
  if (value === 'ancv_paper') return 'ANCV';
  return 'Bons VACAF';
}

function normalizeText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

export function detectPaymentAidsFromText(input: {
  description?: string | null;
  programText?: string | null;
  transportText?: string | null;
  requiredDocumentsText?: string | null;
  rawPayload?: unknown;
}) {
  const rawPayloadText =
    input.rawPayload && typeof input.rawPayload === 'object' ? JSON.stringify(input.rawPayload) : '';
  const scan = normalizeText(
    [
      input.description ?? '',
      input.programText ?? '',
      input.transportText ?? '',
      input.requiredDocumentsText ?? '',
      rawPayloadText
    ]
      .filter(Boolean)
      .join('\n')
  );

  const aids = new Set<PaymentAidValue>();

  if (/\b(ancv\s*connect|cv\s*connect)\b/.test(scan)) {
    aids.add('ancv_connect');
  }
  if (/\b(ancv|cheque\s*vacances|cheques\s*vacances|chq?\s*vacances)\b/.test(scan) && !/\b(ancv\s*connect|cv\s*connect)\b/.test(scan)) {
    aids.add('ancv_paper');
  }
  if (/\b(caf|vacaf|bons?\s*caf)\b/.test(scan)) {
    aids.add('caf_vouchers');
  }

  return Array.from(aids);
}

export function extractPaymentAidsFromOrganizerDescriptionMeta(
  description: string | null | undefined
): PaymentAidValue[] {
  const raw = description ?? '';
  const match = raw.match(ORGANIZER_PAYMENT_AIDS_META_PATTERN);
  if (!match?.[1]) return [];
  const values = match[1]
    .split(',')
    .map((item) => String(item ?? '').trim().toLowerCase())
    .filter(Boolean);
  return normalizePaymentAids(values);
}
