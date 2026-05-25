'use client';

import { useState } from 'react';

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
                      <form
                        action={deleteContactAction}
                        onSubmit={(event) => {
                          if (!window.confirm('Supprimer ce contact partenaire ?')) {
                            event.preventDefault();
                          }
                        }}
                      >
                        <input type="hidden" name="contact_id" value={contact.id} />
                        <button className="rounded-lg border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700 transition hover:border-rose-300 hover:text-rose-800">
                          Supprimer
                        </button>
                      </form>
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
                  Fonction
                  <input
                    name="role_label"
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900"
                    placeholder="Ex: RH, CSE, Comptabilité"
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
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600"
                >
                  Annuler
                </button>
                <button className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
                  Ajouter le contact
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
