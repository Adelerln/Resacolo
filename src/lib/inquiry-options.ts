/** Valeurs autorisées par `inquiries_status_check` en base. */
export const INQUIRY_STATUS_VALUES = ['NEW', 'IN_PROGRESS', 'ANSWERED', 'CLOSED'] as const;

export type InquiryStatusValue = (typeof INQUIRY_STATUS_VALUES)[number];

/** Seul statut que l'organisateur peut définir (libellé « Résolu »). */
export const ORGANIZER_INQUIRY_STATUS_VALUE = 'ANSWERED' as const;

/** Valeurs autorisées par la contrainte `inquiries_inquiry_type_check` en base. */
export const INQUIRY_TYPE_VALUES = ['GENERAL', 'OTHER'] as const;

export type InquiryTypeValue = (typeof INQUIRY_TYPE_VALUES)[number];

export const INQUIRY_SOURCE_VALUES = [
  'CONTACT_FORM',
  'PLATFORM',
  'MNEMOS',
  'MNEMOS_TRANSFER'
] as const;

export type InquirySourceValue = (typeof INQUIRY_SOURCE_VALUES)[number];

export const INQUIRY_STATUS_LABELS: Record<string, string> = {
  NEW: 'Nouveau',
  IN_PROGRESS: 'En cours',
  OPEN: 'Ouvert',
  ANSWERED: 'Résolu',
  CLOSED: 'Clôturé',
  RESOLVED: 'Résolu'
};

export const INQUIRY_TYPE_LABELS: Record<InquiryTypeValue, string> = {
  GENERAL: 'Général',
  OTHER: 'Autre'
};

export const INQUIRY_SOURCE_LABELS: Record<InquirySourceValue, string> = {
  CONTACT_FORM: 'Formulaire de contact',
  PLATFORM: 'Assistant en ligne',
  MNEMOS: 'Mnemos (interne)',
  MNEMOS_TRANSFER: 'Transféré à un organisateur'
};

export const INQUIRY_SOURCE_MNEMOS = 'MNEMOS';
export const INQUIRY_SOURCE_MNEMOS_TRANSFER = 'MNEMOS_TRANSFER';

export function isInquiryStatusValue(value: string): value is InquiryStatusValue {
  return (INQUIRY_STATUS_VALUES as readonly string[]).includes(value);
}

export function isOrganizerSettableInquiryStatus(value: string) {
  return value === ORGANIZER_INQUIRY_STATUS_VALUE;
}

export function formatInquiryStatusLabel(value: string | null | undefined) {
  if (!value) return '—';
  return INQUIRY_STATUS_LABELS[value] ?? value;
}

export function inquiryStatusBadgeClassName(status: string | null | undefined) {
  switch (status) {
    case 'ANSWERED':
    case 'RESOLVED':
      return 'bg-emerald-100 text-emerald-900';
    case 'CLOSED':
      return 'bg-slate-100 text-slate-600';
    case 'IN_PROGRESS':
    case 'OPEN':
      return 'bg-sky-100 text-sky-900';
    case 'NEW':
    default:
      return 'bg-violet-100 text-violet-800';
  }
}

export function isInquiryTypeValue(value: string): value is InquiryTypeValue {
  return (INQUIRY_TYPE_VALUES as readonly string[]).includes(value);
}

export function isInquirySourceValue(value: string): value is InquirySourceValue {
  return (INQUIRY_SOURCE_VALUES as readonly string[]).includes(value);
}

export function isMnemosTransferredInquiry(source: string | null | undefined) {
  return source === INQUIRY_SOURCE_MNEMOS_TRANSFER;
}

export function normalizeInquiryTypeValue(value: string | null | undefined): InquiryTypeValue {
  if (value && isInquiryTypeValue(value)) return value;
  return 'GENERAL';
}

export function canOrganizerMarkInquiryResolved(status: string | null | undefined) {
  return status !== ORGANIZER_INQUIRY_STATUS_VALUE && status !== 'CLOSED';
}
