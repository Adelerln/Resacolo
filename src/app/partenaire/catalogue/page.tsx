import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requirePartner } from '@/lib/auth/require';
import { canAccessPartnerSection, getPartnerAccessRoleFromSession } from '@/lib/partner-access';
import { normalizePartnerFinanceMode } from '@/lib/partner-offers';
import { getServerSupabaseClient } from '@/lib/supabase/server';
import { listPartnerCatalogStays, readPartnerCollectivity } from '@/lib/partner.server';
import PartnerCatalogRulesConfigurator from '@/components/partner/PartnerCatalogRulesConfigurator';
import PartnerAppliedCatalogSection, {
  type AppliedCatalogRow
} from '@/components/partner/PartnerAppliedCatalogSection';
import { buildCatalogCountryOptions, listSiteStayCountryLabels, syncKnownSiteCountriesWithRules } from '@/lib/partner-catalog-countries';
import {
  evaluatePartnerCatalogEligibility,
  countEligiblePartnerCatalogSessions,
  getDefaultPartnerCatalogRules,
  normalizePartnerCatalogRules,
  parseAndValidatePartnerCatalogRules,
  simulatePartnerAid,
  type PartnerCatalogStaySnapshot
} from '@/lib/partner-catalog-rules';
import { parsePartnerCatalogRulesFromFormData } from '@/lib/partner-catalog-form';
import {
  buildFeatureActivationMessage,
  isMissingAnyColumnError,
  isMissingColumnError
} from '@/lib/supabase-schema-errors';
import type { PartnerCatalogRules } from '@/types/partner-catalog-rules';

type PageProps = {
  searchParams?: Promise<{
    saved?: string;
    error?: string;
    am?: string;
    ap?: string;
  }>;
};

