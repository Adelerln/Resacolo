'use client';

import Link from 'next/link';
import { useState } from 'react';
import PartnerProfileFormEnhancer from '@/components/partner/PartnerProfileFormEnhancer';
import {
  normalizePartnerFinanceMode,
  PARTNER_FINANCE_MODE_LABELS,
  PARTNER_FINANCE_MODE_VALUES,
  type PartnerFinanceModeValue
} from '@/lib/partner-offers';

function fieldClassName() {
  return 'mt-1 w-full rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-sm text-slate-900 transition-colors';
}

export function PartnerFinancementForm({
  initialMode,
  initialPercentValue,
  initialFixedEuros,
  initialRulesText,
  saveAction,
  resetToken
}: {
  initialMode: string | null | undefined;
  initialPercentValue: number | null | undefined;
  initialFixedEuros: number | null | undefined;
  initialRulesText: string | null | undefined;
  saveAction: (formData: FormData) => void;
  resetToken: string;
}) {
  const [mode, setMode] = useState<PartnerFinanceModeValue>(normalizePartnerFinanceMode(initialMode));

  return (
    <>
      <form id="partner-financing-form" action={saveAction} className="space-y-4">
        <label className="block text-sm font-medium text-slate-700">
          Mode de financement
          <select
            name="finance_mode"
            className={fieldClassName()}
            value={mode}
            onChange={(event) => setMode(normalizePartnerFinanceMode(event.target.value))}
          >
            {PARTNER_FINANCE_MODE_VALUES.map((value) => (
              <option key={value} value={value}>
                {PARTNER_FINANCE_MODE_LABELS[value]}
              </option>
            ))}
          </select>
        </label>

        <p
          className="rounded-lg border border-slate-100 bg-slate-50 px-4 py-3 text-sm leading-relaxed text-slate-700"
          role="status"
          aria-live="polite"
        >
          {mode === 'TOTAL' && (
            <>Si la prise en charge est totale, le partenaire s&apos;engage à régler la totalité de l&apos;inscription auprès de ResaColo.</>
          )}
          {mode === 'NONE' && <>Si pas de financement, le client règle la totalité auprès de ResaColo.</>}
          {mode === 'PERCENT' && (
            <>Si la quote-part de prise en charge se fait en %, alors la case « Pourcentage pris en charge » s&apos;affiche — et doit être renseignée par le partenaire.</>
          )}
          {mode === 'FIXED' && (
            <>Si la quote-part de prise en charge est fixe, alors la case « Montant fixe (EUR) » s&apos;affiche — et doit être renseignée par le partenaire.</>
          )}
          {mode === 'MANUAL' && (
            <>
              En calcul manuel, la prise en charge est déterminée par le barème QF et le quotient familial de
              chaque ayant-droit. Configurez d&apos;abord les règles dans{' '}
              <Link
                href="/partenaire/catalogue"
                className="font-semibold text-emerald-800 underline-offset-2 hover:underline"
              >
                Catalogue
              </Link>
              , puis saisissez les QF dans{' '}
              <Link
                href="/partenaire/beneficiaires"
                className="font-semibold text-emerald-800 underline-offset-2 hover:underline"
              >
                Bénéficiaires
              </Link>
              . Vous pouvez aussi ajuster une prise en charge ponctuelle depuis{' '}
              <Link
                href="/partenaire/reservations"
                className="font-semibold text-emerald-800 underline-offset-2 hover:underline"
              >
                Réservations
              </Link>
              .
            </>
          )}
        </p>

        {(mode === 'PERCENT' || mode === 'FIXED') && (
          <div className="grid gap-4">
            {mode === 'PERCENT' ? (
              <label className="block text-sm font-medium text-slate-700">
                Pourcentage pris en charge
                <input
                  type="number"
                  name="finance_percent_value"
                  min="0"
                  max="100"
                  step="0.01"
                  defaultValue={typeof initialPercentValue === 'number' ? String(initialPercentValue) : ''}
                  className={fieldClassName()}
                  placeholder="Ex. : 40"
                />
              </label>
            ) : null}
            {mode === 'FIXED' ? (
              <label className="block text-sm font-medium text-slate-700">
                Montant fixe (EUR)
                <input
                  type="number"
                  name="finance_fixed_euros"
                  min="0"
                  step="0.01"
                  defaultValue={typeof initialFixedEuros === 'number' ? String(initialFixedEuros) : ''}
                  className={fieldClassName()}
                  placeholder="Ex. : 150"
                />
              </label>
            ) : null}
          </div>
        )}

        <label className="block text-sm font-medium text-slate-700">
          Mémo Règles personnalisées
          <textarea
            name="finance_rules_text"
            rows={4}
            defaultValue={initialRulesText ?? ''}
            className={fieldClassName()}
          />
        </label>
      </form>
      <PartnerProfileFormEnhancer formId="partner-financing-form" resetToken={resetToken} />
    </>
  );
}
