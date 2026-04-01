'use client';

import { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Pencil } from 'lucide-react';

type MemberRow = {
  id: string;
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  organizerName: string | null;
  role: 'OWNER' | 'EDITOR' | 'RESERVATION_MANAGER';
};

type SortKey = 'first_name' | 'last_name' | 'email' | 'organizerName' | 'role';

const ROLE_LABELS: Record<MemberRow['role'], string> = {
  OWNER: 'Propriétaire',
  EDITOR: 'Éditeur',
  RESERVATION_MANAGER: 'Gestionnaire réservations'
};

export function AdminUsersTable({ members }: { members: MemberRow[] }) {
  const [editing, setEditing] = useState<MemberRow | null>(null);
  const [sortConfig, setSortConfig] = useState<{
    key: SortKey;
    direction: 'asc' | 'desc';
  } | null>(null);

  const roleOptions = useMemo(
    () => [
      { value: 'OWNER', label: ROLE_LABELS.OWNER },
      { value: 'EDITOR', label: ROLE_LABELS.EDITOR },
      { value: 'RESERVATION_MANAGER', label: ROLE_LABELS.RESERVATION_MANAGER }
    ],
    []
  );

  const sortedMembers = useMemo(() => {
    if (!sortConfig) return members;
    const { key, direction } = sortConfig;
    const sorted = [...members].sort((a, b) => {
      const valueA = getSortValue(a, key);
      const valueB = getSortValue(b, key);
      return valueA.localeCompare(valueB, 'fr', { sensitivity: 'base' });
    });
    return direction === 'asc' ? sorted : sorted.reverse();
  }, [members, sortConfig]);

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
      <ChevronUp className="h-3.5 w-3.5" />
    ) : (
      <ChevronDown className="h-3.5 w-3.5" />
    );
  };

  const renderSortableHeader = (label: string, key: SortKey) => (
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
    <>
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="min-w-[760px] w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">{renderSortableHeader('Prénom', 'first_name')}</th>
                <th className="px-4 py-3">{renderSortableHeader('Nom', 'last_name')}</th>
                <th className="px-4 py-3">{renderSortableHeader('Email', 'email')}</th>
                <th className="px-4 py-3">
                  {renderSortableHeader('Organisme', 'organizerName')}
                </th>
                <th className="px-4 py-3">{renderSortableHeader('Rôle', 'role')}</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedMembers.map((member) => (
                <tr key={member.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 text-slate-600">{member.first_name ?? '-'}</td>
                  <td className="px-4 py-3 text-slate-600">{member.last_name ?? '-'}</td>
                  <td className="px-4 py-3 text-slate-600">{member.email ?? '-'}</td>
                  <td className="px-4 py-3 text-slate-600">{member.organizerName ?? '-'}</td>
                  <td className="px-4 py-3 text-slate-600">{ROLE_LABELS[member.role]}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => setEditing(member)}
                      className="inline-flex items-center justify-center rounded-md border border-slate-200 p-2 text-slate-600 hover:text-slate-900"
                      aria-label="Modifier l'utilisateur"
                    >
                      <Pencil size={16} />
                    </button>
                  </td>
                </tr>
              ))}
              {members.length === 0 && (
                <tr>
                  <td className="px-4 py-6 text-slate-500" colSpan={6}>
                    Aucun utilisateur.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4 py-6">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Modifier l&apos;utilisateur</h2>
                <p className="text-sm text-slate-600">
                  {editing.first_name ?? '-'} {editing.last_name ?? ''}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="rounded-md border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600"
              >
                Fermer
              </button>
            </div>

            <form
              className="mt-6 space-y-4"
              action={`/api/admin/organizer-members/${editing.id}`}
              method="post"
            >
              <input type="hidden" name="user_id" value={editing.user_id} />
              <label className="block text-sm font-medium text-slate-700">
                Prénom
                <input
                  name="first_name"
                  defaultValue={editing.first_name ?? ''}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Nom
                <input
                  name="last_name"
                  defaultValue={editing.last_name ?? ''}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Email
                <input
                  name="email"
                  type="email"
                  defaultValue={editing.email ?? ''}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Rôle
                <select
                  name="role"
                  defaultValue={editing.role}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                >
                  {roleOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditing(null)}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600"
                >
                  Annuler
                </button>
                <button className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white">
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

function getSortValue(member: MemberRow, key: SortKey) {
  switch (key) {
    case 'first_name':
      return member.first_name ?? '';
    case 'last_name':
      return member.last_name ?? '';
    case 'email':
      return member.email ?? '';
    case 'organizerName':
      return member.organizerName ?? '';
    case 'role':
      return ROLE_LABELS[member.role] ?? '';
    default:
      return '';
  }
}
