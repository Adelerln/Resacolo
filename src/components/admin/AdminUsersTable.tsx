'use client';

import { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Pencil } from 'lucide-react';
import { ORGANIZER_ACCESS_ROLE_VALUES, type OrganizerAccessRole } from '@/lib/organizer-access';
import { PASSWORD_POLICY_HTML_PATTERN, PASSWORD_POLICY_MESSAGE } from '@/lib/auth/password-policy';

type StaffAccessRole = 'ADMIN' | 'ADMIN_SALES';

type OrganizerMemberRow = {
  kind: 'organizer';
  id: string;
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  organizerName: string | null;
  role: OrganizerAccessRole;
};

type StaffMemberRow = {
  kind: 'staff';
  id: string;
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  organizerName: string | null;
  role: StaffAccessRole;
};

type MemberRow = OrganizerMemberRow | StaffMemberRow;

type SortKey = 'first_name' | 'last_name' | 'email' | 'organizerName' | 'role';

type ModalState =
  | { mode: 'add' }
  | { mode: 'edit'; member: MemberRow }
  | null;

const ORGANIZER_ROLE_LABELS: Record<OrganizerAccessRole, string> = {
  OWNER: 'Propriétaire',
  EDITOR: 'Éditeur',
  RESERVATION_MANAGER: 'Gestionnaire réservations'
};

const STAFF_ROLE_LABELS: Record<StaffAccessRole, string> = {
  ADMIN: 'Compte organisme',
  ADMIN_SALES: 'Commercial'
};

const STAFF_ROLE_OPTIONS: Array<{ value: StaffAccessRole; label: string }> = [
  { value: 'ADMIN_SALES', label: STAFF_ROLE_LABELS.ADMIN_SALES },
  { value: 'ADMIN', label: STAFF_ROLE_LABELS.ADMIN }
];

function isOrganizerMember(member: MemberRow): member is OrganizerMemberRow {
  return member.kind === 'organizer';
}

function isStaffMember(member: MemberRow): member is StaffMemberRow {
  return member.kind === 'staff';
}

function getRoleLabel(member: MemberRow) {
  return isOrganizerMember(member)
    ? ORGANIZER_ROLE_LABELS[member.role]
    : STAFF_ROLE_LABELS[member.role] ?? member.role;
}

