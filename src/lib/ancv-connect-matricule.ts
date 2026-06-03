import { parseAmountEurosToCents } from '@/lib/order-workflow';

/** Matricule ANCV Connect : 11 chiffres (ex. 10003377487). */
export const ANCV_CONNECT_MATRICULE_LENGTH = 11;

export const ANCV_CONNECT_MATRICULE_REGEX = /^\d{11}$/;
export const ANCV_CONNECT_MATRICULE_OPTIONAL_REGEX = /^$|^\d{11}$/;

export const ANCV_CONNECT_MATRICULE_MESSAGE =
  'Le matricule ANCV Connect doit contenir 11 chiffres.';

export const ANCV_CONNECT_MATRICULE_HINT =
  'Format attendu : 11 chiffres (ex. 10003377487).';

export function normalizeAncvConnectMatriculeInput(raw: string) {
  return raw.replace(/\D/g, '').slice(0, ANCV_CONNECT_MATRICULE_LENGTH);
}

export function isValidAncvConnectMatricule(value: string) {
  const normalized = normalizeAncvConnectMatriculeInput(value);
  if (!normalized) return true;
  return ANCV_CONNECT_MATRICULE_REGEX.test(normalized);
}

export function validateAncvConnectMatricule(value: string) {
  const normalized = normalizeAncvConnectMatriculeInput(value);
  if (!normalized) return null;
  return ANCV_CONNECT_MATRICULE_REGEX.test(normalized) ? null : ANCV_CONNECT_MATRICULE_MESSAGE;
}

export const ANCV_CONNECT_AMOUNT_EXCEEDS_ORDER_MESSAGE =
  'Le montant souhaité en ANCV Connect ne peut pas dépasser le montant de la commande.';

export function resolveAncvConnectOrderPayableTotalCents(
  financeFamilyPayableTotalCents: number | null,
  totalCents: number
) {
  return financeFamilyPayableTotalCents ?? totalCents;
}

export function validateAncvConnectAmountAgainstOrderTotal(
  amountEuros: string,
  orderPayableTotalCents: number
) {
  const amountCents = parseAmountEurosToCents(amountEuros);
  if (amountCents <= 0) return null;
  if (amountCents > Math.max(0, orderPayableTotalCents)) {
    return ANCV_CONNECT_AMOUNT_EXCEEDS_ORDER_MESSAGE;
  }
  return null;
}
