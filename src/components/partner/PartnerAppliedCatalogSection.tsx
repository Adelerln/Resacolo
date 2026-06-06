'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useMemo, useState } from 'react';

const STAYS_PER_PAGE = 7;

export type AppliedCatalogRow = {
  rowKey: string;
  title: string;
  organizerName: string;
  seasonName: string;
  eligibilityStatus: 'ELIGIBLE' | 'INELIGIBLE';
  eligibilityLabel: string;
  aidLabel: string;
  appliedSummary: string;
  sessionRangeLabel: string;
  priceLabel: string;
  familyLabel: string;
  ineligibleReason: string | null;
  capLabels: string | null;
  warning: string | null;
};

type StayGroup = {
  stayKey: string;
  rows: AppliedCatalogRow[];
};

function groupRowsByStay(rows: AppliedCatalogRow[]): StayGroup[] {
  const groups: StayGroup[] = [];
  const indexByStay = new Map<string, number>();

  for (const row of rows) {
    const stayKey = row.rowKey.split(':')[0] ?? row.rowKey;
    const existingIndex = indexByStay.get(stayKey);
    if (existingIndex == null) {
      indexByStay.set(stayKey, groups.length);
      groups.push({ stayKey, rows: [row] });
      continue;
    }
    groups[existingIndex]?.rows.push(row);
  }

  return groups;
}

export default function PartnerAppliedCatalogSection({
  rows,
  emptyMessage
}: {
  rows: AppliedCatalogRow[];
  emptyMessage: string;
}) {
  const stayGroups = useMemo(() => groupRowsByStay(rows), [rows]);
  const totalStays = stayGroups.length;
  const pageCount = Math.max(1, Math.ceil(totalStays / STAYS_PER_PAGE));
  const [pageIndex, setPageIndex] = useState(0);
  const safePageIndex = Math.min(pageIndex, pageCount - 1);

  const pageGroups = stayGroups.slice(
    safePageIndex * STAYS_PER_PAGE,
    safePageIndex * STAYS_PER_PAGE + STAYS_PER_PAGE
  );
  const rangeStart = totalStays === 0 ? 0 : safePageIndex * STAYS_PER_PAGE + 1;
  const rangeEnd = Math.min((safePageIndex + 1) * STAYS_PER_PAGE, totalStays);

  if (totalStays === 0) {
    return (
      <section className="space-y-3">
        <h2 className="admin-section-title">Catalogue appliqué</h2>
        <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-sm text-slate-500">
          {emptyMessage}
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="admin-section-title">Catalogue appliqué</h2>
          <p className="text-sm text-slate-600">
            <span className="font-semibold text-slate-900">{totalStays}</span> séjour
            {totalStays > 1 ? 's' : ''} éligible{totalStays > 1 ? 's' : ''}
            {rows.length !== totalStays ? (
              <>
                {' '}
                · <span className="font-semibold text-slate-900">{rows.length}</span> session
                {rows.length > 1 ? 's' : ''}
              </>
            ) : null}
          </p>
        </div>
        {pageCount > 1 ? (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={safePageIndex <= 0}
              onClick={() => setPageIndex((current) => Math.max(0, current - 1))}
              aria-label="Page précédente"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden />
            </button>
            <span className="text-sm text-slate-600">
              Page {safePageIndex + 1} / {pageCount}
              <span className="text-slate-400">
                {' '}
                · séjours {rangeStart}–{rangeEnd}
              </span>
            </span>
            <button
              type="button"
              disabled={safePageIndex >= pageCount - 1}
              onClick={() => setPageIndex((current) => Math.min(pageCount - 1, current + 1))}
              aria-label="Page suivante"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronRight className="h-4 w-4" aria-hidden />
            </button>
          </div>
        ) : null}
      </div>

      {pageGroups.map((group) => {
        const firstRow = group.rows[0];
        if (!firstRow) return null;

        const sessionCount = group.rows.length;
        const uniqueAidLabels = new Set(group.rows.map((row) => row.aidLabel));
        const uniqueAppliedSummaries = new Set(group.rows.map((row) => row.appliedSummary));
        const aidSummaryLabel =
          uniqueAidLabels.size === 1 ? firstRow.aidLabel : `${uniqueAidLabels.size} montants`;
        const appliedSummaryLabel =
          uniqueAppliedSummaries.size === 1
            ? firstRow.appliedSummary
            : `${uniqueAppliedSummaries.size} barèmes`;

        return (
          <details
            key={group.stayKey}
            className="rounded-2xl border border-slate-200 bg-white p-4"
          >
            <summary className="flex cursor-pointer list-none flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-base font-semibold text-slate-900">{firstRow.title}</h3>
                <p className="text-sm text-slate-600">
                  {firstRow.organizerName} · {firstRow.seasonName}
                </p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {sessionCount} session{sessionCount > 1 ? 's' : ''} éligible
                  {sessionCount > 1 ? 's' : ''}
                </p>
              </div>
              <div className="flex flex-wrap gap-2 text-xs font-semibold">
                <span
                  className={`inline-flex rounded-full px-2.5 py-1 ${
                    firstRow.eligibilityStatus === 'ELIGIBLE'
                      ? 'bg-emerald-100 text-emerald-900'
                      : 'bg-rose-100 text-rose-900'
                  }`}
                >
                  {firstRow.eligibilityLabel}
                </span>
                <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-slate-700">
                  Aide {aidSummaryLabel}
                </span>
                <span className="inline-flex rounded-full bg-amber-100 px-2.5 py-1 text-amber-900">
                  {appliedSummaryLabel}
                </span>
              </div>
            </summary>
            <ul className="mt-3 space-y-3 border-t border-slate-100 pt-3 text-sm text-slate-700">
              {group.rows.map((row) => (
                <li
                  key={row.rowKey}
                  className="rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2.5"
                >
                  <p className="font-medium text-slate-900">Session : {row.sessionRangeLabel}</p>
                  <p>Prix estimé : {row.priceLabel}</p>
                  <p>Aide : {row.aidLabel}</p>
                  <p>Reste famille : {row.familyLabel}</p>
                  <p className="text-xs text-amber-800">{row.appliedSummary}</p>
                  {row.ineligibleReason ? (
                    <p className="mt-1 text-rose-700">Motif principal : {row.ineligibleReason}</p>
                  ) : null}
                  {row.capLabels ? (
                    <p className="mt-1 text-amber-700">Contraintes appliquées : {row.capLabels}</p>
                  ) : null}
                  {row.warning ? (
                    <p className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-amber-700">
                      {row.warning}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          </details>
        );
      })}
    </section>
  );
}