export function AdminUsersTable({
  members,
  initialMode,
  initialUserId
}: {
  members: MemberRow[];
  initialMode?: 'add' | null;
  initialUserId?: string | null;
}) {
  const initialModalState = useMemo<ModalState>(() => {
    if (initialMode === 'add') return { mode: 'add' };
    if (initialUserId) {
      const match = members.find((member) => member.user_id === initialUserId || member.id === initialUserId);
      if (match) return { mode: 'edit', member: match };
    }
    return null;
  }, [initialMode, initialUserId, members]);

  const [editing, setEditing] = useState<ModalState>(initialModalState);
  const [sortConfig, setSortConfig] = useState<{
    key: SortKey;
    direction: 'asc' | 'desc';
  } | null>(null);

  const organizerRoleOptions = useMemo(
    () =>
      ORGANIZER_ACCESS_ROLE_VALUES.map((role) => ({
        value: role,
        label: ORGANIZER_ROLE_LABELS[role]
      })),
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

  const editMember = editing?.mode === 'edit' ? editing.member : null;
  const editAction = editMember
    ? isOrganizerMember(editMember)
      ? `/api/admin/organizer-members/${editMember.id}`
      : `/api/admin/staff-users/${editMember.user_id}`
    : '';
  const passwordAction = editMember
    ? isOrganizerMember(editMember)
      ? `/api/admin/organizer-members/${editMember.id}/password`
      : `/api/admin/staff-users/${editMember.user_id}/password`
    : '';
  const passwordRedirectTo = editMember
    ? `/admin/utilisateurs?editUserId=${encodeURIComponent(editMember.user_id)}`
    : '/admin/utilisateurs';

  return (
    <>
      <div className="flex justify-start sm:justify-end">
        <button
          type="button"
          onClick={() => setEditing({ mode: 'add' })}
          className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"
        >
          Créer un utilisateur commercial
        </button>
      </div>

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
                <tr key={`${member.kind}-${member.id}`} className="border-t border-slate-100">
                  <td className="px-4 py-3 text-slate-600">{member.first_name ?? '-'}</td>
                  <td className="px-4 py-3 text-slate-600">{member.last_name ?? '-'}</td>
                  <td className="px-4 py-3 text-slate-600">{member.email ?? '-'}</td>
                  <td className="px-4 py-3 text-slate-600">{member.organizerName ?? '-'}</td>
                  <td className="px-4 py-3 text-slate-600">{getRoleLabel(member)}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => setEditing({ mode: 'edit', member })}
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

      {editing?.mode === 'add' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4 py-6">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Créer un utilisateur commercial</h2>
                <p className="text-sm text-slate-600">
                  Compte back-office non relié à un organisme, avec accès `ADMIN_SALES`.
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

            <form className="mt-6 space-y-4" action="/api/admin/staff-users" method="post">
              <input type="hidden" name="redirect_to" value="/admin/utilisateurs?openCreate=1" />
              <input type="hidden" name="role" value="ADMIN_SALES" />
              <div className="grid gap-4 md:grid-cols-2">
                <label className="block text-sm font-medium text-slate-700">
                  Prénom
                  <input
                    name="first_name"
                    required
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                  />
                </label>
                <label className="block text-sm font-medium text-slate-700">
                  Nom
                  <input
                    name="last_name"
                    required
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                  />
                </label>
              </div>
              <label className="block text-sm font-medium text-slate-700">
                Email
                <input
                  name="email"
                  type="email"
                  required
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Mot de passe temporaire
                <input
                  name="temp_password"
                  type="password"
                  required
                  pattern={PASSWORD_POLICY_HTML_PATTERN}
                  title={PASSWORD_POLICY_MESSAGE}
                  autoComplete="new-password"
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                />
                <span className="mt-1 block text-xs text-slate-500">{PASSWORD_POLICY_MESSAGE}</span>
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
                  Créer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4 py-6">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Modifier l&apos;utilisateur</h2>
                <p className="text-sm text-slate-600">
                  {editMember.first_name ?? '-'} {editMember.last_name ?? ''}
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

            <form className="mt-6 space-y-4" action={editAction} method="post">
              {!isOrganizerMember(editMember) && (
                <input type="hidden" name="redirect_to" value={passwordRedirectTo} />
              )}
              <input type="hidden" name="user_id" value={editMember.user_id} />
              <label className="block text-sm font-medium text-slate-700">
                Prénom
                <input
                  name="first_name"
                  defaultValue={editMember.first_name ?? ''}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Nom
                <input
                  name="last_name"
                  defaultValue={editMember.last_name ?? ''}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Email
                <input
                  name="email"
                  type="email"
                  defaultValue={editMember.email ?? ''}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Rôle
                {isOrganizerMember(editMember) ? (
                  <select
                    name="role"
                    defaultValue={editMember.role}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                  >
                    {organizerRoleOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <select
                    name="role"
                    defaultValue={editMember.role}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                  >
                    {STAFF_ROLE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                )}
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

            <form className="mt-6 space-y-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-4" action={passwordAction} method="post">
              <input type="hidden" name="redirect_to" value={passwordRedirectTo} />
              <div className="text-sm font-semibold text-slate-900">Modifier le mot de passe</div>
              <label className="block text-sm font-medium text-slate-700">
                Nouveau mot de passe
                <input
                  name="password"
                  type="password"
                  required
                  pattern={PASSWORD_POLICY_HTML_PATTERN}
                  title={PASSWORD_POLICY_MESSAGE}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                  placeholder="Mot de passe conforme à la politique"
                />
              </label>
              <div className="flex items-center justify-end">
                <button className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
                  Mettre à jour
                </button>
              </div>
              <p className="text-xs text-slate-500">{PASSWORD_POLICY_MESSAGE}</p>
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
      return getRoleLabel(member);
    default:
      return '';
  }
}
