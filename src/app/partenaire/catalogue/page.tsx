import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requirePartner } from '@/lib/auth/require';
import { canAccessPartnerSection, getPartnerAccessRoleFromSession } from '@/lib/partner-access';
import { getServerSupabaseClient } from '@/lib/supabase/server';
import { listPartnerCatalogStays, readPartnerCollectivity } from '@/lib/partner.server';
import RangeField from '@/components/partner/RangeField';
import StayTypeRulesCards from '@/components/partner/StayTypeRulesCards';
import OrganizerRulesCards from '@/components/partner/OrganizerRulesCards';
import PartnerAppliedCatalogSection, {
  type AppliedCatalogRow
} from '@/components/partner/PartnerAppliedCatalogSection';
import CountryDropdownField from '@/components/partner/CountryDropdownField';
import { buildCatalogCountryOptions, listSiteStayCountryLabels, syncKnownSiteCountriesWithRules } from '@/lib/partner-catalog-countries';
import CatalogQfVisibilityEnhancer from '@/components/partner/CatalogQfVisibilityEnhancer';
import {
  evaluatePartnerCatalogEligibility,
  getDefaultPartnerCatalogRules,
  normalizePartnerCatalogRules,
  parseAndValidatePartnerCatalogRules,
  simulatePartnerAid
} from '@/lib/partner-catalog-rules';
import {
  buildFeatureActivationMessage,
  isMissingAnyColumnError,
  isMissingColumnError
} from '@/lib/supabase-schema-errors';
import type { PartnerCatalogRules } from '@/types/partner-catalog-rules';

type PageProps = {
  searchParams?: Promise<{
    saved?: string;
    published?: string;
    error?: string;
    debug?: string;
    am?: string;
    ap?: string;
  }>;
};

function fieldClassName() {
  return 'mt-1 w-full rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-sm text-slate-900 transition-colors';
}

function checkboxName(formData: FormData, key: string) {
  return formData.get(key) === 'on';
}

function parseOptionalInt(formData: FormData, key: string) {
  const parsed = Number.parseInt(String(formData.get(key) ?? '').trim(), 10);
  return Number.isFinite(parsed) ? parsed : null;
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

function sanitizeRedirectQueryValue(value: string | undefined) {
  return value ? decodeURIComponent(value) : null;
}

function buildCatalogErrorRedirectWithDraftState(formData: FormData, errorMessage: string) {
  const params = new URLSearchParams();
  params.set('error', errorMessage);
  const aidMode = String(formData.get('aid_mode') ?? '').trim();
  const aidPercent = String(formData.get('aid_percent') ?? '').trim();
  if (aidMode) params.set('am', aidMode);
  if (aidPercent) params.set('ap', aidPercent);
  return `/partenaire/catalogue?${params.toString()}`;
}

function formatCurrencyFromCents(value: number) {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value / 100);
}

