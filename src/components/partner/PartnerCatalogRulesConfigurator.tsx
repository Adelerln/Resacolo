'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { PartnerFinanceModeValue } from '@/lib/partner-offers';
import { normalizePartnerFinanceMode } from '@/lib/partner-offers';
import type { PartnerCatalogRules } from '@/types/partner-catalog-rules';
import type { OrganizerRuleOption } from '@/components/partner/OrganizerRulesCards';
import type { PartnerCatalogStaySnapshot } from '@/lib/partner-catalog-rules';
import { countEligiblePartnerCatalogSessions } from '@/lib/partner-catalog-rules';
import { parsePartnerCatalogRulesFromFormData } from '@/lib/partner-catalog-form';
import PartnerCatalogCriterionCard from '@/components/partner/PartnerCatalogCriterionCard';
import RangeField from '@/components/partner/RangeField';
import StayTypeRulesCards from '@/components/partner/StayTypeRulesCards';
import OrganizerRulesCards from '@/components/partner/OrganizerRulesCards';
import CountryDropdownField from '@/components/partner/CountryDropdownField';
import PartnerCatalogQfScaleCard from '@/components/partner/PartnerCatalogQfScaleCard';

const CATALOG_FORM_ID = 'partner-catalog-form';

type QfRow = PartnerCatalogRules['qfScale'][number];

type PartnerCatalogRulesConfiguratorProps = {
  financeMode: PartnerFinanceModeValue;
  draftRules: PartnerCatalogRules;
  stayTypeOptions: string[];
  seasonOptions: string[];
  organizerOptions: OrganizerRuleOption[];
  countryOptions: string[];
  qfRows: QfRow[];
  baseStayCount: number;
  baseSessionCount: number;
  eligibleSessionCount: number;
  catalogSnapshot: PartnerCatalogStaySnapshot[];
  fieldClassName: string;
};

function hasCaps(rules: PartnerCatalogRules) {
  const financial = rules.financialRules;
  return (
    financial.capPerStayCents != null ||
    financial.capPerChildYearCents != null ||
    financial.capPerFamilyYearCents != null ||
    financial.capPerDayCents != null ||
    financial.maxStaysPerChildYear != null ||
    financial.maxSubsidizedDaysYear != null ||
    financial.minFamilyRemainderPercent != null ||
    financial.minFamilyRemainderCents != null
  );
}

function buildInitialCriteriaState(rules: PartnerCatalogRules) {
  return {
    age: rules.blockingRules.ageMin != null || rules.blockingRules.ageMax != null,
    price: rules.blockingRules.priceMinCents != null || rules.blockingRules.priceMaxCents != null,
    duration:
      rules.blockingRules.durationMinDays != null || rules.blockingRules.durationMaxDays != null,
    destination: rules.blockingRules.destinationMode !== 'ANY',
    stayTypes:
      rules.blockingRules.stayTypesAllowed.length > 0 ||
      rules.blockingRules.stayTypesExcluded.length > 0,
    seasons: rules.blockingRules.seasonsAllowed.length > 0,
    organizers:
      rules.blockingRules.organizersAllowed.length > 0 ||
      rules.blockingRules.organizersExcluded.length > 0,
    countries:
      rules.blockingRules.countriesAllowed.length > 0 ||
      rules.blockingRules.countriesExcluded.length > 0,
    caps: hasCaps(rules),
    qfRange: rules.financialRules.qfMin != null || rules.financialRules.qfMax != null,
    qfScale: rules.qfScale.length > 0
  };
}

