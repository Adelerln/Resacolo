'use client';

import type { ReactNode } from 'react';

type PartnerCatalogCriterionCardProps = {
  title: string;
  description?: string;
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  children: ReactNode;
};

export default function PartnerCatalogCriterionCard({
  title,
  description,
  enabled,
  onEnabledChange,
  children
}: PartnerCatalogCriterionCardProps) {
  return (
    <div
      className={`rounded-2xl border transition ${
        enabled ? 'border-orange-200 bg-white shadow-sm' : 'border-slate-200 bg-slate-50/80'
      }`}
    >
      <label className="flex cursor-pointer items-start gap-3 px-4 py-4 sm:px-5">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(event) => onEnabledChange(event.target.checked)}
          className="mt-1 h-4 w-4 rounded border-slate-300 text-orange-500 focus:ring-orange-400"
        />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-slate-900">{title}</span>
          {description ? <span className="mt-0.5 block text-sm text-slate-500">{description}</span> : null}
        </span>
      </label>
      {enabled ? (
        <div className="border-t border-slate-100 px-4 pb-4 pt-3 sm:px-5 sm:pb-5">{children}</div>
      ) : null}
    </div>
  );
}
