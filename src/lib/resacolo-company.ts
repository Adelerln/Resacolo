export const RESACOLO_COMPANY = {
  legalName: 'RESACOLO',
  legalForm: 'SAS',
  shareCapitalLabel: '1 000 EUR',
  addressLine1: '24/26 rue Bichat',
  postalCode: '75010',
  city: 'Paris',
  country: 'France',
  siret: '904 862 158 00014',
  rcsCity: 'Paris',
  rcsNumber: '904 862 158',
  vatNumber: 'FR67904862158',
  atoutFranceRegistration: 'IM075220017',
  /** Mentions obligatoires B2B (art. L441-10 / D441-5 C. com.). */
  latePaymentPenaltyRateLabel:
    'taux d’intérêt appliqué par la Banque centrale européenne à son opération de refinancement la plus récente majoré de 10 points de pourcentage',
  latePaymentFixedFeeEuros: 40,
  professionalInsurance: {
    insurer: 'HISCOX SA',
    address: "49 AVENUE DE L'OPÉRA, 75002 PARIS, FRANCE"
  }
} as const;

export const RESACOLO_INVOICE_LATE_PAYMENT_MENTIONS = [
  `En cas de non-paiement à la date de règlement, des pénalités de retard au ${RESACOLO_COMPANY.latePaymentPenaltyRateLabel} seront exigibles le jour suivant ladite date, sans qu’un rappel soit nécessaire.`,
  `Indemnité forfaitaire pour frais de recouvrement : ${RESACOLO_COMPANY.latePaymentFixedFeeEuros} €.`
] as const;

