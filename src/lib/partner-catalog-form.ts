import { getDefaultPartnerCatalogRules } from '@/lib/partner-catalog-rules';
import type { PartnerCatalogRules, QfScaleRow } from '@/types/partner-catalog-rules';

function checkboxName(formData: FormData, key: string) {
  return formData.get(key) === 'on';
}

function parseOptionalInt(formData: FormData, key: string) {
  const parsed = Number.parseInt(String(formData.get(key) ?? '').trim(), 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseOptionalMinInt(formData: FormData, key: string, minimum = 1) {
  const parsed = parseOptionalInt(formData, key);
  if (parsed == null || parsed < minimum) return null;
  return parsed;
}

function parseOptionalFloat(formData: FormData, key: string) {
  const parsed = Number.parseFloat(String(formData.get(key) ?? '').trim().replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
}

function parseOptionalCents(formData: FormData, key: string) {
  const euros = parseOptionalFloat(formData, key);
  if (euros == null) return null;
  return Math.max(0, Math.round(euros * 100));
}

function parseArray(formData: FormData, key: string) {
  const all = formData.getAll(key).map((entry) => String(entry ?? '').trim()).filter(Boolean);
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of all) {
    const normalized = value.toLowerCase();
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(value);
  }
  return result;
}

export function parsePartnerCatalogRulesFromFormData(formData: FormData): PartnerCatalogRules {
  const base = getDefaultPartnerCatalogRules();
  const rules: PartnerCatalogRules = {
    ...base,
    version: Number.parseInt(String(formData.get('version') ?? '1'), 10) || 1,
    blockingRules: {
      ...base.blockingRules,
      ageMin: parseOptionalInt(formData, 'age_min'),
      ageMax: parseOptionalInt(formData, 'age_max'),
      priceMinCents: parseOptionalCents(formData, 'price_min_eur'),
      priceMaxCents: parseOptionalCents(formData, 'price_max_eur'),
      durationMinDays: parseOptionalInt(formData, 'duration_min_days'),
      durationMaxDays: parseOptionalInt(formData, 'duration_max_days'),
      seasonsAllowed: parseArray(formData, 'seasons_allowed'),
      stayTypesAllowed: parseArray(formData, 'stay_types_allowed'),
      stayTypesExcluded: parseArray(formData, 'stay_types_excluded'),
      destinationMode:
        (String(formData.get('destination_mode') ?? 'ANY') as PartnerCatalogRules['blockingRules']['destinationMode']) ??
        'ANY',
      countriesAllowed: parseArray(formData, 'countries_allowed'),
      countriesExcluded: parseArray(formData, 'countries_excluded'),
      organizersAllowed: parseArray(formData, 'organizers_allowed'),
      organizersExcluded: parseArray(formData, 'organizers_excluded'),
      activitiesAllowed: parseArray(formData, 'activities_allowed'),
      activitiesExcluded: parseArray(formData, 'activities_excluded'),
      transportIncludedRequired: false,
      accommodationRequired: checkboxName(formData, 'accommodation_required'),
      partnerOrganizersOnly: checkboxName(formData, 'partner_organizers_only'),
      acmDeclaredRequired: checkboxName(formData, 'acm_declared_required'),
      invoiceRequired: checkboxName(formData, 'invoice_required'),
      childNameOnInvoiceRequired: checkboxName(formData, 'child_name_on_invoice_required'),
      educationalProjectRequired: checkboxName(formData, 'educational_project_required'),
      supervisionInfoRequired: checkboxName(formData, 'supervision_info_required')
    },
    financialRules: {
      ...base.financialRules,
      aidMode:
        (String(formData.get('aid_mode') ?? 'PERCENT') as PartnerCatalogRules['financialRules']['aidMode']) ??
        'PERCENT',
      percentValue: parseOptionalFloat(formData, 'aid_percent'),
      fixedCents: parseOptionalCents(formData, 'aid_fixed_eur'),
      capPerStayCents: parseOptionalCents(formData, 'cap_per_stay_eur'),
      capPerChildYearCents: parseOptionalCents(formData, 'cap_per_child_year_eur'),
      capPerFamilyYearCents: parseOptionalCents(formData, 'cap_per_family_year_eur'),
      capPerDayCents: parseOptionalCents(formData, 'cap_per_day_eur'),
      maxStaysPerChildYear: parseOptionalMinInt(formData, 'max_stays_per_child_year'),
      maxSubsidizedDaysYear: parseOptionalMinInt(formData, 'max_subsidized_days_year'),
      minFamilyRemainderPercent: parseOptionalFloat(formData, 'min_family_remainder_percent'),
      minFamilyRemainderCents: parseOptionalCents(formData, 'min_family_remainder_eur'),
      qfMin: parseOptionalFloat(formData, 'qf_min'),
      qfMax: parseOptionalFloat(formData, 'qf_max')
    },
    qfScale: []
  };

  rules.qfScale = parseQfScaleFromFormData(formData);

  if (rules.qfScale.length > 0) {
    rules.financialRules.aidMode = 'QF_SCALE';
  }

  if (rules.financialRules.aidMode === 'PERCENT') {
    rules.financialRules.fixedCents = null;
  } else if (rules.financialRules.aidMode === 'FIXED') {
    rules.financialRules.percentValue = null;
    rules.qfScale = [];
  } else {
    rules.financialRules.percentValue = null;
    rules.financialRules.fixedCents = null;
  }

  return rules;
}

export function parseQfScaleFromFormData(formData: FormData): QfScaleRow[] {
  const rowCount = Number.parseInt(String(formData.get('qf_row_count') ?? '3'), 10);
  const scaleModeRaw = String(formData.get('qf_scale_mode') ?? formData.get('qf_mode_0') ?? 'PERCENT').trim();
  const scaleMode = scaleModeRaw === 'FIXED' ? 'FIXED' : 'PERCENT';
  const rows: QfScaleRow[] = [];

  for (let index = 0; index < Math.max(0, rowCount); index += 1) {
    const minQf = parseOptionalFloat(formData, `qf_min_${index}`);
    const maxQf = parseOptionalFloat(formData, `qf_max_${index}`);
    const percentValue =
      scaleMode === 'PERCENT' ? parseOptionalFloat(formData, `qf_percent_${index}`) : null;
    const fixedCents =
      scaleMode === 'FIXED' ? parseOptionalCents(formData, `qf_fixed_eur_${index}`) : null;
    if (minQf == null) continue;
    rows.push({
      id: `row-${index}`,
      minQf,
      maxQf,
      aidMode: scaleMode,
      percentValue,
      fixedCents
    });
  }

  return rows;
}
