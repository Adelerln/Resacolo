'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Pencil } from 'lucide-react';

type OrganizerOverviewRow = {
  id: string;
  slug: string | null;
  name: string;
  contact_email: string | null;
  is_founding_member: boolean | null;
  is_resacolo_member: boolean | null;
  profile_completeness_percent: number | null;
  stays_count: number | null;
  published_stays_count: number | null;
  sales_count: number | null;
  commission_percent: number | null;
  publication_fee_cents: number | null;
};

type SortKey =
  | 'name'
  | 'contact_email'
  | 'is_founding_member'
  | 'is_resacolo_member'
  | 'profile_completeness_percent'
  | 'stays_count'
  | 'published_stays_count'
  | 'sales_count'
  | 'commission_percent'
  | 'publication_fee_cents';

function num(value: unknown): number {
  if (value == null) return 0;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function boolOuiNon(value: boolean | null | undefined) {
  return value ? 'Oui' : 'Non';
}

function getSortValue(row: OrganizerOverviewRow, key: SortKey): string {
  switch (key) {
    case 'name':
      return row.name ?? '';
    case 'contact_email':
      return row.contact_email ?? '';
    case 'is_founding_member':
      return boolOuiNon(row.is_founding_member);
    case 'is_resacolo_member':
      return boolOuiNon(row.is_resacolo_member);
    case 'profile_completeness_percent':
      return String(num(row.profile_completeness_percent));
    case 'stays_count':
      return String(num(row.stays_count));
    case 'published_stays_count':
      return String(num(row.published_stays_count));
    case 'sales_count':
      return String(num(row.sales_count));
    case 'commission_percent':
      return String(num(row.commission_percent));
    case 'publication_fee_cents':
      return String(num(row.publication_fee_cents));
    default:
      return '';
  }
}

export function AdminOrganizersTable({ rows }: { rows: OrganizerOverviewRow[] }) {
  const [sortConfig, setSortConfig] = useState<{
    key: SortKey;
    direction: 'asc' | 'desc';
  } | null>(null);

  const sortedRows = useMemo(() => {
    if (!sortConfig) return rows;
    const { key, direction } = sortConfig;
    const sorted = [...rows].sort((a, b) => {
      const left = getSortValue(a, key);
      const right = getSortValue(b, key);
      if (
        key === 'profile_completeness_percent' ||
        key === 'stays_count' ||
        key === 'published_stays_count' ||
        key === 'sales_count' ||
        key === 'commission_percent' ||
        key === 'publication_fee_cents'
      ) {
        return Number(left) - Number(right);
      }
      return left.localeCompare(right, 'fr', { sensitivity: 'base' });
    });
    return direction === 'asc' ? sorted : sorted.reverse();
  }, [rows, sortConfig]);

  const toggleSort = (key: SortKey) => {
    setSortConfig((current) => {
      if (!current || current.key !== key) return { key, direction: 'asc' };
      if (current.direction === 'asc') return { key, direction: 'desc' };
      return null;
    });
  };

  const renderSortIcon = (key: SortKey) => {
    if (!sortConfig || sortConfig.key !== key) return null;
    return sortConfig.direction === 'asc' ? (
      <ChevronUp className="h-3.5 w-3.5" />
    ) : (
      <ChevronDown className="h-3.5 w-3.5" />
    );
  };

  const renderHeader = (label: string, key: SortKey) => (
    <button
      type="button"
      onClick={() => toggleSort(key)}
      className="inline-flex items-center gap-1 text-left uppercase tracking-wide text-slate-500"
    >
      <span>{label}</span>
      {renderSortIcon(key)}
    </button>
  );

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="overflow-x-auto">
        <table className="min-w-[1100px] w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-3">{renderHeader('Organisme', 'name')}</th>
              <th className="px-3 py-3">{renderHeader('Email', 'contact_email')}</th>
              <th className="px-3 py-3">{renderHeader('Fondateur', 'is_founding_member')}</th>
              <th className="px-3 py-3">{renderHeader('Membre', 'is_resacolo_member')}</th>
              <th className="px-3 py-3">{renderHeader('Complétude', 'profile_completeness_percent')}</th>
              <th className="px-3 py-3">{renderHeader('Séjours', 'stays_count')}</th>
              <th className="px-3 py-3">{renderHeader('Publiés', 'published_stays_count')}</th>
              <th className="px-3 py-3">{renderHeader('Ventes', 'sales_count')}</th>
              <th className="px-3 py-3">{renderHeader('Commission', 'commission_percent')}</th>
              <th className="px-3 py-3">{renderHeader('Forfait pub.', 'publication_fee_cents')}</th>
              <th className="px-3 py-3" />
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((row) => {
              const hrefId = row.slug ?? row.id;
              const feeEuros = (num(row.publication_fee_cents) / 100).toLocaleString('fr-FR', {
                style: 'currency',
                currency: 'EUR'
              });
              const commission = num(row.commission_percent);

              return (
                <tr key={row.id} className="border-t border-slate-100">
                  <td className="px-3 py-3 font-medium text-slate-900">{row.name}</td>
                  <td className="max-w-[10rem] truncate px-3 py-3 text-slate-600">{row.contact_email ?? '—'}</td>
                  <td className="px-3 py-3 text-slate-600">{boolOuiNon(row.is_founding_member)}</td>
                  <td className="px-3 py-3 text-slate-600">{boolOuiNon(row.is_resacolo_member)}</td>
                  <td className="px-3 py-3 text-slate-600 tabular-nums">
                    {num(row.profile_completeness_percent).toFixed(0)} %
                  </td>
                  <td className="px-3 py-3 text-slate-600 tabular-nums">{num(row.stays_count)}</td>
                  <td className="px-3 py-3 text-slate-600 tabular-nums">{num(row.published_stays_count)}</td>
                  <td className="px-3 py-3 text-slate-600 tabular-nums">{num(row.sales_count)}</td>
                  <td className="px-3 py-3 text-slate-600 tabular-nums">
                    {commission.toLocaleString('fr-FR', {
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 2
                    })}
                    %
                  </td>
                  <td className="px-3 py-3 text-slate-600 tabular-nums">{feeEuros}</td>
                  <td className="px-3 py-3 text-right">
                    <Link
                      href={`/admin/organizers/${hrefId}`}
                      className="inline-flex items-center gap-2 font-semibold text-emerald-600 hover:text-emerald-700"
                    >
                      <Pencil className="h-4 w-4" />
                      Modifier
                    </Link>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td className="px-4 py-6 text-slate-500" colSpan={11}>
                  Aucun organisme.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
