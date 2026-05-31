'use client';

import { useMemo, useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { PasswordInput } from '@/components/auth/PasswordInput';
import {
  PARTNER_ACCESS_LABELS,
  PARTNER_ACCESS_ROLE_VALUES,
  normalizePartnerAccessRole
} from '@/lib/partner-access';
import {
  PASSWORD_POLICY_HTML_PATTERN,
  PASSWORD_POLICY_MESSAGE,
  PASSWORD_POLICY_MIN_LENGTH
} from '@/lib/auth/password-policy';

type PartnerContactRow = {
  id: string;
  full_name: string;
  role_label: string | null;
  email: string;
  phone: string | null;
  is_primary: boolean;
  created_at: string;
};

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

type UnifiedRow =
  | { kind: 'member'; member: MemberRow; contact: PartnerContactRow | null }
  | { kind: 'contact-only'; contact: PartnerContactRow };

type ModalState =
  | { mode: 'add-member' }
  | { mode: 'add-contact' }
  | { mode: 'edit'; member: MemberRow }
  | { mode: 'edit-contact'; contact: PartnerContactRow }
  | null;

function buildUnifiedRows(contacts: PartnerContactRow[], members: MemberRow[]): UnifiedRow[] {
  const contactsByEmail = new Map(contacts.map((contact) => [contact.email.trim().toLowerCase(), contact]));
  const memberEmails = new Set(
    members.map((member) => member.email?.trim().toLowerCase()).filter((email): email is string => Boolean(email))
  );

  const rows: UnifiedRow[] = [
    ...members.map((member) => ({
      kind: 'member' as const,
      member,
      contact: member.email ? contactsByEmail.get(member.email.trim().toLowerCase()) ?? null : null
    })),
    ...contacts
      .filter((contact) => !memberEmails.has(contact.email.trim().toLowerCase()))
      .map((contact) => ({ kind: 'contact-only' as const, contact }))
  ];

  return rows.sort((left, right) => {
    const leftPrimary =
      (left.kind === 'member' ? left.contact?.is_primary : left.contact.is_primary) ?? false;
    const rightPrimary =
      (right.kind === 'member' ? right.contact?.is_primary : right.contact.is_primary) ?? false;
    if (leftPrimary !== rightPrimary) return leftPrimary ? -1 : 1;

    const leftName =
      left.kind === 'contact-only'
        ? left.contact.full_name
        : left.contact?.full_name ??
          [left.member.first_name, left.member.last_name].filter(Boolean).join(' ');
    const rightName =
      right.kind === 'contact-only'
        ? right.contact.full_name
        : right.contact?.full_name ??
          [right.member.first_name, right.member.last_name].filter(Boolean).join(' ');

    return leftName.localeCompare(rightName, 'fr');
  });
}

function displayName(row: UnifiedRow) {
  if (row.kind === 'contact-only') return row.contact.full_name;
  if (row.contact?.full_name) return row.contact.full_name;
  const composed = [row.member.first_name, row.member.last_name].filter(Boolean).join(' ').trim();
  return composed || '—';
}

function displayAddedAt(row: UnifiedRow) {
  if (row.kind === 'member') {
    return new Date(row.member.created_at).toLocaleDateString('fr-FR');
  }
  return new Date(row.contact.created_at).toLocaleDateString('fr-FR');
}

const actionButtonBaseClass =
  'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition';
const deleteActionButtonClass = `${actionButtonBaseClass} border-red-200 bg-red-50 text-red-600 hover:border-red-300 hover:bg-red-100 hover:text-red-700`;
const editActionButtonClass = `${actionButtonBaseClass} border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900`;

export default function PartnerPeopleSection({
  contacts,
  members,
  contactsTableAvailable,
  addContactAction,
  updateContactAction,
  deleteContactAction,
  initialMode,
  initialMemberId
}: {
  contacts: PartnerContactRow[];
  members: MemberRow[];
  contactsTableAvailable: boolean;
  addContactAction: (formData: FormData) => void;
  updateContactAction: (formData: FormData) => void;
  deleteContactAction: (formData: FormData) => void;
  initialMode?: 'add' | 'edit' | null;
  initialMemberId?: string | null;
}) {
  const unifiedRows = useMemo(() => buildUnifiedRows(contacts, members), [contacts, members]);

  const initialModalState = useMemo<ModalState>(() => {
    if (initialMode === 'add') return { mode: 'add-member' };
    if (initialMode === 'edit' && initialMemberId) {
      const match = members.find((member) => member.id === initialMemberId);
      if (match) return { mode: 'edit', member: match };
    }
    return null;
  }, [initialMode, initialMemberId, members]);

  const [modalState, setModalState] = useState<ModalState>(initialModalState);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
        <button
          type="button"
          onClick={() => setModalState({ mode: 'add-contact' })}
          disabled={!contactsTableAvailable}
          className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Ajouter un interlocuteur sans compte
        </button>
        <button
          type="button"
          onClick={() => setModalState({ mode: 'add-member' })}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
        >
          Ajouter un utilisateur
        </button>
      </div>

      {!contactsTableAvailable ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          La table des contacts vient d&apos;être créée mais n&apos;est pas encore visible dans le cache Supabase.
          Rechargez la page dans un instant.
        </div>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="min-w-[960px] w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Nom</th>
                <th className="px-4 py-3">Email</th>
                <th className="whitespace-nowrap px-4 py-3">Téléphone</th>
                <th className="px-4 py-3">Fonction</th>
                <th className="px-4 py-3">Accès</th>
                <th className="px-4 py-3">Statut</th>
                <th className="px-4 py-3">Ajouté le</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {unifiedRows.map((row) => {
                const isPrimary =
                  row.kind === 'member' ? Boolean(row.contact?.is_primary) : row.contact.is_primary;
                const phone = row.kind === 'member' ? row.contact?.phone : row.contact.phone;
                const roleLabel =
                  row.kind === 'member'
                    ? row.contact?.role_label ?? row.member.role_label
                    : row.contact.role_label;
                const accessLabel =
                  row.kind === 'member'
                    ? PARTNER_ACCESS_LABELS[normalizePartnerAccessRole(row.member.role)]
                    : 'Sans compte';
                const rowKey = row.kind === 'member' ? `member-${row.member.id}` : `contact-${row.contact.id}`;

                return (
                  <tr key={rowKey} className="border-t border-slate-100">
                    <td className="px-4 py-3 font-medium text-slate-900">{displayName(row)}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {row.kind === 'member' ? row.member.email ?? '—' : row.contact.email}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">{phone ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-600">{roleLabel ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-600">{accessLabel}</td>
                    <td className="px-4 py-3">
                      {isPrimary ? (
                        <span className="inline-flex items-center rounded-full bg-orange-100 px-2.5 py-1 text-xs font-semibold text-orange-900">
                          Principal
                        </span>
                      ) : row.kind === 'member' ? (
                        <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-900">
                          Secondaire
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                          Autre
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{displayAddedAt(row)}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center justify-end gap-2">
                        {row.kind === 'member' ? (
                          <>
                            <form
                              action={`/api/partner/members/${row.member.id}/delete`}
                              method="post"
                              className="inline"
                              onSubmit={(event) => {
                                if (!window.confirm('Supprimer cet accès partenaire ?')) {
                                  event.preventDefault();
                                }
                              }}
                            >
                              <input type="hidden" name="redirect_to" value="/partenaire/fiche" />
                              <button
                                type="submit"
                                className={deleteActionButtonClass}
                                aria-label="Supprimer l'utilisateur"
                              >
                                <Trash2 className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
                              </button>
                            </form>
                            <button
                              type="button"
                              onClick={() => setModalState({ mode: 'edit', member: row.member })}
                              className={editActionButtonClass}
                              aria-label="Modifier l'utilisateur"
                            >
                              <Pencil className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
                            </button>
                          </>
                        ) : contactsTableAvailable ? (
                          <>
                            <form
                              action={deleteContactAction}
                              className="inline"
                              onSubmit={(event) => {
                                if (!window.confirm('Supprimer cet interlocuteur ?')) {
                                  event.preventDefault();
                                }
                              }}
                            >
                              <input type="hidden" name="contact_id" value={row.contact.id} />
                              <button
                                type="submit"
                                className={deleteActionButtonClass}
                                aria-label="Supprimer l'interlocuteur"
                              >
                                <Trash2 className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
                              </button>
                            </form>
                            <button
                              type="button"
                              onClick={() => setModalState({ mode: 'edit-contact', contact: row.contact })}
                              className={editActionButtonClass}
                              aria-label="Modifier l'interlocuteur"
                            >
                              <Pencil className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
                            </button>
                          </>
                        ) : (
                          <span className="text-xs font-medium text-slate-400">Lecture seule</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {unifiedRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-6 text-slate-500">
                    Aucun interlocuteur ou utilisateur enregistré.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      {modalState?.mode === 'add-member' ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4 py-6">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="admin-section-title">Ajouter un utilisateur</h2>
                <p className="admin-page-subtitle mt-1">Créer ou lier un compte à votre partenaire.</p>
              </div>
              <button
                type="button"
                onClick={() => setModalState(null)}
                className="rounded-md border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600"
              >
                Fermer
              </button>
            </div>

            <form className="mt-6 space-y-4" action="/api/partner/members" method="post">
              <input type="hidden" name="redirect_to" value="/partenaire/fiche?openMemberModal=add" />
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
                  {PARTNER_ACCESS_ROLE_VALUES.map((role) => (
                    <option key={role} value={role}>
                      {PARTNER_ACCESS_LABELS[role]}
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
                <button className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
                  Ajouter
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {modalState?.mode === 'add-contact' && contactsTableAvailable ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4 py-6">
          <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="admin-section-title">Ajouter un interlocuteur sans compte</h2>
                <p className="admin-page-subtitle mt-1">
                  Pour une personne référencée sans accès à l&apos;espace partenaire.
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

            <form action={addContactAction} className="mt-6 space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="text-sm font-medium text-slate-700">
                  Nom complet
                  <input
                    name="full_name"
                    required
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900"
                  />
                </label>
                <label className="text-sm font-medium text-slate-700">
                  Fonction au CSE
                  <input
                    name="role_label"
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900"
                    placeholder="Ex. : Comptabilité, Trésorier, Secrétaire"
                  />
                </label>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="text-sm font-medium text-slate-700">
                  Email
                  <input
                    name="email"
                    type="email"
                    required
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900"
                  />
                </label>
                <label className="text-sm font-medium text-slate-700">
                  Téléphone
                  <input
                    name="phone"
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900"
                  />
                </label>
              </div>
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <input type="checkbox" name="is_primary" className="h-4 w-4 rounded border-slate-300" />
                Définir comme contact principal
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
                  Ajouter
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {modalState?.mode === 'edit-contact' && contactsTableAvailable ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4 py-6">
          <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="admin-section-title">Modifier l&apos;interlocuteur</h2>
                <p className="admin-page-subtitle mt-1">{modalState.contact.full_name}</p>
              </div>
              <button
                type="button"
                onClick={() => setModalState(null)}
                className="rounded-md border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600"
              >
                Fermer
              </button>
            </div>

            <form action={updateContactAction} className="mt-6 space-y-4">
              <input type="hidden" name="contact_id" value={modalState.contact.id} />
              <div className="grid gap-4 md:grid-cols-2">
                <label className="text-sm font-medium text-slate-700">
                  Nom complet
                  <input
                    name="full_name"
                    required
                    defaultValue={modalState.contact.full_name}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900"
                  />
                </label>
                <label className="text-sm font-medium text-slate-700">
                  Fonction au CSE
                  <input
                    name="role_label"
                    defaultValue={modalState.contact.role_label ?? ''}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900"
                    placeholder="Ex. : Comptabilité, Trésorier, Secrétaire"
                  />
                </label>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="text-sm font-medium text-slate-700">
                  Email
                  <input
                    name="email"
                    type="email"
                    required
                    defaultValue={modalState.contact.email}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900"
                  />
                </label>
                <label className="text-sm font-medium text-slate-700">
                  Téléphone
                  <input
                    name="phone"
                    defaultValue={modalState.contact.phone ?? ''}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900"
                  />
                </label>
              </div>
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <input
                  type="checkbox"
                  name="is_primary"
                  defaultChecked={modalState.contact.is_primary}
                  className="h-4 w-4 rounded border-slate-300"
                />
                Définir comme contact principal
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

            <form className="mt-6 space-y-4" action={`/api/partner/members/${modalState.member.id}`} method="post">
              <input
                type="hidden"
                name="redirect_to"
                value={`/partenaire/fiche?openMemberModal=edit&memberId=${modalState.member.id}`}
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
                  {PARTNER_ACCESS_ROLE_VALUES.map((role) => (
                    <option key={role} value={role}>
                      {PARTNER_ACCESS_LABELS[role]}
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
