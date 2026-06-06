'use client';

import { useCallback, useEffect, useState } from 'react';
import type { PartnerCatalogRules } from '@/types/partner-catalog-rules';
import { getPartnerCatalogQfScaleBoundsValidationError } from '@/lib/partner-catalog-rules';
import { parseQfScaleFromFormData } from '@/lib/partner-catalog-form';
import PartnerCatalogCriterionCard from '@/components/partner/PartnerCatalogCriterionCard';

const CATALOG_FORM_ID = 'partner-catalog-form';

type QfRow = PartnerCatalogRules['qfScale'][number];
type QfAidMode = QfRow['aidMode'];

const DEFAULT_ROW_COUNT = 3;
const MAX_ROW_COUNT = 20;

type PartnerCatalogQfScaleCardProps = {
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  qfRows: QfRow[];
  onValuesChange?: () => void;
};

function initialRowCount(qfRows: QfRow[]) {
  return qfRows.length > 0 ? qfRows.length : DEFAULT_ROW_COUNT;
}

function initialScaleMode(qfRows: QfRow[]): QfAidMode {
  if (qfRows.length === 0) return 'PERCENT';
  return qfRows[0]?.aidMode ?? 'PERCENT';
}

export default function PartnerCatalogQfScaleCard({
  enabled,
  onEnabledChange,
  qfRows,
  onValuesChange
}: PartnerCatalogQfScaleCardProps) {
  const [rowCount, setRowCount] = useState(() => initialRowCount(qfRows));
  const [scaleMode, setScaleMode] = useState<QfAidMode>(() => initialScaleMode(qfRows));
  const [boundsValidationError, setBoundsValidationError] = useState<string | null>(null);

  const refreshBoundsValidation = useCallback(() => {
    const form = document.getElementById(CATALOG_FORM_ID) as HTMLFormElement | null;
    if (!form) {
      setBoundsValidationError(null);
      return;
    }
    const rows = parseQfScaleFromFormData(new FormData(form));
    setBoundsValidationError(getPartnerCatalogQfScaleBoundsValidationError(rows));
  }, []);

  const notifyChange = useCallback(() => {
    refreshBoundsValidation();
    onValuesChange?.();
  }, [onValuesChange, refreshBoundsValidation]);

  const handleModeChange = (mode: QfAidMode) => {
    setScaleMode(mode);
    notifyChange();
  };

  const handleAddRow = () => {
    if (rowCount >= MAX_ROW_COUNT) return;
    setRowCount((current) => current + 1);
    notifyChange();
  };

  useEffect(() => {
    if (!enabled) return;
    refreshBoundsValidation();
  }, [enabled, rowCount, scaleMode, refreshBoundsValidation]);

  useEffect(() => {
    if (!enabled) return;
    const form = document.getElementById(CATALOG_FORM_ID);
    if (!form) return;

    const handleFormChange = (event: Event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const fieldName = target.getAttribute('name') ?? '';
      if (
        fieldName.startsWith('qf_min_') ||
        fieldName.startsWith('qf_max_') ||
        fieldName === 'qf_scale_mode'
      ) {
        refreshBoundsValidation();
      }
    };

    form.addEventListener('input', handleFormChange);
    form.addEventListener('change', handleFormChange);
    return () => {
      form.removeEventListener('input', handleFormChange);
      form.removeEventListener('change', handleFormChange);
    };
  }, [enabled, refreshBoundsValidation]);

  return (
    <PartnerCatalogCriterionCard
      title="Barème QF"
      description="Grille de prise en charge par tranche de QF."
      enabled={enabled}
      onEnabledChange={onEnabledChange}
      headerAction={
        enabled ? (
          <button
            type="button"
            onClick={handleAddRow}
            disabled={rowCount >= MAX_ROW_COUNT}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Ajouter une ligne
          </button>
        ) : null
      }
    >
      <>
        <input type="hidden" name="qf_row_count" value={String(rowCount)} />
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-6">
          <label htmlFor="qf-scale-mode" className="shrink-0 text-sm font-medium text-slate-700">
            Mode de calcul
          </label>
          <select
            id="qf-scale-mode"
            name="qf_scale_mode"
            value={scaleMode}
            onChange={(event) =>
              handleModeChange(event.target.value === 'FIXED' ? 'FIXED' : 'PERCENT')
            }
            className="w-full max-w-xs rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
          >
            <option value="PERCENT">Taux (%)</option>
            <option value="FIXED">Forfait (€)</option>
          </select>
        </div>
        <div className="overflow-x-auto rounded-xl border border-amber-200 bg-amber-50/60">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2">QF min</th>
                <th className="px-3 py-2">QF max</th>
                {scaleMode === 'PERCENT' ? (
                  <th className="px-3 py-2">Taux %</th>
                ) : (
                  <th className="px-3 py-2">Forfait €</th>
                )}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: rowCount }).map((_, index) => {
                const row = qfRows[index];
                return (
                  <tr key={`qf-row-${index}`} className="border-t border-slate-100">
                    <td className="px-3 py-2">
                      <input
                        name={`qf_min_${index}`}
                        defaultValue={row?.minQf ?? ''}
                        onInput={notifyChange}
                        className="w-full rounded border border-slate-200 px-2 py-1.5"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        name={`qf_max_${index}`}
                        defaultValue={row?.maxQf ?? ''}
                        onInput={notifyChange}
                        className="w-full rounded border border-slate-200 px-2 py-1.5"
                      />
                    </td>
                    <td className="px-3 py-2">
                      {scaleMode === 'PERCENT' ? (
                        <input
                          name={`qf_percent_${index}`}
                          defaultValue={row?.percentValue ?? ''}
                          onInput={notifyChange}
                          className="w-full rounded border border-slate-200 px-2 py-1.5"
                        />
                      ) : (
                        <input
                          name={`qf_fixed_eur_${index}`}
                          defaultValue={
                            row?.fixedCents != null ? (row.fixedCents / 100).toString() : ''
                          }
                          onInput={notifyChange}
                          className="w-full rounded border border-slate-200 px-2 py-1.5"
                        />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {boundsValidationError ? (
          <p className="mt-3 text-sm text-amber-800">{boundsValidationError}</p>
        ) : (
          <p className="mt-3 text-xs text-slate-500">
            Les tranches QF min et max ne doivent pas se chevaucher. Sur la dernière ligne, un QF
            max vide signifie tous les QF à partir du minimum saisi.
          </p>
        )}
      </>
    </PartnerCatalogCriterionCard>
  );
}
