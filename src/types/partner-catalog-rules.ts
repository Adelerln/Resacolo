export type AidMode = 'PERCENT' | 'FIXED' | 'QF_SCALE';

export type QfScaleRow = {
  id: string;
  minQf: number;
  maxQf: number | null;
  aidMode: Exclude<AidMode, 'QF_SCALE'>;
  percentValue: number | null;
  fixedCents: number | null;
};

export type PartnerCatalogRules = {
  version: number;
  blockingRules: {
    ageMin: number | null;
    ageMax: number | null;
    priceMinCents: number | null;
    priceMaxCents: number | null;
    durationMinDays: number | null;
    durationMaxDays: number | null;
    seasonsAllowed: string[];
    stayTypesAllowed: string[];
    stayTypesExcluded: string[];
    destinationMode: 'ANY' | 'FRANCE_ONLY' | 'EUROPE_ONLY';
    countriesAllowed: string[];
    countriesExcluded: string[];
    organizersAllowed: string[];
    organizersExcluded: string[];
    activitiesAllowed: string[];
    activitiesExcluded: string[];
    transportIncludedRequired: boolean;
    accommodationRequired: boolean;
    partnerOrganizersOnly: boolean;
    acmDeclaredRequired: boolean;
    invoiceRequired: boolean;
    childNameOnInvoiceRequired: boolean;
    educationalProjectRequired: boolean;
    supervisionInfoRequired: boolean;
  };
  financialRules: {
    aidMode: AidMode;
    percentValue: number | null;
    fixedCents: number | null;
    capPerStayCents: number | null;
    capPerChildYearCents: number | null;
    capPerFamilyYearCents: number | null;
    capPerDayCents: number | null;
    maxStaysPerChildYear: number | null;
    maxSubsidizedDaysYear: number | null;
    minFamilyRemainderPercent: number | null;
    minFamilyRemainderCents: number | null;
    qfMin: number | null;
    qfMax: number | null;
  };
  qfScale: QfScaleRow[];
  meta?: {
    /** Pays déjà vus sur le site ; sert à détecter les nouvelles destinations. */
    knownSiteCountries: string[];
  };
};

export type EligibilityReasonCode =
  | 'AGE_MIN'
  | 'AGE_MAX'
  | 'PRICE_MIN'
  | 'PRICE_MAX'
  | 'DURATION_MIN'
  | 'DURATION_MAX'
  | 'SEASON_NOT_ALLOWED'
  | 'STAY_TYPE_EXCLUDED'
  | 'STAY_TYPE_NOT_ALLOWED'
  | 'DESTINATION_NOT_ALLOWED'
  | 'COUNTRY_EXCLUDED'
  | 'ORGANIZER_NOT_ALLOWED'
  | 'ORGANIZER_EXCLUDED'
  | 'ACTIVITY_EXCLUDED'
  | 'ACTIVITY_NOT_ALLOWED'
  | 'TRANSPORT_REQUIRED'
  | 'ACCOMMODATION_REQUIRED'
  | 'PARTNER_ORGANIZER_REQUIRED'
  | 'ACM_DECLARATION_REQUIRED'
  | 'INVOICE_REQUIRED'
  | 'CHILD_NAME_INVOICE_REQUIRED'
  | 'EDUCATIONAL_PROJECT_REQUIRED'
  | 'SUPERVISION_REQUIRED';

export type EligibilityResult = {
  status: 'ELIGIBLE' | 'INELIGIBLE';
  reasons: Array<{
    code: EligibilityReasonCode;
    message: string;
  }>;
};

export type AidSimulationResult = {
  aidCents: number;
  familyCents: number;
  appliedMode: AidMode | 'QF_ROW_PERCENT' | 'QF_ROW_FIXED';
  appliedCapLabels: string[];
  appliedSummary: string;
  warnings: string[];
};