export default function PartnerCatalogRulesConfigurator({
  financeMode,
  draftRules,
  stayTypeOptions,
  seasonOptions,
  organizerOptions,
  countryOptions,
  qfRows,
  baseStayCount,
  baseSessionCount,
  eligibleSessionCount,
  catalogSnapshot,
  fieldClassName
}: PartnerCatalogRulesConfiguratorProps) {
  const [criteria, setCriteria] = useState(() => buildInitialCriteriaState(draftRules));
  const [previewTick, setPreviewTick] = useState(0);
  const showFinancialRules = normalizePartnerFinanceMode(financeMode) === 'MANUAL';

  const bumpPreview = useCallback(() => {
    window.requestAnimationFrame(() => {
      setPreviewTick((current) => current + 1);
    });
  }, []);

  const setCriterion = (key: keyof typeof criteria, enabled: boolean) => {
    setCriteria((current) => ({ ...current, [key]: enabled }));
  };

  useEffect(() => {
    bumpPreview();
  }, [criteria, bumpPreview]);

  useEffect(() => {
    const form = document.getElementById(CATALOG_FORM_ID);
    if (!form) return;

    const handleFormChange = () => bumpPreview();
    form.addEventListener('input', handleFormChange);
    form.addEventListener('change', handleFormChange);
    return () => {
      form.removeEventListener('input', handleFormChange);
      form.removeEventListener('change', handleFormChange);
    };
  }, [bumpPreview]);

  const liveEligibleSessionCount = useMemo(() => {
    void previewTick;
    const form = document.getElementById(CATALOG_FORM_ID) as HTMLFormElement | null;
    if (!form) return eligibleSessionCount;

    const rules = parsePartnerCatalogRulesFromFormData(new FormData(form));
    return countEligiblePartnerCatalogSessions(rules, catalogSnapshot);
  }, [previewTick, catalogSnapshot, eligibleSessionCount]);

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-5 sm:p-6">
        <h2 className="text-lg font-semibold text-slate-900">Catalogue Resacolo de base</h2>
        <p className="mt-1 text-sm text-slate-600">
          Point de départ avant application de vos règles d&apos;éligibilité CSE.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <article className="rounded-xl border border-slate-200 bg-white px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Séjours</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{baseStayCount}</p>
          </article>
          <article className="rounded-xl border border-slate-200 bg-white px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Sessions</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{baseSessionCount}</p>
          </article>
          <article className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Sessions éligibles</p>
            <p className="mt-1 text-2xl font-bold text-emerald-900">{liveEligibleSessionCount}</p>
          </article>
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Critères d&apos;éligibilité</h2>
          <p className="mt-1 text-sm text-slate-600">
            Cochez un critère pour afficher et paramétrer son panneau de sélection.
          </p>
        </div>

        <div className="grid gap-3 xl:grid-cols-2">
          <PartnerCatalogCriterionCard
            title="Âge des participants"
            description="Définir une tranche d'âge autorisée."
            enabled={criteria.age}
            onEnabledChange={(enabled) => setCriterion('age', enabled)}
          >
            <RangeField
              label="Âge enfant"
              minName="age_min"
              maxName="age_max"
              minLimit={4}
              maxLimit={17}
              defaultMin={draftRules.blockingRules.ageMin}
              defaultMax={draftRules.blockingRules.ageMax}
              unit=" ans"
              onValuesChange={bumpPreview}
            />
          </PartnerCatalogCriterionCard>

          <PartnerCatalogCriterionCard
            title="Prix du séjour"
            description="Filtrer par budget minimum et maximum."
            enabled={criteria.price}
            onEnabledChange={(enabled) => setCriterion('price', enabled)}
          >
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
              onValuesChange={bumpPreview}
            />
          </PartnerCatalogCriterionCard>

          <PartnerCatalogCriterionCard
            title="Durée du séjour"
            description="Limiter la durée en jours."
            enabled={criteria.duration}
            onEnabledChange={(enabled) => setCriterion('duration', enabled)}
          >
            <RangeField
              label="Durée séjour"
              minName="duration_min_days"
              maxName="duration_max_days"
              minLimit={1}
              maxLimit={30}
              defaultMin={draftRules.blockingRules.durationMinDays}
              defaultMax={draftRules.blockingRules.durationMaxDays}
              unit=" j"
              onValuesChange={bumpPreview}
            />
          </PartnerCatalogCriterionCard>

          <PartnerCatalogCriterionCard
            title="Zone de destination"
            description="Restreindre à la France ou à l'Europe."
            enabled={criteria.destination}
            onEnabledChange={(enabled) => setCriterion('destination', enabled)}
          >
            <label className="text-sm font-medium text-slate-700">
              Mode destination
              <select
                name="destination_mode"
                defaultValue={draftRules.blockingRules.destinationMode}
                className={fieldClassName}
              >
                <option value="ANY">Tous pays</option>
                <option value="FRANCE_ONLY">France uniquement</option>
                <option value="EUROPE_ONLY">Europe uniquement</option>
              </select>
            </label>
          </PartnerCatalogCriterionCard>

          <PartnerCatalogCriterionCard
            title="Types de séjour"
            description="Autoriser ou exclure des catégories."
            enabled={criteria.stayTypes}
            onEnabledChange={(enabled) => setCriterion('stayTypes', enabled)}
          >
            <StayTypeRulesCards
              stayTypeOptions={stayTypeOptions}
              seasonOptions={seasonOptions}
              initialAllowed={draftRules.blockingRules.stayTypesAllowed}
              initialExcluded={draftRules.blockingRules.stayTypesExcluded}
              initialSeasons={[]}
              showStayTypes
              showSeasons={false}
              onValuesChange={bumpPreview}
            />
          </PartnerCatalogCriterionCard>

          <PartnerCatalogCriterionCard
            title="Saisons"
            description="Limiter aux périodes souhaitées."
            enabled={criteria.seasons}
            onEnabledChange={(enabled) => setCriterion('seasons', enabled)}
          >
            <StayTypeRulesCards
              stayTypeOptions={[]}
              seasonOptions={seasonOptions}
              initialAllowed={[]}
              initialExcluded={[]}
              initialSeasons={draftRules.blockingRules.seasonsAllowed}
              showStayTypes={false}
              showSeasons
              onValuesChange={bumpPreview}
            />
          </PartnerCatalogCriterionCard>

          <PartnerCatalogCriterionCard
            title="Organisateurs"
            description="Autoriser ou exclure des organismes."
            enabled={criteria.organizers}
            onEnabledChange={(enabled) => setCriterion('organizers', enabled)}
          >
            <OrganizerRulesCards
              organizerOptions={organizerOptions}
              initialAllowed={draftRules.blockingRules.organizersAllowed}
              initialExcluded={draftRules.blockingRules.organizersExcluded}
              onValuesChange={bumpPreview}
            />
          </PartnerCatalogCriterionCard>

          <PartnerCatalogCriterionCard
            title="Pays de destination"
            description="Listes de pays autorisés ou exclus."
            enabled={criteria.countries}
            onEnabledChange={(enabled) => setCriterion('countries', enabled)}
          >
            <div className="grid gap-4 md:grid-cols-2">
              <CountryDropdownField
                label="Pays autorisés"
                name="countries_allowed"
                options={countryOptions}
                initialValues={draftRules.blockingRules.countriesAllowed}
                onValuesChange={bumpPreview}
              />
              <CountryDropdownField
                label="Pays exclus"
                name="countries_excluded"
                options={countryOptions}
                initialValues={draftRules.blockingRules.countriesExcluded}
                onValuesChange={bumpPreview}
              />
            </div>
            <p className="mt-3 text-xs text-slate-500">
              Liste limitée aux pays présents sur des séjours publiés actifs.
            </p>
          </PartnerCatalogCriterionCard>
        </div>
      </section>

      {showFinancialRules ? (
      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Règles financières</h2>
          <p className="mt-1 text-sm text-slate-600">
            Paramétrez la prise en charge CSE appliquée aux séjours éligibles.
          </p>
        </div>

        <div className="grid gap-3 xl:grid-cols-2">
          <PartnerCatalogCriterionCard
            title="Plafonds et limites"
            description="Caps par séjour, par famille ou sur la période."
            enabled={criteria.caps}
            onEnabledChange={(enabled) => setCriterion('caps', enabled)}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-medium text-slate-700">
                Plafond / séjour (€)
                <input
                  name="cap_per_stay_eur"
                  defaultValue={
                    draftRules.financialRules.capPerStayCents != null
                      ? (draftRules.financialRules.capPerStayCents / 100).toString()
                      : ''
                  }
                  className={fieldClassName}
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
                  className={fieldClassName}
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
                  className={fieldClassName}
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
                  className={fieldClassName}
                />
              </label>
              <label className="text-sm font-medium text-slate-700">
                Nb max séjours / enfant / an
                <input
                  name="max_stays_per_child_year"
                  defaultValue={draftRules.financialRules.maxStaysPerChildYear ?? ''}
                  className={fieldClassName}
                />
              </label>
              <label className="text-sm font-medium text-slate-700">
                Nb max jours aidés / an
                <input
                  name="max_subsidized_days_year"
                  defaultValue={draftRules.financialRules.maxSubsidizedDaysYear ?? ''}
                  className={fieldClassName}
                />
              </label>
              <label className="text-sm font-medium text-slate-700">
                Reste à charge min (%)
                <input
                  name="min_family_remainder_percent"
                  defaultValue={draftRules.financialRules.minFamilyRemainderPercent ?? ''}
                  className={fieldClassName}
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
                  className={fieldClassName}
                />
              </label>
            </div>
          </PartnerCatalogCriterionCard>

          <PartnerCatalogCriterionCard
            title="Quotient familial (filtre)"
            description="Limiter l'éligibilité à une tranche de QF."
            enabled={criteria.qfRange}
            onEnabledChange={(enabled) => setCriterion('qfRange', enabled)}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-medium text-slate-700">
                QF min
                <input name="qf_min" defaultValue={draftRules.financialRules.qfMin ?? ''} className={fieldClassName} />
              </label>
              <label className="text-sm font-medium text-slate-700">
                QF max
                <input name="qf_max" defaultValue={draftRules.financialRules.qfMax ?? ''} className={fieldClassName} />
              </label>
            </div>
          </PartnerCatalogCriterionCard>

          <div className="xl:col-span-2">
            <PartnerCatalogQfScaleCard
              enabled={criteria.qfScale}
              onEnabledChange={(enabled) => setCriterion('qfScale', enabled)}
              qfRows={qfRows}
              onValuesChange={bumpPreview}
            />
          </div>
        </div>
      </section>
      ) : (
        <section className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
          <h2 className="text-lg font-semibold text-slate-900">Règles financières</h2>
          <p className="mt-2 text-sm text-slate-600">
            Cette section est disponible uniquement avec le mode de prise en charge « Calcul manuel ». Configurez-le
            dans la page{' '}
            <Link
              href="/partenaire/financement"
              className="font-semibold text-slate-900 underline decoration-slate-300 underline-offset-2 hover:decoration-slate-500"
            >
              Financement
            </Link>
            .
          </p>
        </section>
      )}
    </div>
  );
}
