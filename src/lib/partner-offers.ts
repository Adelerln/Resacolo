export const PARTNER_OFFER_VALUES = ['IDENTITE', 'SERENITE'] as const;

export type PartnerOfferValue = (typeof PARTNER_OFFER_VALUES)[number];

export const PARTNER_OFFER_LABELS: Record<PartnerOfferValue, string> = {
  IDENTITE: 'Identité',
  SERENITE: 'Sérénité'
};

export const PARTNER_OFFER_DESCRIPTIONS: Record<PartnerOfferValue, string> = {
  IDENTITE:
    'Offre centrée sur la présence de marque et la personnalisation visuelle de l’espace partenaire.',
  SERENITE:
    'Offre avec accompagnement renforcé et paramétrage partenaire plus complet pour un usage opérationnel.'
};

export function normalizePartnerOffer(value: string | null | undefined): PartnerOfferValue {
  return value === 'SERENITE' ? 'SERENITE' : 'IDENTITE';
}

/** La marque blanche (logo, couleurs, texte d’accueil) est réservée à la formule Identité. */
export function partnerHasMarqueBlancheAccess(offerMode: string | null | undefined): boolean {
  return normalizePartnerOffer(offerMode) === 'IDENTITE';
}

export const PARTNER_FINANCE_MODE_VALUES = ['TOTAL', 'NONE', 'PERCENT', 'FIXED', 'MANUAL'] as const;

export type PartnerFinanceModeValue = (typeof PARTNER_FINANCE_MODE_VALUES)[number];

export const PARTNER_FINANCE_MODE_LABELS: Record<PartnerFinanceModeValue, string> = {
  TOTAL: 'Prise en charge totale',
  NONE: 'Pas de financement',
  PERCENT: 'Quote-part en %',
  FIXED: 'Quote-part fixe',
  MANUAL: 'Calcul manuel'
};

export function normalizePartnerFinanceMode(value: string | null | undefined): PartnerFinanceModeValue {
  switch (value) {
    case 'NONE':
    case 'PERCENT':
    case 'FIXED':
    case 'MANUAL':
      return value;
    case 'TOTAL':
    default:
      return 'TOTAL';
  }
}

export function clampPartnerFinancePercent(value: number | null | undefined) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, Number(value)));
}

export function clampPartnerFinanceCents(value: number | null | undefined, totalCents: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(Math.max(Math.round(Number(value)), 0), Math.max(totalCents, 0));
}

export function computePartnerFinanceSplit(input: {
  mode: string | null | undefined;
  totalCents: number;
  percentValue?: number | null;
  fixedCents?: number | null;
  manualPartnerCents?: number | null;
}) {
  const totalCents = Math.max(0, Math.round(input.totalCents));
  const mode = normalizePartnerFinanceMode(input.mode);
  let partnerCents = 0;

  switch (mode) {
    case 'TOTAL':
      partnerCents = totalCents;
      break;
    case 'NONE':
      partnerCents = 0;
      break;
    case 'PERCENT':
      partnerCents = Math.round((totalCents * clampPartnerFinancePercent(input.percentValue)) / 100);
      break;
    case 'FIXED':
      partnerCents = clampPartnerFinanceCents(input.fixedCents, totalCents);
      break;
    case 'MANUAL':
      partnerCents = clampPartnerFinanceCents(input.manualPartnerCents, totalCents);
      break;
  }

  const clientCents = Math.max(0, totalCents - partnerCents);

  return {
    mode,
    partnerCents,
    clientCents
  };
}

export function computePartnerContributionSnapshotCents(input: {
  mode: string | null | undefined;
  totalCents: number;
  percentValue?: number | null;
  fixedCents?: number | null;
  capCents?: number | null;
}) {
  const totalCents = Math.max(0, Math.round(input.totalCents));
  let partnerCents = 0;

  if (input.mode === 'PERCENT') {
    partnerCents = Math.round((totalCents * clampPartnerFinancePercent(input.percentValue)) / 100);
  } else {
    partnerCents = Number.isFinite(input.fixedCents) ? Math.max(0, Math.round(Number(input.fixedCents))) : 0;
  }

  if (Number.isFinite(input.capCents)) {
    partnerCents = Math.min(partnerCents, Math.max(0, Math.round(Number(input.capCents))));
  }

  return clampPartnerFinanceCents(partnerCents, totalCents);
}
