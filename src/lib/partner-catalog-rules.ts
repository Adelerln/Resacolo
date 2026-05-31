import { z } from 'zod';
import type { PartnerCatalogRules, EligibilityResult, AidSimulationResult, QfScaleRow } from '@/types/partner-catalog-rules';

const qfRowSchema = z.object({
  id: z.string().min(1),
  minQf: z.number().min(0),
  maxQf: z.number().min(0).nullable(),
  aidMode: z.enum(['PERCENT', 'FIXED']),
  percentValue: z.number().min(0).max(100).nullable(),
  fixedCents: z.number().min(0).int().nullable()
});

const partnerCatalogRulesSchema = z.object({
  version: z.number().int().min(1).default(1),
  blockingRules: z.object({
    ageMin: z.number().int().min(0).nullable(),
    ageMax: z.number().int().min(0).nullable(),
    priceMinCents: z.number().int().min(0).nullable(),
    priceMaxCents: z.number().int().min(0).nullable(),
    durationMinDays: z.number().int().min(1).nullable(),
    durationMaxDays: z.number().int().min(1).nullable(),
    seasonsAllowed: z.array(z.string().min(1)),
    stayTypesAllowed: z.array(z.string().min(1)),
    stayTypesExcluded: z.array(z.string().min(1)),
    destinationMode: z.enum(['ANY', 'FRANCE_ONLY', 'EUROPE_ONLY']),
    countriesAllowed: z.array(z.string().min(1)),
    countriesExcluded: z.array(z.string().min(1)),
    organizersAllowed: z.array(z.string().min(1)),
    organizersExcluded: z.array(z.string().min(1)),
    activitiesAllowed: z.array(z.string().min(1)),
    activitiesExcluded: z.array(z.string().min(1)),
    transportIncludedRequired: z.boolean(),
    accommodationRequired: z.boolean(),
    partnerOrganizersOnly: z.boolean(),
    acmDeclaredRequired: z.boolean(),
    invoiceRequired: z.boolean(),
    childNameOnInvoiceRequired: z.boolean(),
    educationalProjectRequired: z.boolean(),
    supervisionInfoRequired: z.boolean()
  }),
  financialRules: z.object({
    aidMode: z.enum(['PERCENT', 'FIXED', 'QF_SCALE']),
    percentValue: z.number().min(0).max(100).nullable(),
    fixedCents: z.number().int().min(0).nullable(),
    capPerStayCents: z.number().int().min(0).nullable(),
    capPerChildYearCents: z.number().int().min(0).nullable(),
    capPerFamilyYearCents: z.number().int().min(0).nullable(),
    capPerDayCents: z.number().int().min(0).nullable(),
    maxStaysPerChildYear: z.number().int().min(1).nullable(),
    maxSubsidizedDaysYear: z.number().int().min(1).nullable(),
    minFamilyRemainderPercent: z.number().min(0).max(100).nullable(),
    minFamilyRemainderCents: z.number().int().min(0).nullable(),
    qfMin: z.number().min(0).nullable(),
    qfMax: z.number().min(0).nullable()
  }),
  qfScale: z.array(qfRowSchema),
  meta: z
    .object({
      knownSiteCountries: z.array(z.string().min(1))
    })
    .optional()
});

export function getDefaultPartnerCatalogRules(): PartnerCatalogRules {
  return {
    version: 1,
    blockingRules: {
      ageMin: null,
      ageMax: null,
      priceMinCents: null,
      priceMaxCents: null,
      durationMinDays: null,
      durationMaxDays: null,
      seasonsAllowed: [],
      stayTypesAllowed: [],
      stayTypesExcluded: [],
      destinationMode: 'ANY',
      countriesAllowed: [],
      countriesExcluded: [],
      organizersAllowed: [],
      organizersExcluded: [],
      activitiesAllowed: [],
      activitiesExcluded: [],
      transportIncludedRequired: false,
      accommodationRequired: false,
      partnerOrganizersOnly: false,
      acmDeclaredRequired: false,
      invoiceRequired: false,
      childNameOnInvoiceRequired: false,
      educationalProjectRequired: false,
      supervisionInfoRequired: false
    },
    financialRules: {
      aidMode: 'PERCENT',
      percentValue: null,
      fixedCents: null,
      capPerStayCents: null,
      capPerChildYearCents: null,
      capPerFamilyYearCents: null,
      capPerDayCents: null,
      maxStaysPerChildYear: null,
      maxSubsidizedDaysYear: null,
      minFamilyRemainderPercent: 0,
      minFamilyRemainderCents: null,
      qfMin: null,
      qfMax: null
    },
    qfScale: [],
    meta: {
      knownSiteCountries: []
    }
  };
}

function normalizeStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => String(entry ?? '').trim()).filter(Boolean);
}

export function normalizePartnerCatalogRules(value: unknown): PartnerCatalogRules {
  const defaultRules = getDefaultPartnerCatalogRules();
  const record = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;
  const merged = {
    ...defaultRules,
    ...record,
    blockingRules: {
      ...defaultRules.blockingRules,
      ...(record.blockingRules && typeof record.blockingRules === 'object' ? record.blockingRules : {})
    },
    financialRules: {
      ...defaultRules.financialRules,
      ...(record.financialRules && typeof record.financialRules === 'object' ? record.financialRules : {})
    },
    qfScale: Array.isArray(record.qfScale) ? record.qfScale : defaultRules.qfScale
  } as PartnerCatalogRules;

  merged.blockingRules.seasonsAllowed = normalizeStringList(merged.blockingRules.seasonsAllowed);
  merged.blockingRules.stayTypesAllowed = normalizeStringList(merged.blockingRules.stayTypesAllowed);
  merged.blockingRules.stayTypesExcluded = normalizeStringList(merged.blockingRules.stayTypesExcluded);
  merged.blockingRules.countriesAllowed = normalizeStringList(merged.blockingRules.countriesAllowed);
  merged.blockingRules.countriesExcluded = normalizeStringList(merged.blockingRules.countriesExcluded);
  merged.blockingRules.organizersAllowed = normalizeStringList(merged.blockingRules.organizersAllowed);
  merged.blockingRules.organizersExcluded = normalizeStringList(merged.blockingRules.organizersExcluded);
  merged.blockingRules.activitiesAllowed = normalizeStringList(merged.blockingRules.activitiesAllowed);
  merged.blockingRules.activitiesExcluded = normalizeStringList(merged.blockingRules.activitiesExcluded);

  const meta =
    record.meta && typeof record.meta === 'object'
      ? (record.meta as PartnerCatalogRules['meta'])
      : defaultRules.meta;
  merged.meta = {
    knownSiteCountries: normalizeStringList(meta?.knownSiteCountries)
  };

  return merged;
}

function validateQfScaleRows(rows: QfScaleRow[]) {
  const sorted = [...rows].sort((a, b) => a.minQf - b.minQf);
  for (let i = 0; i < sorted.length; i += 1) {
    const row = sorted[i];
    if (row.maxQf != null && row.maxQf < row.minQf) {
      throw new Error(`Tranche QF invalide (${row.minQf}-${row.maxQf}).`);
    }
    if (row.aidMode === 'PERCENT' && row.percentValue == null) {
      throw new Error(`Tranche QF invalide (${row.minQf}-${row.maxQf ?? '∞'}) : taux obligatoire.`);
    }
    if (row.aidMode === 'FIXED' && row.fixedCents == null) {
      throw new Error(`Tranche QF invalide (${row.minQf}-${row.maxQf ?? '∞'}) : forfait obligatoire.`);
    }
    if (i === 0) continue;
    const prev = sorted[i - 1];
    if (prev.maxQf == null) {
      throw new Error('Une tranche QF ouverte ne peut pas être suivie d’une autre tranche.');
    }
    if (row.minQf <= prev.maxQf) {
      throw new Error('Les tranches QF se chevauchent.');
    }
  }
}

