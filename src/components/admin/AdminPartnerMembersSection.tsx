'use client';

import { useMemo, useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import {
  PARTNER_ACCESS_LABELS,
  PARTNER_ACCESS_ROLE_VALUES,
  normalizePartnerAccessRole,
  type PartnerAccessRole
} from '@/lib/partner-access';
import { PasswordInput } from '@/components/auth/PasswordInput';
import {
  PASSWORD_POLICY_HTML_PATTERN,
  PASSWORD_POLICY_MESSAGE,
  PASSWORD_POLICY_MIN_LENGTH
} from '@/lib/auth/password-policy';

type MemberRow = {
  id: string;
  user_id: string;
  created_at: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  role: string;
  role_label: string | null;
};

type ModalState =
  | { mode: 'add' }
  | { mode: 'edit'; member: MemberRow }
  | null;

export function AdminPartnerMembersSection({
  partnerId,
  members,
  initialMode,
  initialMemberId
}: {
  partnerId: string;
  members: MemberRow[];
  initialMode?: 'add' | 'edit' | null;
  initialMemberId?: string | null;
}) {
  const initialModalState = useMemo<ModalState>(() => {
    if (initialMode === 'add') return { mode: 'add' };
    if (initialMode === 'edit' && initialMemberId) {
      const match = members.find((member) => member.id === initialMemberId);
      if (match) return { mode: 'edit', member: match };
    }
    return null;
  }, [initialMode, initialMemberId, members]);

  const [modalState, setModalState] = useState<ModalState>(initialModalState);

  const roleOptions = useMemo(
    () =>
      PARTNER_ACCESS_ROLE_VALUES.map((role) => ({
        value: role,
        label: PARTNER_ACCESS_LABELS[role]
      })),
    []
  );

  const renderRoleLabel = (role: string) => PARTNER_ACCESS_LABELS[normalizePartnerAccessRole(role)];

  return (
    <div className="space-y-4">
      <div className="flex justify-start sm:justify-end">
        <button
          type="button"
          onClick={() => setModalState({ mode: 'add' })}
          className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"
        >
          Ajouter un utilisateur
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="min-w-[860px] w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Prénom</th>
                <th className="px-4 py-3">Nom</th>
                <th className="px-4 py-3">Fonction</th>
                <th className="px-4 py-3">Accès</th>
                <th className="px-4 py-3">Ajouté le</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {members.map((member) => (
                <tr key={member.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 text-slate-600">{member.email ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-600">{member.first_name ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-600">{member.last_name ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-600">{member.role_label ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-600">{renderRoleLabel(member.role)}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {new Date(member.created_at).toLocaleDateString('fr-FR')}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex items-center justify-end gap-2">
                      <form
                        action={`/api/admin/partners/${partnerId}/members/${member.id}/delete`}
                        method="post"
                        className="inline"
                        onSubmit={(event) => {
                          if (!window.confirm('Supprimer cet accès partenaire ?')) {
                            event.preventDefault();
                          }
                        }}
                      >
                        <input type="hidden" name="redirect_to" value={`/admin/partenaires/${partnerId}`} />
                        <button
                          type="submit"
                          className="inline-flex items-center justify-center rounded-md border border-red-200 p-2 text-red-600 hover:border-red-300 hover:text-red-700"
                          aria-label="Supprimer le membre"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </form>
                      <button
                        type="button"
                        onClick={() => setModalState({ mode: 'edit', member })}
                        className="inline-flex items-center justify-center rounded-md border border-slate-200 p-2 text-slate-600 hover:text-slate-900"
                        aria-label="Modifier le membre"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {members.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-slate-500" colSpan={7}>
                    Aucun utilisateur partenaire.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      {modalState?.mode === 'add' ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4 py-6">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="admin-section-title">Ajouter un utilisateur</h2>
                <p className="admin-page-subtitle mt-1">Créer ou lier un compte à ce partenaire.</p>
              </div>
              <button
                type="button"
                onClick={() => setModalState(null)}
                className="rounded-md border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600"
              >
                Fermer
              </button>
            </div>

            <form className="mt-6 space-y-4" action={`/api/admin/partners/${partnerId}/members`} method="post">
              <input
                type="hidden"
                name="redirect_to"
                value={`/admin/partenaires/${partnerId}?openMemberModal=add`}
              />
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
                Fonction au CSE
                <input
                  name="role_label"
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                  placeholder="Ex. : Comptabilité, Trésorier, Secrétaire"
                />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Niveau d&apos;accès
                <select
                  name="role"
                  defaultValue="PARTNER_BENEFICIARY_MANAGER"
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                >
                  {roleOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Mot de passe temporaire (si création)
                <PasswordInput
                  name="temp_password"
                  minLength={PASSWORD_POLICY_MIN_LENGTH}
                  pattern={PASSWORD_POLICY_HTML_PATTERN}
                  title={PASSWORD_POLICY_MESSAGE}
                  autoComplete="new-password"
                  className="mt-1"
                  inputClassName="w-full rounded-lg border border-slate-200 px-3 py-2 pr-11"
                />
                <span className="mt-1 block text-xs text-slate-500">{PASSWORD_POLICY_MESSAGE}</span>
              </label>
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setModalState(null)}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600"
                >
                  Annuler
                </button>
                <button className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white">
                  Ajouter
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {modalState?.mode === 'edit' ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4 py-6">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="admin-section-title">Modifier l&apos;utilisateur</h2>
                <p className="admin-page-subtitle mt-1">
                  {modalState.member.first_name ?? '—'} {modalState.member.last_name ?? ''}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalState(null)}
                className="rounded-md border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600"
              >
                Fermer
              </button>
            </div>

            <form
              className="mt-6 space-y-4"
              action={`/api/admin/partners/${partnerId}/members/${modalState.member.id}`}
              method="post"
            >
              <input
                type="hidden"
                name="redirect_to"
                value={`/admin/partenaires/${partnerId}?openMemberModal=edit&memberId=${modalState.member.id}`}
              />
              <label className="block text-sm font-medium text-slate-700">
                Prénom
                <input
                  name="first_name"
                  defaultValue={modalState.member.first_name ?? ''}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Nom
                <input
                  name="last_name"
                  defaultValue={modalState.member.last_name ?? ''}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Email
                <input
                  name="email"
                  type="email"
                  defaultValue={modalState.member.email ?? ''}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Fonction au CSE
                <input
                  name="role_label"
                  defaultValue={modalState.member.role_label ?? ''}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                  placeholder="Ex. : Comptabilité, Trésorier, Secrétaire"
                />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Niveau d&apos;accès
                <select
                  name="role"
                  defaultValue={normalizePartnerAccessRole(modalState.member.role)}
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
                  onClick={() => setModalState(null)}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600"
                >
                  Annuler
                </button>
                <button className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
