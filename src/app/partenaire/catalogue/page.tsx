import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requirePartner } from '@/lib/auth/require';
import { canAccessPartnerSection, getPartnerAccessRoleFromSession } from '@/lib/partner-access';
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
      normalizePartnerCatalogRules(parsePartnerCatalogRulesFromFormData(formData)),
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
  const catalogSnapshot = buildCatalogSnapshot(rawCatalogRows);

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
  const baseStayCount = rawCatalogRows.length;
  const baseSessionCount = rawCatalogRows.reduce((sum, stay) => sum + stay.sessions.length, 0);
  const eligibleSessionCount = countEligiblePartnerCatalogSessions(draftRules, catalogSnapshot);

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
        <input type="hidden" name="version" value={String(draftRules.version)} />
        <input type="hidden" name="qf_row_count" value={String(Math.max(qfRows.length, 8))} />

        <PartnerCatalogRulesConfigurator
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
          impactSummary={{
            avgAidLabel: formatCurrencyFromCents(avgAidCents),
            avgFamilyLabel: formatCurrencyFromCents(avgFamilyCents),
            zeroAidCount,
            topExclusions: topExclusions.map(([reason, count]) => ({ reason, count }))
          }}
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
        emptyMessage="Aucun séjour à afficher selon les règles publiées."
      />
    </div>
  );
}