export function parseAndValidatePartnerCatalogRules(value: unknown): PartnerCatalogRules {
  const normalized = normalizePartnerCatalogRules(value);
  const parsed = partnerCatalogRulesSchema.parse(normalized);

  const { ageMin, ageMax, priceMinCents, priceMaxCents, durationMinDays, durationMaxDays } = parsed.blockingRules;
  if (ageMin != null && ageMax != null && ageMin > ageMax) {
    throw new Error("L'âge minimum ne peut pas dépasser l'âge maximum.");
  }
  if (priceMinCents != null && priceMaxCents != null && priceMinCents > priceMaxCents) {
    throw new Error('Le prix minimum ne peut pas dépasser le prix maximum.');
  }
  if (durationMinDays != null && durationMaxDays != null && durationMinDays > durationMaxDays) {
    throw new Error('La durée minimum ne peut pas dépasser la durée maximum.');
  }
  if (parsed.financialRules.qfMin != null && parsed.financialRules.qfMax != null && parsed.financialRules.qfMin > parsed.financialRules.qfMax) {
    throw new Error('Le QF minimum ne peut pas dépasser le QF maximum.');
  }
  if (parsed.financialRules.aidMode === 'PERCENT' && parsed.financialRules.percentValue == null) {
    throw new Error("Le type d'aide Pourcentage nécessite un taux.");
  }
  if (parsed.financialRules.aidMode === 'FIXED' && parsed.financialRules.fixedCents == null) {
    throw new Error("Le type d'aide Forfait nécessite un montant fixe.");
  }

  if (parsed.financialRules.aidMode === 'QF_SCALE' && parsed.qfScale.length === 0) {
    throw new Error('Le mode barème QF nécessite au moins une tranche.');
  }
  validateQfScaleRows(parsed.qfScale);
  return parsed;
}

function normalizeCountry(value: string | null | undefined) {
  return String(value ?? '').trim().toUpperCase();
}

function includesAny(text: string, patterns: string[]) {
  const normalized = text.toLowerCase();
  return patterns.some((pattern) => normalized.includes(pattern.toLowerCase()));
}

