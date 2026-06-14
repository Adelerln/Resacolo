/** Libellés et formatage d’affichage pour l’interface Mnemos (français). */

export function mnemosLabel(label: string) {
  const trimmed = label.trimEnd();
  if (trimmed.endsWith(':') || trimmed.endsWith(' :')) {
    return trimmed.endsWith(' :') ? trimmed : `${trimmed} :`;
  }
  return `${trimmed} :`;
}

const STATUS_LABELS: Record<string, string> = {
  NEW: 'Nouveau',
  IN_PROGRESS: 'En cours',
  OPEN: 'Ouvert',
  ANSWERED: 'Résolu',
  CLOSED: 'Clôturé',
  RESOLVED: 'Résolu',
  ISSUED: 'Émise',
  DRAFT: 'Brouillon',
  CANCELLED: 'Annulée',
  PAID: 'Payée'
};

const INQUIRY_TYPE_LABELS: Record<string, string> = {
  GENERAL: 'Général',
  OTHER: 'Autre'
};

const INQUIRY_SOURCE_LABELS: Record<string, string> = {
  CONTACT_FORM: 'Formulaire de contact',
  PLATFORM: 'Assistant en ligne',
  MNEMOS: 'Mnemos (interne)',
  MNEMOS_TRANSFER: 'Transféré à un organisateur'
};

const INVOICE_TYPE_LABELS: Record<string, string> = {
  MNEMOS_PUBLICATION_PERIOD: 'Publications (période)',
  MNEMOS_COMMISSION_PERIOD: 'Commissions (période)'
};

const BILLING_EVENT_LABELS: Record<string, string> = {
  INVOICE_PUBLICATION_PERIOD: 'Facture publications (période)',
  INVOICE_COMMISSION_PERIOD: 'Facture commissions (période)'
};

const STAFF_ROLE_LABELS: Record<string, string> = {
  MNEMOS: 'Mnemos',
  ADMIN: 'Administrateur',
  ADMIN_SALES: 'Commercial admin',
  SALES_ADMIN: 'Commercial admin',
  ORGANISATEUR: 'Organisateur',
  PARTENAIRE: 'Partenaire',
  CLIENT: 'Client'
};

const LEDGER_CHANNEL_LABELS: Record<string, string> = {
  CLIENT: 'CLIENT',
  PARTNER: 'PARTENAIRE',
  NA: 'N/A',
  DIRECT: 'Direct',
  MARKETPLACE: 'Place de marché',
  WEB: 'Web'
};

const REVOKE_REASON_LABELS: Record<string, string> = {
  'Revoked from mnemos': 'Retiré depuis Mnemos'
};

export function formatMnemosStatus(value: string | null | undefined) {
  if (!value) return '—';
  return STATUS_LABELS[value] ?? humanizeToken(value);
}

export function formatMnemosInquiryType(value: string | null | undefined) {
  if (!value) return '—';
  return INQUIRY_TYPE_LABELS[value] ?? humanizeToken(value);
}

export function formatMnemosInquirySource(value: string | null | undefined) {
  if (!value) return '—';
  return INQUIRY_SOURCE_LABELS[value] ?? humanizeToken(value);
}

export function formatMnemosInvoiceType(value: string | null | undefined) {
  if (!value) return '—';
  return INVOICE_TYPE_LABELS[value] ?? humanizeToken(value);
}

export function formatMnemosBillingEventType(value: string | null | undefined) {
  if (!value) return '—';
  return BILLING_EVENT_LABELS[value] ?? humanizeToken(value);
}

export function formatMnemosStaffRole(value: string | null | undefined) {
  if (!value) return '—';
  return STAFF_ROLE_LABELS[value] ?? humanizeToken(value);
}

export function formatMnemosLedgerChannel(value: string | null | undefined) {
  if (!value) return '—';
  return LEDGER_CHANNEL_LABELS[value] ?? humanizeToken(value);
}

export function formatMnemosRevokeReason(value: string | null | undefined) {
  if (!value) return null;
  return REVOKE_REASON_LABELS[value] ?? value;
}

function humanizeToken(value: string) {
  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}