function parseRulesFromFormData(formData: FormData): PartnerCatalogRules {
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
      transportIncludedRequired: checkboxName(formData, 'transport_included_required'),
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
      maxStaysPerChildYear: parseOptionalInt(formData, 'max_stays_per_child_year'),
      maxSubsidizedDaysYear: parseOptionalInt(formData, 'max_subsidized_days_year'),
      minFamilyRemainderPercent: parseOptionalFloat(formData, 'min_family_remainder_percent'),
      minFamilyRemainderCents: parseOptionalCents(formData, 'min_family_remainder_eur'),
      qfMin: parseOptionalFloat(formData, 'qf_min'),
      qfMax: parseOptionalFloat(formData, 'qf_max')
    },
    qfScale: []
  };

  const rowCount = Number.parseInt(String(formData.get('qf_row_count') ?? '8'), 10);
  for (let index = 0; index < Math.max(0, rowCount); index += 1) {
    const minQf = parseOptionalFloat(formData, `qf_min_${index}`);
    const maxQf = parseOptionalFloat(formData, `qf_max_${index}`);
    const aidMode = String(formData.get(`qf_mode_${index}`) ?? '').trim();
    const percentValue = parseOptionalFloat(formData, `qf_percent_${index}`);
    const fixedCents = parseOptionalCents(formData, `qf_fixed_eur_${index}`);
    if (minQf == null || !aidMode) continue;
    rules.qfScale.push({
      id: `row-${index}`,
      minQf,
      maxQf,
      aidMode: aidMode === 'FIXED' ? 'FIXED' : 'PERCENT',
      percentValue,
      fixedCents
    });
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

function durationDays(startDate: string, endDate: string) {
  return Math.max(
    1,
    Math.ceil(
      (new Date(`${endDate}T00:00:00Z`).getTime() - new Date(`${startDate}T00:00:00Z`).getTime()) /
        (24 * 60 * 60 * 1000)
    ) + 1
  );
}

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

export default async function PartnerCatalogPage({ searchParams }: PageProps) {
  const session = await requirePartner();
  const collectivityId = session.tenantId;
  const accessRole = getPartnerAccessRoleFromSession(session);
  const params = searchParams ? await searchParams : undefined;
  const debugMode = params?.debug === '1';

  if (!canAccessPartnerSection(accessRole, 'catalog')) {
    redirect('/partenaire');
  }

  if (!collectivityId) {
    return (
      <div className="space-y-4">
        <h1 className="admin-page-title">Catalogue</h1>
        <p className="admin-page-subtitle mt-1">Aucune collectivité liée à ce compte.</p>
      </div>
    );
  }

  async function saveDraft(formData: FormData) {
    'use server';
    const nextSession = await requirePartner();
    const accessRole = getPartnerAccessRoleFromSession(nextSession);
    if (!nextSession.tenantId) redirect('/partenaire/catalogue?error=Aucune%20collectivite%20liee');
    if (!canAccessPartnerSection(accessRole, 'catalog')) redirect('/partenaire');

    const siteCountries = await listSiteStayCountryLabels();
    const rules: PartnerCatalogRules = syncKnownSiteCountriesWithRules(
      normalizePartnerCatalogRules(parseRulesFromFormData(formData)),
      siteCountries
    );

    const supabase = getServerSupabaseClient();
    const { error } = await supabase
      .from('collectivities')
      .update({
        catalog_rules_draft: rules,
        updated_at: new Date().toISOString()
      })
      .eq('id', nextSession.tenantId);

    if (error) {
      if (isMissingColumnError(error, 'catalog_rules_draft')) {
        redirect(buildCatalogErrorRedirectWithDraftState(
          formData,
          buildFeatureActivationMessage('L’enregistrement du catalogue')
        ));
      }
      redirect(buildCatalogErrorRedirectWithDraftState(formData, error.message));
    }
    revalidatePath('/partenaire');
    revalidatePath('/partenaire/catalogue');
    redirect('/partenaire/catalogue?saved=1');
  }

  async function publishDraft() {
    'use server';
    const nextSession = await requirePartner();
    const accessRole = getPartnerAccessRoleFromSession(nextSession);
    if (!nextSession.tenantId) redirect('/partenaire/catalogue?error=Aucune%20collectivite%20liee');
    if (!canAccessPartnerSection(accessRole, 'catalog')) redirect('/partenaire');

    const supabase = getServerSupabaseClient();
    const { data, error: readError } = await supabase
      .from('collectivities')
      .select('catalog_rules_draft')
      .eq('id', nextSession.tenantId)
      .maybeSingle();
    if (readError) {
      if (isMissingColumnError(readError, 'catalog_rules_draft')) {
        redirect(
          `/partenaire/catalogue?error=${encodeURIComponent(
            buildFeatureActivationMessage('Le catalogue partenaire')
          )}`
        );
      }
      redirect(`/partenaire/catalogue?error=${encodeURIComponent(readError.message)}`);
    }

    const siteCountries = await listSiteStayCountryLabels();
    let validated: PartnerCatalogRules;
    try {
      validated = parseAndValidatePartnerCatalogRules(
        syncKnownSiteCountriesWithRules(
          normalizePartnerCatalogRules(data?.catalog_rules_draft ?? getDefaultPartnerCatalogRules()),
          siteCountries
        )
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Configuration invalide';
      redirect(`/partenaire/catalogue?error=${encodeURIComponent(message)}`);
    }

    const now = new Date().toISOString();
    const { error } = await supabase
      .from('collectivities')
      .update({
        catalog_rules_published: validated,
        catalog_rules_published_at: now,
        updated_at: now
      })
      .eq('id', nextSession.tenantId);
    if (error) {
      if (isMissingAnyColumnError(error, ['catalog_rules_published', 'catalog_rules_published_at'])) {
        redirect(
          `/partenaire/catalogue?error=${encodeURIComponent(
            buildFeatureActivationMessage('La publication des règles catalogue')
          )}`
        );
      }
      redirect(`/partenaire/catalogue?error=${encodeURIComponent(error.message)}`);
    }
    revalidatePath('/partenaire');
    revalidatePath('/partenaire/catalogue');
    redirect('/partenaire/catalogue?published=1');
  }

  const [collectivity, rawCatalogRows, siteCountries] = await Promise.all([
    readPartnerCollectivity(collectivityId),
    listPartnerCatalogStays(),
    listSiteStayCountryLabels()
  ]);

  const draftRules = normalizePartnerCatalogRules(
    collectivity.catalog_rules_draft ?? getDefaultPartnerCatalogRules()
  );
  const runtimeAidModeParam = String(params?.am ?? '').trim();
  const runtimeAidPercentParam = String(params?.ap ?? '').trim();
  if (runtimeAidModeParam === 'PERCENT' || runtimeAidModeParam === 'FIXED' || runtimeAidModeParam === 'QF_SCALE') {
    draftRules.financialRules.aidMode = runtimeAidModeParam;
  }
  if (runtimeAidPercentParam) {
    const parsed = Number.parseFloat(runtimeAidPercentParam.replace(',', '.'));
    if (Number.isFinite(parsed)) {
      draftRules.financialRules.percentValue = parsed;
    }
  }
  const draftValidationWarning = (() => {
    try {
      parseAndValidatePartnerCatalogRules(draftRules);
      return null;
    } catch (error) {
      return error instanceof Error ? error.message : 'Configuration incomplète';
    }
  })();
  const publishedRules = normalizePartnerCatalogRules(
    collectivity.catalog_rules_published ?? draftRules
  );
  const qfRows =
    draftRules.qfScale.length > 0
      ? draftRules.qfScale
      : Array.from({ length: 4 }).map((_, index) => ({
          id: `default-${index}`,
          minQf: 0,
          maxQf: null,
          aidMode: 'PERCENT' as const,
          percentValue: null,
          fixedCents: null
        }));

  const seasonOptions = Array.from(
    new Set(rawCatalogRows.map((stay) => stay.season_name).filter(Boolean))
  );
  const stayTypeOptions = Array.from(
    new Set(rawCatalogRows.flatMap((stay) => stay.categories ?? []).filter(Boolean))
  );
  const organizerOptions = Array.from(
    new Map(
      rawCatalogRows.map((stay) => [
        stay.organizer_id,
        { id: stay.organizer_id, name: stay.organizer_name }
      ])
    ).values()
  );
  const allCountryOptions = buildCatalogCountryOptions(siteCountries, draftRules);

  const excludedReasonCounts = new Map<string, number>();
  const catalogRows = rawCatalogRows.flatMap((stay) =>
    stay.sessions.map((sessionItem) => {
      const eligibility = evaluatePartnerCatalogEligibility({
        rules: publishedRules,
        stay: {
          age_min: stay.age_min,
          age_max: stay.age_max,
          categories: stay.categories ?? [],
          destination_country: stay.destination_country,
          destination_countries: stay.destination_countries,
          transport_mode: stay.transport_mode,
          required_documents_text: stay.required_documents_text,
          education_project_path: stay.education_project_path,
          supervision_text: stay.supervision_text
        },
        session: {
          start_date: sessionItem.start_date,
          end_date: sessionItem.end_date
        },
        priceCents: sessionItem.estimated_price_cents,
        organizer: {
          id: stay.organizer_id,
          is_resacolo_member: stay.organizer_is_partner
        }
      });

      if (eligibility.reasons[0]) {
        excludedReasonCounts.set(
          eligibility.reasons[0].message,
          (excludedReasonCounts.get(eligibility.reasons[0].message) ?? 0) + 1
        );
      }

      const simulation = simulatePartnerAid({
        rules: publishedRules,
        priceCents: sessionItem.estimated_price_cents,
        durationDays: durationDays(sessionItem.start_date, sessionItem.end_date),
        qfValue:
          publishedRules.financialRules.qfMax != null
            ? ((publishedRules.financialRules.qfMin ?? 0) +
                publishedRules.financialRules.qfMax) /
              2
            : (publishedRules.financialRules.qfMin ?? 1200)
      });

      return { stay, sessionItem, eligibility, simulation };
    })
  );

  const topExclusions = Array.from(excludedReasonCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const errorMessage = sanitizeRedirectQueryValue(params?.error);
  const isSaved = params?.saved === '1';
  const isPublished = params?.published === '1';
  const displayedRows = debugMode
    ? catalogRows
    : catalogRows.filter((row) => row.eligibility.status === 'ELIGIBLE');
  const appliedCatalogRows: AppliedCatalogRow[] = displayedRows.map((row) => ({
    rowKey: `${row.stay.id}:${row.sessionItem.id}`,
    title: row.stay.title,
    organizerName: row.stay.organizer_name,
    seasonName: row.stay.season_name,
    eligibilityStatus: row.eligibility.status,
    eligibilityLabel: row.eligibility.status === 'ELIGIBLE' ? 'Éligible' : 'Inéligible',
    aidLabel: formatCurrencyFromCents(row.simulation.aidCents),
    appliedSummary: row.simulation.appliedSummary,
    sessionRangeLabel: `${new Date(`${row.sessionItem.start_date}T00:00:00Z`).toLocaleDateString('fr-FR')} - ${new Date(`${row.sessionItem.end_date}T00:00:00Z`).toLocaleDateString('fr-FR')}`,
    priceLabel: formatCurrencyFromCents(row.sessionItem.estimated_price_cents || 0),
    familyLabel: formatCurrencyFromCents(row.simulation.familyCents),
    ineligibleReason:
      row.eligibility.status === 'INELIGIBLE' && row.eligibility.reasons[0]
        ? row.eligibility.reasons[0].message
        : null,
    capLabels:
      row.simulation.appliedCapLabels.length > 0 ? row.simulation.appliedCapLabels.join(' · ') : null,
    warning: row.simulation.warnings[0] ?? null
  }));
  const avgAidCents =
    catalogRows.length > 0
      ? Math.round(catalogRows.reduce((sum, row) => sum + row.simulation.aidCents, 0) / catalogRows.length)
      : 0;
  const avgFamilyCents =
    catalogRows.length > 0
      ? Math.round(catalogRows.reduce((sum, row) => sum + row.simulation.familyCents, 0) / catalogRows.length)
      : 0;
  const zeroAidCount = catalogRows.filter((row) => row.simulation.aidCents === 0).length;

  return (
    <div className="space-y-6">
      <div className="bg-slate-50 pb-3">
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm sm:px-6 lg:px-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="admin-page-title">Catalogue</h1>
              <p className="admin-page-subtitle mt-1">
                Paramétrage des règles d’éligibilité CSE pour {collectivity.name ?? 'votre partenaire'}.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <a
                href={debugMode ? '/partenaire/catalogue' : '/partenaire/catalogue?debug=1'}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
              >
                {debugMode ? 'Masquer inéligibles' : 'Mode debug'}
              </a>
              <form action={publishDraft}>
                <button className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
                  Publier
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>

      {errorMessage ? (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {errorMessage}
        </p>
      ) : null}
      {isSaved ? (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          Enregistré.
        </p>
      ) : null}
      {isPublished ? (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          Règles publiées.
        </p>
      ) : null}
      {draftValidationWarning ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          Enregistré avec avertissement: {draftValidationWarning}
        </p>
      ) : null}

      <form id="partner-catalog-form" action={saveDraft} className="space-y-4">
        <CatalogQfVisibilityEnhancer />
        <input type="hidden" name="version" value={String(draftRules.version)} />
        <input type="hidden" name="qf_row_count" value={String(Math.max(qfRows.length, 8))} />

        <details open className="rounded-2xl border border-slate-200 bg-white p-5">
          <summary className="flex cursor-pointer list-none items-center justify-between text-2xl font-semibold text-slate-900">
            <span>Éligibilité du séjour</span>
            <span aria-hidden="true" className="text-base text-slate-500">
              ▾
            </span>
          </summary>
          <div className="mt-4 space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <RangeField
                label="Âge enfant"
                minName="age_min"
                maxName="age_max"
                minLimit={4}
                maxLimit={17}
                defaultMin={draftRules.blockingRules.ageMin}
                defaultMax={draftRules.blockingRules.ageMax}
                unit=" ans"
              />
              <RangeField
                label="Prix séjour"
                minName="price_min_eur"
                maxName="price_max_eur"
                minLimit={0}
                maxLimit={3000}
                step={50}
                defaultMin={
                  draftRules.blockingRules.priceMinCents != null
                    ? Math.round(draftRules.blockingRules.priceMinCents / 100)
                    : null
                }
                defaultMax={
                  draftRules.blockingRules.priceMaxCents != null
                    ? Math.round(draftRules.blockingRules.priceMaxCents / 100)
                    : null
                }
                unit=" €"
              />
              <RangeField
                label="Durée séjour"
                minName="duration_min_days"
                maxName="duration_max_days"
                minLimit={1}
                maxLimit={30}
                defaultMin={draftRules.blockingRules.durationMinDays}
                defaultMax={draftRules.blockingRules.durationMaxDays}
                unit=" j"
              />
              <label className="text-sm font-medium text-slate-700">
                Mode destination
                <select
                  name="destination_mode"
                  defaultValue={draftRules.blockingRules.destinationMode}
                  className={fieldClassName()}
                >
                  <option value="ANY">Tous pays</option>
                  <option value="FRANCE_ONLY">France uniquement</option>
                  <option value="EUROPE_ONLY">Europe uniquement</option>
                </select>
              </label>
            </div>

            <StayTypeRulesCards
              stayTypeOptions={stayTypeOptions}
              seasonOptions={seasonOptions}
              initialAllowed={draftRules.blockingRules.stayTypesAllowed}
              initialExcluded={draftRules.blockingRules.stayTypesExcluded}
              initialSeasons={draftRules.blockingRules.seasonsAllowed}
            />

            <OrganizerRulesCards
              organizerOptions={organizerOptions}
              initialAllowed={draftRules.blockingRules.organizersAllowed}
              initialExcluded={draftRules.blockingRules.organizersExcluded}
            />

            <div className="grid gap-4 md:grid-cols-2">
              <CountryDropdownField
                label="Pays autorisés"
                name="countries_allowed"
                options={allCountryOptions}
                initialValues={draftRules.blockingRules.countriesAllowed}
              />
              <CountryDropdownField
                label="Pays exclus"
                name="countries_excluded"
                options={allCountryOptions}
                initialValues={draftRules.blockingRules.countriesExcluded}
              />
            </div>
            <p className="text-xs text-slate-500">
              Liste limitée aux pays présents sur des séjours publiés actifs.
            </p>

            <div className="grid gap-3 md:grid-cols-2">
              <label className="inline-flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="transport_included_required"
                  defaultChecked={draftRules.blockingRules.transportIncludedRequired}
                />
                Transport inclus obligatoire
              </label>
            </div>
          </div>
        </details>

        <details open className="rounded-2xl border border-slate-200 bg-white p-5">
          <summary className="cursor-pointer list-none text-2xl font-semibold text-slate-900">
            Règles financières
          </summary>
          <div className="mt-4 space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <label className="text-sm font-medium text-slate-700">
                Type d’aide
                <select
                  name="aid_mode"
                  defaultValue={draftRules.financialRules.aidMode}
                  className={fieldClassName()}
                >
                  <option value="PERCENT">Pourcentage</option>
                  <option value="FIXED">Forfait</option>
                  <option value="QF_SCALE">Barème QF</option>
                </select>
              </label>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <label
                id="partner-finance-base-percent"
                className={`text-sm font-medium text-slate-700 ${
                  draftRules.financialRules.aidMode === 'PERCENT' ? '' : 'hidden'
                }`}
              >
                Taux d’aide (%)
                <input
                  name="aid_percent"
                  defaultValue={draftRules.financialRules.percentValue ?? ''}
                  className={fieldClassName()}
                />
              </label>
              <label
                id="partner-finance-base-fixed"
                className={`text-sm font-medium text-slate-700 ${
                  draftRules.financialRules.aidMode === 'FIXED' ? '' : 'hidden'
                }`}
              >
                Forfait d’aide (€)
                <input
                  name="aid_fixed_eur"
                  defaultValue={
                    draftRules.financialRules.fixedCents != null
                      ? (draftRules.financialRules.fixedCents / 100).toString()
                      : ''
                  }
                  className={fieldClassName()}
                />
              </label>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
            <label className="text-sm font-medium text-slate-700">
              Plafond / séjour (€)
              <input
                name="cap_per_stay_eur"
                defaultValue={
                  draftRules.financialRules.capPerStayCents != null
                    ? (draftRules.financialRules.capPerStayCents / 100).toString()
                    : ''
                }
                className={fieldClassName()}
              />
            </label>
            <label className="text-sm font-medium text-slate-700">
              Plafond / enfant / an (€)
              <input
                name="cap_per_child_year_eur"
                defaultValue={
                  draftRules.financialRules.capPerChildYearCents != null
                    ? (draftRules.financialRules.capPerChildYearCents / 100).toString()
                    : ''
                }
                className={fieldClassName()}
              />
            </label>
            <label className="text-sm font-medium text-slate-700">
              Plafond / famille / an (€)
              <input
                name="cap_per_family_year_eur"
                defaultValue={
                  draftRules.financialRules.capPerFamilyYearCents != null
                    ? (draftRules.financialRules.capPerFamilyYearCents / 100).toString()
                    : ''
                }
                className={fieldClassName()}
              />
            </label>
            <label className="text-sm font-medium text-slate-700">
              Plafond / jour (€)
              <input
                name="cap_per_day_eur"
                defaultValue={
                  draftRules.financialRules.capPerDayCents != null
                    ? (draftRules.financialRules.capPerDayCents / 100).toString()
                    : ''
                }
                className={fieldClassName()}
              />
            </label>
            <label className="text-sm font-medium text-slate-700">
              Nb max séjours / enfant / an
              <input
                name="max_stays_per_child_year"
                defaultValue={draftRules.financialRules.maxStaysPerChildYear ?? ''}
                className={fieldClassName()}
              />
            </label>
            <label className="text-sm font-medium text-slate-700">
              Nb max jours aidés / an
              <input
                name="max_subsidized_days_year"
                defaultValue={draftRules.financialRules.maxSubsidizedDaysYear ?? ''}
                className={fieldClassName()}
              />
            </label>
            <label className="text-sm font-medium text-slate-700">
              Reste à charge min (%)
              <input
                name="min_family_remainder_percent"
                defaultValue={draftRules.financialRules.minFamilyRemainderPercent ?? ''}
                className={fieldClassName()}
              />
            </label>
            <label className="text-sm font-medium text-slate-700">
              Reste à charge min (€)
              <input
                name="min_family_remainder_eur"
                defaultValue={
                  draftRules.financialRules.minFamilyRemainderCents != null
                    ? (draftRules.financialRules.minFamilyRemainderCents / 100).toString()
                    : ''
                }
                className={fieldClassName()}
              />
            </label>
            <label className="text-sm font-medium text-slate-700">
              QF min
              <input
                name="qf_min"
                defaultValue={draftRules.financialRules.qfMin ?? ''}
                className={fieldClassName()}
              />
            </label>
            <label className="text-sm font-medium text-slate-700">
              QF max
              <input
                name="qf_max"
                defaultValue={draftRules.financialRules.qfMax ?? ''}
                className={fieldClassName()}
              />
            </label>
            </div>
          </div>
        </details>

        <details
          id="partner-finance-qf-block"
          className={`rounded-2xl border p-5 transition ${
            draftRules.financialRules.aidMode === 'QF_SCALE'
              ? 'border-amber-300 bg-amber-50/60 ring-1 ring-amber-200 shadow-sm'
              : 'hidden border-slate-200 bg-white'
          }`}
          open={draftRules.financialRules.aidMode === 'QF_SCALE'}
        >
          <summary className="cursor-pointer list-none text-2xl font-semibold text-amber-900">
            Barème QF
          </summary>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-[860px] w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-2">QF min</th>
                  <th className="px-3 py-2">QF max</th>
                  <th className="px-3 py-2">Mode</th>
                  <th className="px-3 py-2">Taux %</th>
                  <th className="px-3 py-2">Forfait €</th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: Math.max(qfRows.length, 8) }).map((_, index) => {
                  const row = qfRows[index];
                  return (
                    <tr key={`qf-row-${index}`} className="border-t border-slate-100">
                      <td className="px-3 py-2">
                        <input
                          name={`qf_min_${index}`}
                          defaultValue={row?.minQf ?? ''}
                          className="w-full rounded border border-slate-200 px-2 py-1.5"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          name={`qf_max_${index}`}
                          defaultValue={row?.maxQf ?? ''}
                          className="w-full rounded border border-slate-200 px-2 py-1.5"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <select
                          name={`qf_mode_${index}`}
                          defaultValue={row?.aidMode ?? 'PERCENT'}
                          className="w-full rounded border border-slate-200 px-2 py-1.5"
                        >
                          <option value="PERCENT">Pourcentage</option>
                          <option value="FIXED">Forfait</option>
                        </select>
                      </td>
                      <td className="px-3 py-2">
                        <input
                          name={`qf_percent_${index}`}
                          defaultValue={row?.percentValue ?? ''}
                          className="w-full rounded border border-slate-200 px-2 py-1.5"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          name={`qf_fixed_eur_${index}`}
                          defaultValue={
                            row?.fixedCents != null ? (row.fixedCents / 100).toString() : ''
                          }
                          className="w-full rounded border border-slate-200 px-2 py-1.5"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </details>

        <details open className="rounded-2xl border border-slate-200 bg-white p-5">
          <summary className="cursor-pointer list-none text-2xl font-semibold text-slate-900">
            Aperçu impact catalogue
          </summary>
          <div className="mt-4 space-y-2 text-sm text-slate-700">
            <p>
              Aide moyenne : <span className="font-semibold">{formatCurrencyFromCents(avgAidCents)}</span>
            </p>
            <p>
              Reste famille moyen :{' '}
              <span className="font-semibold">{formatCurrencyFromCents(avgFamilyCents)}</span>
            </p>
            <p>
              Sessions avec aide à 0 : <span className="font-semibold">{zeroAidCount}</span>
            </p>
            {topExclusions.length > 0 ? (
              topExclusions.map(([reason, count]) => (
                <p key={reason}>
                  <span className="font-semibold">{count}</span> · {reason}
                </p>
              ))
            ) : (
              <p className="text-slate-500">Aucun motif d’exclusion détecté.</p>
            )}
          </div>
        </details>

      </form>

      <div className="pointer-events-none fixed bottom-4 right-4 z-40">
        <button
          type="submit"
          form="partner-catalog-form"
          className="pointer-events-auto rounded-lg bg-emerald-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-900/20 transition hover:bg-emerald-700"
        >
          Enregistrer
        </button>
      </div>

      <PartnerAppliedCatalogSection
        rows={appliedCatalogRows}
        emptyMessage="Aucun séjour à afficher selon les règles publiées."
      />
    </div>
  );
}