export function evaluatePartnerCatalogEligibility(input: {
  rules: PartnerCatalogRules;
  stay: {
    age_min: number | null;
    age_max: number | null;
    categories: string[];
    destination_country: string | null;
    destination_countries: string[] | null;
    transport_mode: string;
    required_documents_text: string | null;
    education_project_path?: string | null;
    supervision_text: string | null;
  };
  session: {
    start_date: string;
    end_date: string;
  };
  priceCents: number;
  organizer: {
    id: string;
    is_resacolo_member: boolean;
  };
}): EligibilityResult {
  const reasons: EligibilityResult['reasons'] = [];
  const rules = input.rules.blockingRules;
  const stay = input.stay;

  const durationDays = Math.max(
    1,
    Math.ceil(
      (new Date(`${input.session.end_date}T00:00:00Z`).getTime() -
        new Date(`${input.session.start_date}T00:00:00Z`).getTime()) /
        (24 * 60 * 60 * 1000)
    ) + 1
  );

  if (rules.ageMin != null && stay.age_min != null && stay.age_min < rules.ageMin) {
    reasons.push({ code: 'AGE_MIN', message: `Âge minimum inférieur à ${rules.ageMin} ans.` });
  }
  if (rules.ageMax != null && stay.age_max != null && stay.age_max > rules.ageMax) {
    reasons.push({ code: 'AGE_MAX', message: `Âge maximum supérieur à ${rules.ageMax} ans.` });
  }
  if (rules.priceMinCents != null && input.priceCents < rules.priceMinCents) {
    reasons.push({ code: 'PRICE_MIN', message: 'Prix inférieur au seuil minimum.' });
  }
  if (rules.priceMaxCents != null && input.priceCents > rules.priceMaxCents) {
    reasons.push({ code: 'PRICE_MAX', message: 'Prix supérieur au plafond autorisé.' });
  }
  if (rules.durationMinDays != null && durationDays < rules.durationMinDays) {
    reasons.push({ code: 'DURATION_MIN', message: 'Durée de séjour insuffisante.' });
  }
  if (rules.durationMaxDays != null && durationDays > rules.durationMaxDays) {
    reasons.push({ code: 'DURATION_MAX', message: 'Durée de séjour supérieure au maximum.' });
  }

  const categoriesLower = stay.categories.map((c) => c.toLowerCase());
  if (rules.stayTypesAllowed.length > 0) {
    const ok = rules.stayTypesAllowed.some((allowed) => categoriesLower.includes(allowed.toLowerCase()));
    if (!ok) reasons.push({ code: 'STAY_TYPE_NOT_ALLOWED', message: 'Type de séjour non autorisé.' });
  }
  if (rules.stayTypesExcluded.length > 0) {
    const excluded = rules.stayTypesExcluded.some((excludedType) => categoriesLower.includes(excludedType.toLowerCase()));
    if (excluded) reasons.push({ code: 'STAY_TYPE_EXCLUDED', message: 'Type de séjour explicitement exclu.' });
  }

  const country = normalizeCountry(stay.destination_country);
  const allCountries = [country, ...(stay.destination_countries ?? []).map(normalizeCountry)].filter(Boolean);
  if (rules.destinationMode === 'FRANCE_ONLY' && !allCountries.includes('FRANCE') && !allCountries.includes('FR')) {
    reasons.push({ code: 'DESTINATION_NOT_ALLOWED', message: 'Destination hors France.' });
  }
  if (rules.countriesAllowed.length > 0) {
    const allowedSet = new Set(rules.countriesAllowed.map(normalizeCountry));
    if (!allCountries.some((entry) => allowedSet.has(entry))) {
      reasons.push({ code: 'DESTINATION_NOT_ALLOWED', message: 'Destination non autorisée.' });
    }
  }
  if (rules.countriesExcluded.length > 0) {
    const excludedSet = new Set(rules.countriesExcluded.map(normalizeCountry));
    if (allCountries.some((entry) => excludedSet.has(entry))) {
      reasons.push({ code: 'COUNTRY_EXCLUDED', message: 'Destination explicitement exclue.' });
    }
  }

  const activitiesText = categoriesLower.join(' ');
  if (rules.activitiesAllowed.length > 0 && !includesAny(activitiesText, rules.activitiesAllowed)) {
    reasons.push({ code: 'ACTIVITY_NOT_ALLOWED', message: 'Aucune activité autorisée détectée.' });
  }
  if (rules.activitiesExcluded.length > 0 && includesAny(activitiesText, rules.activitiesExcluded)) {
    reasons.push({ code: 'ACTIVITY_EXCLUDED', message: 'Activité exclue détectée.' });
  }

  if (rules.transportIncludedRequired && stay.transport_mode === 'NONE') {
    reasons.push({ code: 'TRANSPORT_REQUIRED', message: 'Transport inclus requis.' });
  }
  if (rules.accommodationRequired && !stay.supervision_text?.trim()) {
    reasons.push({ code: 'ACCOMMODATION_REQUIRED', message: 'Hébergement/nuitées requis.' });
  }
  const organizerId = String(input.organizer.id ?? '').trim();
  if (rules.organizersAllowed.length > 0) {
    const allowedSet = new Set(rules.organizersAllowed.map((entry) => entry.trim()));
    if (!organizerId || !allowedSet.has(organizerId)) {
      reasons.push({ code: 'ORGANIZER_NOT_ALLOWED', message: 'Organisateur non autorisé.' });
    }
  }
  if (rules.organizersExcluded.length > 0) {
    const excludedSet = new Set(rules.organizersExcluded.map((entry) => entry.trim()));
    if (organizerId && excludedSet.has(organizerId)) {
      reasons.push({ code: 'ORGANIZER_EXCLUDED', message: 'Organisateur exclu.' });
    }
  }
  if (rules.partnerOrganizersOnly && !input.organizer.is_resacolo_member) {
    reasons.push({ code: 'PARTNER_ORGANIZER_REQUIRED', message: 'Organisateur partenaire requis.' });
  }

  if (rules.acmDeclaredRequired && !includesAny(stay.required_documents_text ?? '', ['acm', 'déclaration', 'declaration'])) {
    reasons.push({ code: 'ACM_DECLARATION_REQUIRED', message: 'Référence ACM manquante.' });
  }
  if (rules.invoiceRequired && !includesAny(stay.required_documents_text ?? '', ['facture'])) {
    reasons.push({ code: 'INVOICE_REQUIRED', message: 'Facture nominative requise.' });
  }
  if (rules.childNameOnInvoiceRequired && !includesAny(stay.required_documents_text ?? '', ['enfant', 'mineur'])) {
    reasons.push({ code: 'CHILD_NAME_INVOICE_REQUIRED', message: "Mention du nom de l'enfant requise." });
  }
  if (rules.educationalProjectRequired && !Boolean(stay.education_project_path?.trim())) {
    reasons.push({ code: 'EDUCATIONAL_PROJECT_REQUIRED', message: 'Projet éducatif requis.' });
  }
  if (rules.supervisionInfoRequired && !Boolean(stay.supervision_text?.trim())) {
    reasons.push({ code: 'SUPERVISION_REQUIRED', message: 'Informations encadrement requises.' });
  }

  return {
    status: reasons.length > 0 ? 'INELIGIBLE' : 'ELIGIBLE',
    reasons
  };
}

