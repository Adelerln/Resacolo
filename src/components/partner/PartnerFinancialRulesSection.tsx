'use client';

import { useState } from 'react';
import type { PartnerCatalogRules } from '@/types/partner-catalog-rules';
import PartnerCatalogCriterionCard from '@/components/partner/PartnerCatalogCriterionCard';
import PartnerCatalogQfScaleCard from '@/components/partner/PartnerCatalogQfScaleCard';

type QfRow = PartnerCatalogRules['qfScale'][number];

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

export function PartnerFinancialRulesSection({
  draftRules,
  qfRows,
  fieldClassName,
  formId
}: {
  draftRules: PartnerCatalogRules;
  qfRows: QfRow[];
  fieldClassName: string;
  formId: string;
}) {
  const [capsEnabled, setCapsEnabled] = useState(() => hasCaps(draftRules));
  const [qfRangeEnabled, setQfRangeEnabled] = useState(
    () => draftRules.financialRules.qfMin != null || draftRules.financialRules.qfMax != null
  );
  const [qfScaleEnabled, setQfScaleEnabled] = useState(() => draftRules.qfScale.length > 0);

  return (
    <section className="space-y-3 border-t border-slate-100 pt-5">
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
          enabled={capsEnabled}
          onEnabledChange={setCapsEnabled}
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
          enabled={qfRangeEnabled}
          onEnabledChange={setQfRangeEnabled}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-medium text-slate-700">
              QF min
              <input
                name="qf_min"
                defaultValue={draftRules.financialRules.qfMin ?? ''}
                className={fieldClassName}
              />
            </label>
            <label className="text-sm font-medium text-slate-700">
              QF max
              <input
                name="qf_max"
                defaultValue={draftRules.financialRules.qfMax ?? ''}
                className={fieldClassName}
              />
            </label>
          </div>
        </PartnerCatalogCriterionCard>

        <div className="xl:col-span-2">
          <PartnerCatalogQfScaleCard
            enabled={qfScaleEnabled}
            onEnabledChange={setQfScaleEnabled}
            qfRows={qfRows}
            formId={formId}
          />
        </div>
      </div>
    </section>
  );
}