function fieldClassName() {
  return 'mt-1 w-full rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-sm text-slate-900 transition-colors';
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

function buildCatalogSnapshot(
  rawCatalogRows: Awaited<ReturnType<typeof listPartnerCatalogStays>>
): PartnerCatalogStaySnapshot[] {
  return rawCatalogRows.map((stay) => ({
    age_min: stay.age_min,
    age_max: stay.age_max,
    categories: stay.categories ?? [],
    destination_country: stay.destination_country,
    destination_countries: stay.destination_countries,
    transport_mode: stay.transport_mode,
    required_documents_text: stay.required_documents_text,
    education_project_path: stay.education_project_path,
    supervision_text: stay.supervision_text,
    season_name: stay.season_name,
    organizer_id: stay.organizer_id,
    organizer_is_partner: stay.organizer_is_partner,
    sessions: stay.sessions.map((session) => ({
      start_date: session.start_date,
      end_date: session.end_date,
      estimated_price_cents: session.estimated_price_cents
    }))
  }));
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

    const collectivity = await readPartnerCollectivity(nextSession.tenantId);
    const siteCountries = await listSiteStayCountryLabels();
    const parsedRules = parsePartnerCatalogRulesFromFormData(formData);
    const existingRules = normalizePartnerCatalogRules(
      collectivity.catalog_rules_draft ?? getDefaultPartnerCatalogRules()
    );
    if (normalizePartnerFinanceMode(collectivity.finance_mode) !== 'MANUAL') {
      parsedRules.financialRules = existingRules.financialRules;
      parsedRules.qfScale = existingRules.qfScale;
    } else {
      parsedRules.financialRules = {
        ...parsedRules.financialRules,
        aidMode: existingRules.financialRules.aidMode,
        percentValue: existingRules.financialRules.percentValue,
        fixedCents: existingRules.financialRules.fixedCents
      };
    }
    const rules: PartnerCatalogRules = syncKnownSiteCountriesWithRules(
      normalizePartnerCatalogRules(parsedRules),
      siteCountries
    );
    const now = new Date().toISOString();
    let validatedRules: PartnerCatalogRules | null = null;
    try {
      validatedRules = parseAndValidatePartnerCatalogRules(rules);
    } catch {
      validatedRules = null;
    }

    const supabase = getServerSupabaseClient();
    const { error } = await supabase
      .from('collectivities')
      .update({
        catalog_rules_draft: rules,
        ...(validatedRules
          ? {
              catalog_rules_published: validatedRules,
              catalog_rules_published_at: now
            }
          : {}),
        updated_at: now
      })
      .eq('id', nextSession.tenantId);

    if (error) {
      if (
        isMissingColumnError(error, 'catalog_rules_draft') ||
        isMissingAnyColumnError(error, ['catalog_rules_published', 'catalog_rules_published_at'])
      ) {
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

  const supabase = getServerSupabaseClient();
  const [collectivity, rawCatalogRows, siteCountries, seasonsResponse] = await Promise.all([
    readPartnerCollectivity(collectivityId),
    listPartnerCatalogStays(),
    listSiteStayCountryLabels(),
    supabase.from('seasons').select('name').order('start_date', { ascending: true }).order('name', { ascending: true })
  ]);

  const draftRules = syncKnownSiteCountriesWithRules(
    normalizePartnerCatalogRules(collectivity.catalog_rules_draft ?? getDefaultPartnerCatalogRules()),
    siteCountries
  );
  draftRules.blockingRules.transportIncludedRequired = false;
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
  const activeRules = draftRules;
  const qfRows =
    draftRules.qfScale.length > 0
      ? draftRules.qfScale
      : Array.from({ length: 3 }).map((_, index) => ({
          id: `default-${index}`,
          minQf: 0,
          maxQf: null,
          aidMode: 'PERCENT' as const,
          percentValue: null,
          fixedCents: null
        }));

  const seasonOptions = Array.from(
    new Set([
      ...(seasonsResponse.data ?? []).map((season) => season.name),
      ...draftRules.blockingRules.seasonsAllowed,
      ...rawCatalogRows.map((stay) => stay.season_name)
    ].filter((value): value is string => typeof value === 'string' && value.trim().length > 0))
  ).sort((a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' }));
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
  const financeMode = normalizePartnerFinanceMode(collectivity.finance_mode);
  const allCountryOptions = buildCatalogCountryOptions(siteCountries, draftRules);
  const catalogSnapshot = buildCatalogSnapshot(rawCatalogRows);

  const catalogRows = rawCatalogRows.flatMap((stay) =>
    stay.sessions.map((sessionItem) => {
      const eligibility = evaluatePartnerCatalogEligibility({
        rules: activeRules,
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

      const simulation = simulatePartnerAid({
        rules: activeRules,
        priceCents: sessionItem.estimated_price_cents,
        durationDays: durationDays(sessionItem.start_date, sessionItem.end_date),
        qfValue:
          activeRules.financialRules.qfMax != null
            ? ((activeRules.financialRules.qfMin ?? 0) + activeRules.financialRules.qfMax) / 2
            : (activeRules.financialRules.qfMin ?? 1200)
      });

      return { stay, sessionItem, eligibility, simulation };
    })
  );

  const errorMessage = sanitizeRedirectQueryValue(params?.error);
  const isSaved = params?.saved === '1';
  const displayedRows = catalogRows.filter((row) => row.eligibility.status === 'ELIGIBLE');
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
  const baseStayCount = rawCatalogRows.length;
  const baseSessionCount = rawCatalogRows.reduce((sum, stay) => sum + stay.sessions.length, 0);
  const eligibleSessionCount = countEligiblePartnerCatalogSessions(draftRules, catalogSnapshot);

  return (
    <div className="space-y-6">
      <div className="bg-slate-50 pb-3">
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm sm:px-6 lg:px-8">
          <div>
            <h1 className="admin-page-title">Catalogue</h1>
            <p className="admin-page-subtitle mt-1">
              Paramétrage des règles d’éligibilité CSE pour {collectivity.name ?? 'votre partenaire'}.
            </p>
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
      {draftValidationWarning ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          Enregistré avec avertissement: {draftValidationWarning}
        </p>
      ) : null}

      <form id="partner-catalog-form" action={saveDraft} className="space-y-4">
        <input type="hidden" name="version" value={String(draftRules.version)} />
        <PartnerCatalogRulesConfigurator
          financeMode={financeMode}
          draftRules={draftRules}
          stayTypeOptions={stayTypeOptions}
          seasonOptions={seasonOptions}
          organizerOptions={organizerOptions}
          countryOptions={allCountryOptions}
          qfRows={qfRows}
          baseStayCount={baseStayCount}
          baseSessionCount={baseSessionCount}
          eligibleSessionCount={eligibleSessionCount}
          catalogSnapshot={catalogSnapshot}
          fieldClassName={fieldClassName()}
        />
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
        emptyMessage="Aucun séjour éligible selon vos règles."
      />
    </div>
  );
}