function selectQfRow(rows: QfScaleRow[], qfValue: number | null) {
  if (qfValue == null) return null;
  const sorted = [...rows].sort((a, b) => a.minQf - b.minQf);
  return sorted.find((row) => qfValue >= row.minQf && (row.maxQf == null || qfValue <= row.maxQf)) ?? null;
}

export function simulatePartnerAid(input: {
  rules: PartnerCatalogRules;
  priceCents: number;
  durationDays: number;
  qfValue: number | null;
}): AidSimulationResult {
  const totalCents = Math.max(0, Math.round(input.priceCents));
  const warnings: string[] = [];
  const appliedCapLabels: string[] = [];
  let aidCents = 0;
  let appliedMode: AidSimulationResult['appliedMode'] = input.rules.financialRules.aidMode;
  const financial = input.rules.financialRules;

  if (financial.aidMode === 'PERCENT') {
    aidCents = Math.round((totalCents * (financial.percentValue ?? 0)) / 100);
  } else if (financial.aidMode === 'FIXED') {
    aidCents = financial.fixedCents ?? 0;
  } else {
    const row = selectQfRow(input.rules.qfScale, input.qfValue);
    if (!row) {
      warnings.push('Aucune tranche QF correspondante trouvée.');
      aidCents = 0;
    } else if (row.aidMode === 'PERCENT') {
      appliedMode = 'QF_ROW_PERCENT';
      aidCents = Math.round((totalCents * (row.percentValue ?? 0)) / 100);
    } else {
      appliedMode = 'QF_ROW_FIXED';
      aidCents = row.fixedCents ?? 0;
    }
  }

  if (financial.capPerStayCents != null) {
    const nextAid = Math.min(aidCents, financial.capPerStayCents);
    if (nextAid < aidCents) {
      appliedCapLabels.push(`Plafond séjour ${Math.round(financial.capPerStayCents / 100)}€`);
    }
    aidCents = nextAid;
  }
  if (financial.capPerDayCents != null) {
    const perDayCap = financial.capPerDayCents * Math.max(1, input.durationDays);
    const nextAid = Math.min(aidCents, perDayCap);
    if (nextAid < aidCents) {
      appliedCapLabels.push(`Plafond jour ${Math.round(financial.capPerDayCents / 100)}€`);
    }
    aidCents = nextAid;
  }
  if (financial.capPerChildYearCents != null || financial.capPerFamilyYearCents != null || financial.maxStaysPerChildYear != null || financial.maxSubsidizedDaysYear != null) {
    warnings.push("Les plafonds/quotas annuels sont configurés mais ne sont pas totalement simulables dans l'aperçu catalogue.");
  }

  aidCents = Math.max(0, Math.min(aidCents, totalCents));
  let familyCents = Math.max(0, totalCents - aidCents);

  if (financial.minFamilyRemainderPercent != null) {
    const minRemainder = Math.round((totalCents * financial.minFamilyRemainderPercent) / 100);
    if (familyCents < minRemainder) {
      familyCents = minRemainder;
      aidCents = Math.max(0, totalCents - familyCents);
      appliedCapLabels.push(`Reste minimum ${financial.minFamilyRemainderPercent}%`);
    }
  }
  if (financial.minFamilyRemainderCents != null && familyCents < financial.minFamilyRemainderCents) {
    familyCents = financial.minFamilyRemainderCents;
    aidCents = Math.max(0, totalCents - familyCents);
    appliedCapLabels.push(`Reste minimum ${Math.round(financial.minFamilyRemainderCents / 100)}€`);
  }

  const appliedSummaryBase =
    appliedMode === 'PERCENT'
      ? `${financial.percentValue ?? 0}%`
      : appliedMode === 'FIXED'
        ? `${Math.round((financial.fixedCents ?? 0) / 100)}€`
        : appliedMode === 'QF_ROW_PERCENT'
          ? 'Barème QF (%)'
          : appliedMode === 'QF_ROW_FIXED'
            ? 'Barème QF (€)'
            : 'Barème QF';
  const appliedSummary = appliedCapLabels.length > 0
    ? `${appliedSummaryBase} · ${appliedCapLabels.join(' · ')}`
    : appliedSummaryBase;

  return {
    aidCents,
    familyCents,
    appliedMode,
    appliedCapLabels,
    appliedSummary,
    warnings
  };
}
