'use client';

import { useState, useTransition } from 'react';

type PartnerContactRow = {
  id: string;
  full_name: string;
  role_label: string | null;
  email: string;
  phone: string | null;
  is_primary: boolean;
  created_at: string;
};

export default function PartnerContactsSection({
  contacts,
  contactsTableAvailable,
  addContactAction,
  deleteContactAction
}: {
  contacts: PartnerContactRow[];
  contactsTableAvailable: boolean;
  addContactAction: (formData: FormData) => void;
  deleteContactAction: (formData: FormData) => void;
}) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [fullName, setFullName] = useState('');
  const [roleLabel, setRoleLabel] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [isPrimary, setIsPrimary] = useState(false);

  const resetModalFields = () => {
    setFullName('');
    setRoleLabel('');
    setEmail('');
    setPhone('');
    setIsPrimary(false);
  };

  const handleDeleteContact = (contactId: string) => {
    if (!window.confirm('Supprimer ce contact partenaire ?')) return;
    const formData = new FormData();
    formData.set('contact_id', contactId);
    startTransition(() => {
      deleteContactAction(formData);
    });
  };

  const handleAddContact = () => {
    if (!fullName.trim() || !email.trim()) return;
    const formData = new FormData();
    formData.set('full_name', fullName.trim());
    formData.set('role_label', roleLabel.trim());
    formData.set('email', email.trim());
    formData.set('phone', phone.trim());
    if (isPrimary) {
      formData.set('is_primary', 'on');
    }
    startTransition(() => {
      addContactAction(formData);
    });
    setIsModalOpen(false);
    resetModalFields();
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-start sm:justify-end">
        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          disabled={!contactsTableAvailable}
          className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-900"
        >
          Ajouter un contact
        </button>
      </div>

      {!contactsTableAvailable ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          La table des contacts vient d&apos;être créée mais n&apos;est pas encore visible dans le cache Supabase.
          Rechargez la page dans un instant pour retrouver l&apos;ajout et la suppression.
        </div>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="min-w-[760px] w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Nom</th>
                <th className="px-4 py-3">Fonction</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Téléphone</th>
                <th className="px-4 py-3">Statut</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {contacts.map((contact) => (
                <tr key={contact.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 font-medium text-slate-900">{contact.full_name}</td>
                  <td className="px-4 py-3 text-slate-600">{contact.role_label ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-600">{contact.email}</td>
                  <td className="px-4 py-3 text-slate-600">{contact.phone ?? '—'}</td>
                  <td className="px-4 py-3">
                    {contact.is_primary ? (
                      <span className="inline-flex items-center rounded-full bg-orange-100 px-2.5 py-1 text-xs font-semibold text-orange-900">
                        Principal
                      </span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {contactsTableAvailable ? (
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => handleDeleteContact(contact.id)}
                        className="rounded-lg border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700 transition hover:border-rose-300 hover:text-rose-800 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Supprimer
                      </button>
                    ) : (
                      <span className="text-xs font-medium text-slate-400">Lecture seule</span>
                    )}
                  </td>
                </tr>
              ))}
              {contacts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-slate-500">
                    Aucun contact enregistré.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && contactsTableAvailable ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4 py-6">
          <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="admin-section-title">Ajouter un contact</h3>
                <p className="admin-page-subtitle mt-1">
                  Ajoutez un interlocuteur partenaire pour la gestion du compte.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="rounded-md border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600"
              >
                Fermer
              </button>
            </div>

            <div className="mt-6 space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="text-sm font-medium text-slate-700">
                  Nom complet
                  <input
                    value={fullName}
                    onChange={(event) => setFullName(event.target.value)}
                    required
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900"
                  />
                </label>
                <label className="text-sm font-medium text-slate-700">
                  Fonction
                  <input
                    value={roleLabel}
                    onChange={(event) => setRoleLabel(event.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900"
                    placeholder="Ex: RH, CSE, Comptabilité"
                  />
                </label>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="text-sm font-medium text-slate-700">
                  Email
                  <input
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    type="email"
                    required
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900"
                  />
                </label>
                <label className="text-sm font-medium text-slate-700">
                  Téléphone
                  <input
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900"
                  />
                </label>
              </div>
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={isPrimary}
                  onChange={(event) => setIsPrimary(event.target.checked)}
                  className="h-4 w-4 rounded border-slate-300"
                />
                Définir comme contact principal
              </label>
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false);
                    resetModalFields();
                  }}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  disabled={isPending || !fullName.trim() || !email.trim()}
                  onClick={handleAddContact}
                  className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Ajouter le contact
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
