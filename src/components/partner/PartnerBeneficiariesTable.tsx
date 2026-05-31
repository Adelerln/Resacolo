'use client';

import { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

export type PartnerBeneficiaryRow = {
  id: string;
  name: string;
  familyName: string;
  email: string;
  phone: string;
  city: string;
  attachedAt: string;
};

type SortKey = 'name' | 'email' | 'phone' | 'city' | 'attachedAt';

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('fr-FR');
}

function compareBeneficiaries(a: PartnerBeneficiaryRow, b: PartnerBeneficiaryRow, key: SortKey) {
  if (key === 'attachedAt') {
    const timeA = new Date(a.attachedAt).getTime();
    const timeB = new Date(b.attachedAt).getTime();
    return (Number.isFinite(timeA) ? timeA : 0) - (Number.isFinite(timeB) ? timeB : 0);
  }
  if (key === 'name') {
    const familyA = a.familyName || a.name;
    const familyB = b.familyName || b.name;
    const familyCompare = familyA.localeCompare(familyB, 'fr', { sensitivity: 'base' });
    if (familyCompare !== 0) return familyCompare;
    return a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' });
  }
  return (a[key] ?? '').localeCompare(b[key] ?? '', 'fr', { sensitivity: 'base' });
}

export function PartnerBeneficiariesTable({ beneficiaries }: { beneficiaries: PartnerBeneficiaryRow[] }) {
  const [sortConfig, setSortConfig] = useState<{
    key: SortKey;
    direction: 'asc' | 'desc';
  } | null>(null);

  const sortedBeneficiaries = useMemo(() => {
    if (!sortConfig) return beneficiaries;
    const sorted = [...beneficiaries].sort((left, right) =>
      compareBeneficiaries(left, right, sortConfig.key)
    );
    return sortConfig.direction === 'asc' ? sorted : sorted.reverse();
  }, [beneficiaries, sortConfig]);

  const toggleSort = (key: SortKey) => {
    setSortConfig((current) => {
      if (!current || current.key !== key) {
        return { key, direction: 'asc' };
      }
      if (current.direction === 'asc') {
        return { key, direction: 'desc' };
      }
      return null;
    });
  };

  const renderSortIcon = (key: SortKey) => {
    if (!sortConfig || sortConfig.key !== key) return null;
    return sortConfig.direction === 'asc' ? (
      <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
    ) : (
      <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
    );
  };

  const renderSortableHeader = (label: string, key: SortKey) => (
    <button
      type="button"
      onClick={() => toggleSort(key)}
      className="inline-flex items-center gap-1 font-semibold uppercase tracking-wide text-slate-600 transition hover:text-slate-900"
    >
      <span>{label}</span>
      {renderSortIcon(key)}
    </button>
  );

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="overflow-x-auto">
        <table className="min-w-[760px] w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">{renderSortableHeader('Bénéficiaire', 'name')}</th>
              <th className="px-4 py-3">{renderSortableHeader('Email', 'email')}</th>
              <th className="px-4 py-3">{renderSortableHeader('Téléphone', 'phone')}</th>
              <th className="px-4 py-3">{renderSortableHeader('Ville', 'city')}</th>
              <th className="px-4 py-3">{renderSortableHeader('Rattaché le', 'attachedAt')}</th>
            </tr>
          </thead>
          <tbody>
            {sortedBeneficiaries.map((beneficiary) => (
              <tr key={beneficiary.id} className="border-t border-slate-100">
                <td className="px-4 py-3 font-medium text-slate-900">{beneficiary.name}</td>
                <td className="px-4 py-3 text-slate-600">{beneficiary.email}</td>
                <td className="px-4 py-3 text-slate-600">{beneficiary.phone}</td>
                <td className="px-4 py-3 text-slate-600">{beneficiary.city}</td>
                <td className="px-4 py-3 text-slate-600">{formatDate(beneficiary.attachedAt)}</td>
              </tr>
            ))}
            {beneficiaries.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-slate-500" colSpan={5}>
                  Aucun ayant-droit n&apos;est encore rattaché à votre collectivité.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
